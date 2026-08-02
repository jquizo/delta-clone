import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, test } from 'vitest';
import { db } from '../db';
import {
  instrumentRepo,
  portfolioRepo,
  priceHistoryRepo,
  quotesCacheRepo,
  SellExceedsHoldingError,
  snapshotRepo,
  transactionRepo,
  wipeAllData,
} from '../repositories';
import type { PriceQuote } from '../../domain/types';

beforeEach(async () => {
  await Promise.all([
    db.transactions.clear(),
    db.portfolios.clear(),
    db.instruments.clear(),
    db.quotesCache.clear(),
    db.priceHistory.clear(),
    db.snapshots.clear(),
  ]);
});

describe('portfolioRepo.ensureDefault', () => {
  test('creates a default AUD portfolio when none exists', async () => {
    const portfolio = await portfolioRepo.ensureDefault();
    expect(portfolio.baseCurrency).toBe('AUD');
    expect(await db.portfolios.count()).toBe(1);
  });

  test('is idempotent — returns the existing portfolio on a second call', async () => {
    const first = await portfolioRepo.ensureDefault();
    const second = await portfolioRepo.ensureDefault();
    expect(second.id).toBe(first.id);
    expect(await db.portfolios.count()).toBe(1);
  });
});

describe('portfolioRepo.update', () => {
  test('persists changes to an existing portfolio', async () => {
    const portfolio = await portfolioRepo.ensureDefault();
    const updated = await portfolioRepo.update({ ...portfolio, baseCurrency: 'USD' });

    expect(updated.baseCurrency).toBe('USD');
    const reloaded = await db.portfolios.get(portfolio.id);
    expect(reloaded?.baseCurrency).toBe('USD');
  });

  test('rejects an invalid update', async () => {
    const portfolio = await portfolioRepo.ensureDefault();
    await expect(portfolioRepo.update({ ...portfolio, name: '' })).rejects.toThrow();
  });
});

describe('instrumentRepo', () => {
  test('upsert persists an instrument, and a second upsert with the same id replaces it', async () => {
    await instrumentRepo.upsert({ id: 'ASX:BHP', exchange: 'ASX', currency: 'AUD', name: 'BHP Group Ltd' });
    await instrumentRepo.upsert({ id: 'ASX:BHP', exchange: 'ASX', currency: 'AUD', name: 'BHP Group Limited' });

    const all = await instrumentRepo.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('BHP Group Limited');
  });

  test('rejects an instrument with an unrecognised exchange', async () => {
    await expect(
      instrumentRepo.upsert({ id: 'TSX:SHOP', exchange: 'TSX' as never, currency: 'CAD', name: 'Shopify' }),
    ).rejects.toThrow();
  });
});

describe('transactionRepo', () => {
  const portfolioId = 'p1';

  test('add validates and persists a BUY transaction', async () => {
    const saved = await transactionRepo.add({
      portfolioId,
      instrumentId: 'ASX:BHP',
      type: 'BUY',
      quantity: 100,
      price: 40,
      fees: 10,
      currency: 'AUD',
      tradeDate: '2024-01-01',
    });

    expect(saved.id).toBeTruthy();
    expect(await db.transactions.count()).toBe(1);
  });

  test('add rejects an invalid transaction (zero quantity) and persists nothing', async () => {
    await expect(
      transactionRepo.add({
        portfolioId,
        instrumentId: 'ASX:BHP',
        type: 'BUY',
        quantity: 0,
        price: 40,
        fees: 0,
        currency: 'AUD',
        tradeDate: '2024-01-01',
      }),
    ).rejects.toThrow();
    expect(await db.transactions.count()).toBe(0);
  });

  test('add rejects a SELL that exceeds the quantity held as of that date, and persists nothing', async () => {
    await transactionRepo.add({
      portfolioId,
      instrumentId: 'ASX:BHP',
      type: 'BUY',
      quantity: 100,
      price: 40,
      fees: 0,
      currency: 'AUD',
      tradeDate: '2024-01-01',
    });

    await expect(
      transactionRepo.add({
        portfolioId,
        instrumentId: 'ASX:BHP',
        type: 'SELL',
        quantity: 150,
        price: 45,
        fees: 0,
        currency: 'AUD',
        tradeDate: '2024-02-01',
      }),
    ).rejects.toThrow(SellExceedsHoldingError);

    expect(await db.transactions.count()).toBe(1);
  });

  test('update validates a SELL against holdings excluding its own prior effect', async () => {
    await transactionRepo.add({
      portfolioId,
      instrumentId: 'ASX:BHP',
      type: 'BUY',
      quantity: 100,
      price: 40,
      fees: 0,
      currency: 'AUD',
      tradeDate: '2024-01-01',
    });
    const sell = await transactionRepo.add({
      portfolioId,
      instrumentId: 'ASX:BHP',
      type: 'SELL',
      quantity: 60,
      price: 45,
      fees: 0,
      currency: 'AUD',
      tradeDate: '2024-02-01',
    });

    // Editing the sell's own quantity to 100 is valid — it's compared against the
    // 100-share BUY, not against a state that already includes the old 60-share sell.
    const updated = await transactionRepo.update({ ...sell, quantity: 100 });
    expect(updated.quantity).toBe(100);

    // But raising it above what was ever held should still be rejected.
    await expect(transactionRepo.update({ ...sell, quantity: 150 })).rejects.toThrow(SellExceedsHoldingError);
  });

  test('remove deletes a transaction', async () => {
    const saved = await transactionRepo.add({
      portfolioId,
      instrumentId: 'ASX:BHP',
      type: 'BUY',
      quantity: 100,
      price: 40,
      fees: 0,
      currency: 'AUD',
      tradeDate: '2024-01-01',
    });

    await transactionRepo.remove(saved.id);
    expect(await db.transactions.count()).toBe(0);
  });

  test('bulkAdd persists every row, regardless of input order, replaying chronologically', async () => {
    const saved = await transactionRepo.bulkAdd([
      { portfolioId, instrumentId: 'ASX:BHP', type: 'SELL', quantity: 40, price: 45, fees: 0, currency: 'AUD', tradeDate: '2024-02-01' },
      { portfolioId, instrumentId: 'ASX:BHP', type: 'BUY', quantity: 100, price: 40, fees: 0, currency: 'AUD', tradeDate: '2024-01-01' },
    ]);

    expect(saved).toHaveLength(2);
    expect(await db.transactions.count()).toBe(2);
  });

  test('bulkAdd is all-or-nothing: one invalid row rolls back the whole batch', async () => {
    await expect(
      transactionRepo.bulkAdd([
        { portfolioId, instrumentId: 'ASX:BHP', type: 'BUY', quantity: 100, price: 40, fees: 0, currency: 'AUD', tradeDate: '2024-01-01' },
        // This SELL exceeds anything ever held — should fail and roll back the BUY above too.
        { portfolioId, instrumentId: 'ASX:BHP', type: 'SELL', quantity: 500, price: 45, fees: 0, currency: 'AUD', tradeDate: '2024-02-01' },
      ]),
    ).rejects.toThrow(SellExceedsHoldingError);

    expect(await db.transactions.count()).toBe(0);
  });
});

function quote(overrides: Partial<PriceQuote> & Pick<PriceQuote, 'instrumentId'>): PriceQuote {
  return { price: 0, currency: 'AUD', previousClose: 0, marketState: 'CLOSED', asOf: 1, ...overrides };
}

describe('quotesCacheRepo', () => {
  test('saveQuotes persists quotes, and getQuotes retrieves them by instrument id', async () => {
    await quotesCacheRepo.saveQuotes([
      quote({ instrumentId: 'ASX:BHP', price: 45.12 }),
      quote({ instrumentId: 'NASDAQ:AAPL', price: 190 }),
    ]);

    const result = await quotesCacheRepo.getQuotes(['ASX:BHP', 'NASDAQ:AAPL']);
    expect(result).toHaveLength(2);
    expect(result.find((q) => q.instrumentId === 'ASX:BHP')?.price).toBe(45.12);
  });

  test('saveQuotes overwrites the previous cached quote for the same instrument', async () => {
    await quotesCacheRepo.saveQuotes([quote({ instrumentId: 'ASX:BHP', price: 45 })]);
    await quotesCacheRepo.saveQuotes([quote({ instrumentId: 'ASX:BHP', price: 46 })]);

    const result = await quotesCacheRepo.getQuotes(['ASX:BHP']);
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(46);
  });

  test('getQuotes omits instruments that have never been cached', async () => {
    await quotesCacheRepo.saveQuotes([quote({ instrumentId: 'ASX:BHP' })]);
    const result = await quotesCacheRepo.getQuotes(['ASX:BHP', 'NASDAQ:AAPL']);
    expect(result.map((q) => q.instrumentId)).toEqual(['ASX:BHP']);
  });
});

describe('priceHistoryRepo', () => {
  const points = [
    { date: '2026-01-01', close: 40 },
    { date: '2026-01-02', close: 41 },
  ];

  test('getCached returns undefined when nothing has been cached for that instrument/range', async () => {
    expect(await priceHistoryRepo.getCached('ASX:BHP', '6M')).toBeUndefined();
  });

  test('save then getCached round-trips the points within the TTL window', async () => {
    const fetchedAt = 1_000_000;
    await priceHistoryRepo.save('ASX:BHP', '6M', points, fetchedAt);

    const result = await priceHistoryRepo.getCached('ASX:BHP', '6M', fetchedAt + 60_000);
    expect(result).toEqual(points);
  });

  test('getCached returns undefined once the TTL has elapsed', async () => {
    const fetchedAt = 1_000_000;
    await priceHistoryRepo.save('ASX:BHP', '6M', points, fetchedAt);

    const oneHourAndOneMs = 60 * 60 * 1000 + 1;
    const result = await priceHistoryRepo.getCached('ASX:BHP', '6M', fetchedAt + oneHourAndOneMs);
    expect(result).toBeUndefined();
  });

  test('caches per range independently for the same instrument', async () => {
    const fetchedAt = 1_000_000;
    await priceHistoryRepo.save('ASX:BHP', '1M', points, fetchedAt);

    expect(await priceHistoryRepo.getCached('ASX:BHP', '1M', fetchedAt)).toEqual(points);
    expect(await priceHistoryRepo.getCached('ASX:BHP', '6M', fetchedAt)).toBeUndefined();
  });
});

describe('snapshotRepo', () => {
  const portfolioId = 'p1';

  test('hasSnapshotForDate is false before any snapshot has been written for that date', async () => {
    expect(await snapshotRepo.hasSnapshotForDate(portfolioId, '2026-01-01')).toBe(false);
  });

  test('add persists a snapshot, and hasSnapshotForDate becomes true for that date', async () => {
    await snapshotRepo.add({ portfolioId, date: '2026-01-01', valueInBase: 1000, costInBase: 800 });
    expect(await snapshotRepo.hasSnapshotForDate(portfolioId, '2026-01-01')).toBe(true);
    expect(await snapshotRepo.hasSnapshotForDate(portfolioId, '2026-01-02')).toBe(false);
  });

  test('getAll returns every snapshot for a portfolio, sorted by date', async () => {
    await snapshotRepo.add({ portfolioId, date: '2026-01-02', valueInBase: 1100, costInBase: 800 });
    await snapshotRepo.add({ portfolioId, date: '2026-01-01', valueInBase: 1000, costInBase: 800 });

    const all = await snapshotRepo.getAll(portfolioId);
    expect(all.map((s) => s.date)).toEqual(['2026-01-01', '2026-01-02']);
  });

  test('getAll scopes snapshots to the given portfolio', async () => {
    await snapshotRepo.add({ portfolioId: 'p1', date: '2026-01-01', valueInBase: 1000, costInBase: 800 });
    await snapshotRepo.add({ portfolioId: 'p2', date: '2026-01-01', valueInBase: 500, costInBase: 400 });

    const all = await snapshotRepo.getAll('p1');
    expect(all).toHaveLength(1);
    expect(all[0].portfolioId).toBe('p1');
  });
});

describe('wipeAllData', () => {
  test('empties every table', async () => {
    const portfolio = await portfolioRepo.ensureDefault();
    await instrumentRepo.upsert({ id: 'ASX:BHP', exchange: 'ASX', currency: 'AUD', name: 'BHP Group Ltd' });
    await transactionRepo.add({
      portfolioId: portfolio.id,
      instrumentId: 'ASX:BHP',
      type: 'BUY',
      quantity: 100,
      price: 40,
      fees: 0,
      currency: 'AUD',
      tradeDate: '2024-01-01',
    });
    await quotesCacheRepo.saveQuotes([
      { instrumentId: 'ASX:BHP', price: 45, currency: 'AUD', previousClose: 44, marketState: 'CLOSED', asOf: 1 },
    ]);
    await snapshotRepo.add({ portfolioId: portfolio.id, date: '2026-01-01', valueInBase: 1000, costInBase: 800 });

    await wipeAllData();

    expect(await db.portfolios.count()).toBe(0);
    expect(await db.instruments.count()).toBe(0);
    expect(await db.transactions.count()).toBe(0);
    expect(await db.quotesCache.count()).toBe(0);
    expect(await db.snapshots.count()).toBe(0);
    expect(await db.priceHistory.count()).toBe(0);
  });
});

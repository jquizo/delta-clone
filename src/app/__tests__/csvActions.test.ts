import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { db } from '../../data/db';
import { confirmImport, dryRunImport, exportPortfolioCsv } from '../csvActions';
import { instrumentRepo, transactionRepo } from '../../data/repositories';
import { deriveHoldings } from '../../domain/holdings';
import type { Portfolio } from '../../domain/types';

const portfolio: Portfolio = { id: 'p1', name: 'Personal', baseCurrency: 'AUD' };

beforeEach(async () => {
  await Promise.all([db.transactions.clear(), db.instruments.clear()]);
});

describe('exportPortfolioCsv', () => {
  test('exports every transaction for the portfolio with instrument metadata resolved', async () => {
    await instrumentRepo.upsert({ id: 'ASX:BHP', exchange: 'ASX', currency: 'AUD', name: 'BHP Group Ltd' });
    await transactionRepo.add({
      portfolioId: portfolio.id,
      instrumentId: 'ASX:BHP',
      type: 'BUY',
      quantity: 100,
      price: 40,
      fees: 10,
      currency: 'AUD',
      tradeDate: '2024-01-01',
    });

    const csv = await exportPortfolioCsv(portfolio.id);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('ASX:BHP');
    expect(lines[1]).toContain('BHP Group Ltd');
  });
});

describe('dryRunImport + confirmImport round trip', () => {
  test('a full export → wipe → import round-trip produces identical holdings', async () => {
    await instrumentRepo.upsert({ id: 'ASX:BHP', exchange: 'ASX', currency: 'AUD', name: 'BHP Group Ltd' });
    await instrumentRepo.upsert({ id: 'NASDAQ:AAPL', exchange: 'NASDAQ', currency: 'USD', name: 'Apple Inc.' });
    await transactionRepo.add({
      portfolioId: portfolio.id,
      instrumentId: 'ASX:BHP',
      type: 'BUY',
      quantity: 100,
      price: 40,
      fees: 10,
      currency: 'AUD',
      tradeDate: '2024-01-01',
    });
    await transactionRepo.add({
      portfolioId: portfolio.id,
      instrumentId: 'NASDAQ:AAPL',
      type: 'BUY',
      quantity: 10,
      price: 150,
      fees: 5,
      currency: 'USD',
      tradeDate: '2024-01-10',
    });
    await transactionRepo.add({
      portfolioId: portfolio.id,
      instrumentId: 'NASDAQ:AAPL',
      type: 'SELL',
      quantity: 4,
      price: 160,
      fees: 2,
      currency: 'USD',
      tradeDate: '2024-02-10',
    });

    const csv = await exportPortfolioCsv(portfolio.id);
    const originalHoldings = deriveHoldings(await transactionRepo.getAll());

    // Wipe, simulating a fresh database.
    await db.transactions.clear();
    await db.instruments.clear();
    expect(await transactionRepo.getAll()).toHaveLength(0);

    const dryRun = await dryRunImport(csv, portfolio.id);
    expect(dryRun.every((r) => r.status === 'ok')).toBe(true);

    await confirmImport(dryRun, portfolio.id);

    const reimportedHoldings = deriveHoldings(await transactionRepo.getAll());
    expect(reimportedHoldings).toEqual(originalHoldings);

    const instruments = await instrumentRepo.getAll();
    expect(instruments.find((i) => i.id === 'ASX:BHP')?.name).toBe('BHP Group Ltd');
    expect(instruments.find((i) => i.id === 'NASDAQ:AAPL')?.name).toBe('Apple Inc.');
  });

  test('dryRunImport flags rows already present in the database as duplicates', async () => {
    await transactionRepo.add({
      portfolioId: portfolio.id,
      instrumentId: 'ASX:BHP',
      type: 'BUY',
      quantity: 100,
      price: 40,
      fees: 10,
      currency: 'AUD',
      tradeDate: '2024-01-01',
    });

    const csv = await exportPortfolioCsv(portfolio.id);
    const dryRun = await dryRunImport(csv, portfolio.id);

    expect(dryRun[0].status).toBe('duplicate');
  });

  test('confirmImport only writes ok rows, skipping duplicates and errors', async () => {
    const csv = [
      'instrumentId,type,quantity,price,fees,currency,tradeDate,note',
      'ASX:BHP,BUY,100,40,10,AUD,2024-01-01,',
      'ASX:BHP,BUY,-5,40,10,AUD,2024-01-02,', // invalid
    ].join('\n');

    const dryRun = await dryRunImport(csv, portfolio.id);
    await confirmImport(dryRun, portfolio.id);

    const saved = await transactionRepo.getAll();
    expect(saved).toHaveLength(1);
    expect(saved[0].instrumentId).toBe('ASX:BHP');
  });

  test('the shipped sample CSV imports cleanly with no errors or duplicates', async () => {
    const samplePath = resolve(process.cwd(), 'public/sample-transactions.csv');
    const csv = readFileSync(samplePath, 'utf-8');

    const dryRun = await dryRunImport(csv, portfolio.id);

    expect(dryRun.length).toBeGreaterThan(0);
    expect(dryRun.every((r) => r.status === 'ok')).toBe(true);
  });
});

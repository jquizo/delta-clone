import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, test } from 'vitest';
import { db } from '../../data/db';
import { maybeWriteDailySnapshot } from '../snapshotActions';
import type { Holding, Portfolio, PriceQuote } from '../../domain/types';

const portfolio: Portfolio = { id: 'p1', name: 'Personal', baseCurrency: 'AUD' };

const holdings: Holding[] = [
  { instrumentId: 'ASX:BHP', quantity: 100, avgCostPerShare: 40, totalCost: 4000, realizedPnl: 0 },
];
const quotes: PriceQuote[] = [
  { instrumentId: 'ASX:BHP', price: 45, currency: 'AUD', previousClose: 44, marketState: 'CLOSED', asOf: 1 },
];

beforeEach(async () => {
  await db.snapshots.clear();
});

describe('maybeWriteDailySnapshot', () => {
  test('writes a snapshot when there is none for today and quotes are fresh (not stale, fully priced)', async () => {
    const snapshot = await maybeWriteDailySnapshot(portfolio, holdings, quotes, [], false);

    expect(snapshot).not.toBeNull();
    expect(snapshot?.valueInBase).toBeCloseTo(4500, 6);
    expect(snapshot?.costInBase).toBeCloseTo(4000, 6);
    expect(await db.snapshots.count()).toBe(1);
  });

  test('does not write a second snapshot for the same day', async () => {
    await maybeWriteDailySnapshot(portfolio, holdings, quotes, [], false);
    const second = await maybeWriteDailySnapshot(portfolio, holdings, quotes, [], false);

    expect(second).toBeNull();
    expect(await db.snapshots.count()).toBe(1);
  });

  test('does not write when quotes are stale (hydrated from cache)', async () => {
    const snapshot = await maybeWriteDailySnapshot(portfolio, holdings, quotes, [], true);
    expect(snapshot).toBeNull();
    expect(await db.snapshots.count()).toBe(0);
  });

  test('does not write when a holding could not be priced (hasMissingData)', async () => {
    const snapshot = await maybeWriteDailySnapshot(portfolio, holdings, [], [], false);
    expect(snapshot).toBeNull();
    expect(await db.snapshots.count()).toBe(0);
  });
});

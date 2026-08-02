import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, test } from 'vitest';
import { db } from '../../data/db';
import { addTransaction, removeTransaction, updateTransaction } from '../transactionActions';
import type { Portfolio } from '../../domain/types';

beforeEach(async () => {
  await Promise.all([db.transactions.clear(), db.portfolios.clear()]);
});

const audPortfolio: Portfolio = { id: 'p1', name: 'Personal', baseCurrency: 'AUD' };

describe('addTransaction', () => {
  test('same-currency transactions get fxRateToBase 1, unflagged', async () => {
    const saved = await addTransaction(
      { instrumentId: 'ASX:BHP', type: 'BUY', quantity: 100, price: 40, fees: 10, currency: 'AUD', tradeDate: '2024-01-01' },
      audPortfolio,
    );

    expect(saved.fxRateToBase).toBe(1);
    expect(saved.fxRateFlagged).toBe(false);
  });

  test('cross-currency transactions default to fxRateToBase 1 and are flagged, since no FX cache exists yet', async () => {
    const saved = await addTransaction(
      { instrumentId: 'NASDAQ:AAPL', type: 'BUY', quantity: 10, price: 150, fees: 5, currency: 'USD', tradeDate: '2024-01-01' },
      audPortfolio,
    );

    expect(saved.fxRateToBase).toBe(1);
    expect(saved.fxRateFlagged).toBe(true);
  });
});

describe('updateTransaction', () => {
  test('re-resolves the fx rate on update', async () => {
    const saved = await addTransaction(
      { instrumentId: 'ASX:BHP', type: 'BUY', quantity: 100, price: 40, fees: 10, currency: 'AUD', tradeDate: '2024-01-01' },
      audPortfolio,
    );

    const updated = await updateTransaction(
      saved.id,
      { instrumentId: 'ASX:BHP', type: 'BUY', quantity: 120, price: 40, fees: 10, currency: 'AUD', tradeDate: '2024-01-01' },
      audPortfolio,
    );

    expect(updated.quantity).toBe(120);
    expect(updated.fxRateToBase).toBe(1);
  });
});

describe('removeTransaction', () => {
  test('deletes the transaction', async () => {
    const saved = await addTransaction(
      { instrumentId: 'ASX:BHP', type: 'BUY', quantity: 100, price: 40, fees: 10, currency: 'AUD', tradeDate: '2024-01-01' },
      audPortfolio,
    );

    await removeTransaction(saved.id);
    expect(await db.transactions.count()).toBe(0);
  });
});

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, test } from 'vitest';
import { db } from '../../data/db';
import { transactionRepo } from '../../data/repositories';
import { ensureDefaultPortfolio, updateBaseCurrency, wipeAndResetPortfolio } from '../portfolioActions';

beforeEach(async () => {
  await Promise.all([db.transactions.clear(), db.portfolios.clear(), db.instruments.clear()]);
});

describe('updateBaseCurrency', () => {
  test('persists a new base currency for the portfolio', async () => {
    const portfolio = await ensureDefaultPortfolio();
    const updated = await updateBaseCurrency(portfolio, 'USD');

    expect(updated.baseCurrency).toBe('USD');
    expect((await db.portfolios.get(portfolio.id))?.baseCurrency).toBe('USD');
  });
});

describe('wipeAndResetPortfolio', () => {
  test('erases all data and returns a fresh default portfolio', async () => {
    const portfolio = await ensureDefaultPortfolio();
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

    const fresh = await wipeAndResetPortfolio();

    expect(fresh.id).not.toBe(portfolio.id);
    expect(await db.transactions.count()).toBe(0);
    expect(await db.portfolios.count()).toBe(1);
  });
});

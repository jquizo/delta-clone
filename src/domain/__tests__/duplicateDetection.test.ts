import { describe, expect, test } from 'vitest';
import { isDuplicateTransaction } from '../duplicateDetection';
import type { Transaction } from '../types';

function tx(overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'instrumentId' | 'type' | 'quantity' | 'price' | 'tradeDate'>): Transaction {
  return { portfolioId: 'p1', fees: 0, currency: 'AUD', ...overrides };
}

describe('isDuplicateTransaction', () => {
  const original = tx({ id: 't1', instrumentId: 'ASX:BHP', type: 'BUY', quantity: 100, price: 40, tradeDate: '2024-01-01' });

  test('matches when instrument, date, type, quantity, and price are all identical', () => {
    const same = tx({ id: 't2', instrumentId: 'ASX:BHP', type: 'BUY', quantity: 100, price: 40, tradeDate: '2024-01-01' });
    expect(isDuplicateTransaction(original, same)).toBe(true);
  });

  test('ignores fees, currency, and note when comparing', () => {
    const same = tx({
      id: 't2',
      instrumentId: 'ASX:BHP',
      type: 'BUY',
      quantity: 100,
      price: 40,
      tradeDate: '2024-01-01',
      fees: 99,
      currency: 'USD',
      note: 'different note',
    });
    expect(isDuplicateTransaction(original, same)).toBe(true);
  });

  test('is not a duplicate if the instrument differs', () => {
    const other = tx({ id: 't2', instrumentId: 'NASDAQ:AAPL', type: 'BUY', quantity: 100, price: 40, tradeDate: '2024-01-01' });
    expect(isDuplicateTransaction(original, other)).toBe(false);
  });

  test('is not a duplicate if the date differs', () => {
    const other = tx({ id: 't2', instrumentId: 'ASX:BHP', type: 'BUY', quantity: 100, price: 40, tradeDate: '2024-01-02' });
    expect(isDuplicateTransaction(original, other)).toBe(false);
  });

  test('is not a duplicate if the type differs', () => {
    const other = tx({ id: 't2', instrumentId: 'ASX:BHP', type: 'SELL', quantity: 100, price: 40, tradeDate: '2024-01-01' });
    expect(isDuplicateTransaction(original, other)).toBe(false);
  });

  test('is not a duplicate if the quantity differs', () => {
    const other = tx({ id: 't2', instrumentId: 'ASX:BHP', type: 'BUY', quantity: 50, price: 40, tradeDate: '2024-01-01' });
    expect(isDuplicateTransaction(original, other)).toBe(false);
  });

  test('is not a duplicate if the price differs', () => {
    const other = tx({ id: 't2', instrumentId: 'ASX:BHP', type: 'BUY', quantity: 100, price: 41, tradeDate: '2024-01-01' });
    expect(isDuplicateTransaction(original, other)).toBe(false);
  });
});

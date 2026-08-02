import { describe, expect, test } from 'vitest';
import { InstrumentSchema, PortfolioSchema, TransactionInputSchema } from '../schemas';

describe('TransactionInputSchema', () => {
  const validBuy = {
    id: 't1',
    portfolioId: 'p1',
    instrumentId: 'ASX:BHP',
    type: 'BUY' as const,
    quantity: 100,
    price: 40,
    fees: 10,
    currency: 'AUD',
    tradeDate: '2024-01-01',
  };

  test('accepts a well-formed BUY transaction', () => {
    expect(() => TransactionInputSchema.parse(validBuy)).not.toThrow();
  });

  test('rejects zero or negative quantity for BUY/SELL', () => {
    expect(() => TransactionInputSchema.parse({ ...validBuy, quantity: 0 })).toThrow();
    expect(() => TransactionInputSchema.parse({ ...validBuy, quantity: -5 })).toThrow();
  });

  test('rejects zero or negative price', () => {
    expect(() => TransactionInputSchema.parse({ ...validBuy, price: 0 })).toThrow();
    expect(() => TransactionInputSchema.parse({ ...validBuy, price: -1 })).toThrow();
  });

  test('rejects negative fees', () => {
    expect(() => TransactionInputSchema.parse({ ...validBuy, fees: -1 })).toThrow();
  });

  test('rejects a trade date in the future', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
    expect(() => TransactionInputSchema.parse({ ...validBuy, tradeDate: future })).toThrow();
  });

  test('accepts today as a valid trade date', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(() => TransactionInputSchema.parse({ ...validBuy, tradeDate: today })).not.toThrow();
  });

  test('DIVIDEND requires quantity to be exactly 0', () => {
    const dividend = { ...validBuy, type: 'DIVIDEND' as const, quantity: 0, price: 12 };
    expect(() => TransactionInputSchema.parse(dividend)).not.toThrow();
    expect(() => TransactionInputSchema.parse({ ...dividend, quantity: 5 })).toThrow();
  });

  test('DIVIDEND still requires a positive cash amount', () => {
    expect(() => TransactionInputSchema.parse({ ...validBuy, type: 'DIVIDEND', quantity: 0, price: 0 })).toThrow();
  });
});

describe('PortfolioSchema', () => {
  test('accepts a well-formed portfolio', () => {
    expect(() => PortfolioSchema.parse({ id: 'p1', name: 'Personal', baseCurrency: 'AUD' })).not.toThrow();
  });

  test('rejects an empty name', () => {
    expect(() => PortfolioSchema.parse({ id: 'p1', name: '', baseCurrency: 'AUD' })).toThrow();
  });
});

describe('InstrumentSchema', () => {
  test('accepts a well-formed instrument', () => {
    expect(() =>
      InstrumentSchema.parse({ id: 'ASX:BHP', exchange: 'ASX', currency: 'AUD', name: 'BHP Group Ltd' }),
    ).not.toThrow();
  });

  test('rejects an unrecognised exchange', () => {
    expect(() =>
      InstrumentSchema.parse({ id: 'TSX:SHOP', exchange: 'TSX', currency: 'CAD', name: 'Shopify' }),
    ).toThrow();
  });
});

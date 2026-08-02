import { describe, expect, test } from 'vitest';
import { deriveHoldings, quantityHeldAsOf } from '../holdings';
import type { Transaction } from '../types';

function tx(overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'instrumentId' | 'type' | 'quantity' | 'price' | 'tradeDate'>): Transaction {
  return {
    portfolioId: 'p1',
    fees: 0,
    currency: 'AUD',
    ...overrides,
  };
}

describe('deriveHoldings', () => {
  test('a single buy produces a holding with matching quantity and cost basis', () => {
    const { holdings, warnings } = deriveHoldings([
      tx({ id: 't1', instrumentId: 'ASX:BHP', type: 'BUY', quantity: 100, price: 40, fees: 10, tradeDate: '2024-01-01' }),
    ]);

    expect(warnings).toEqual([]);
    expect(holdings).toEqual([
      { instrumentId: 'ASX:BHP', quantity: 100, avgCostPerShare: 40.1, totalCost: 4010, realizedPnl: 0 },
    ]);
  });

  test('multiple buys produce a quantity-weighted average cost', () => {
    const { holdings } = deriveHoldings([
      tx({ id: 't1', instrumentId: 'ASX:BHP', type: 'BUY', quantity: 100, price: 40, fees: 10, tradeDate: '2024-01-01' }),
      tx({ id: 't2', instrumentId: 'ASX:BHP', type: 'BUY', quantity: 50, price: 42, fees: 5, tradeDate: '2024-01-02' }),
    ]);

    // total cost = 4010 + 2105 = 6115 over 150 shares
    expect(holdings).toEqual([
      { instrumentId: 'ASX:BHP', quantity: 150, avgCostPerShare: 6115 / 150, totalCost: 6115, realizedPnl: 0 },
    ]);
  });

  test('a partial sell reduces quantity, keeps average cost, and accrues realized P/L', () => {
    const { holdings, warnings } = deriveHoldings([
      tx({ id: 't1', instrumentId: 'ASX:BHP', type: 'BUY', quantity: 100, price: 40, fees: 10, tradeDate: '2024-01-01' }),
      tx({ id: 't2', instrumentId: 'ASX:BHP', type: 'BUY', quantity: 50, price: 42, fees: 5, tradeDate: '2024-01-02' }),
      tx({ id: 't3', instrumentId: 'ASX:BHP', type: 'SELL', quantity: 60, price: 45, fees: 8, tradeDate: '2024-01-03' }),
    ]);

    const avgCost = 6115 / 150; // 40.7666...
    const costRemoved = 60 * avgCost;
    const proceeds = 60 * 45 - 8;

    expect(warnings).toEqual([]);
    const bhp = holdings.find((h) => h.instrumentId === 'ASX:BHP')!;
    expect(bhp.quantity).toBe(90);
    expect(bhp.avgCostPerShare).toBeCloseTo(avgCost, 6);
    expect(bhp.totalCost).toBeCloseTo(6115 - costRemoved, 6);
    expect(bhp.realizedPnl).toBeCloseTo(proceeds - costRemoved, 6);
  });

  test('selling the full quantity zeroes out the holding', () => {
    const { holdings, warnings } = deriveHoldings([
      tx({ id: 't1', instrumentId: 'ASX:BHP', type: 'BUY', quantity: 100, price: 40, fees: 10, tradeDate: '2024-01-01' }),
      tx({ id: 't2', instrumentId: 'ASX:BHP', type: 'SELL', quantity: 100, price: 45, fees: 8, tradeDate: '2024-01-02' }),
    ]);

    expect(warnings).toEqual([]);
    const bhp = holdings.find((h) => h.instrumentId === 'ASX:BHP')!;
    expect(bhp.quantity).toBe(0);
    expect(bhp.totalCost).toBeCloseTo(0, 6);
    expect(bhp.avgCostPerShare).toBe(0);
    expect(bhp.realizedPnl).toBeCloseTo(100 * 45 - 8 - 100 * 40.1, 6);
  });

  test('a dividend does not change quantity or cost basis', () => {
    const { holdings, warnings } = deriveHoldings([
      tx({ id: 't1', instrumentId: 'NASDAQ:AAPL', type: 'BUY', quantity: 10, price: 150, fees: 5, tradeDate: '2024-01-01', currency: 'USD' }),
      tx({ id: 't2', instrumentId: 'NASDAQ:AAPL', type: 'DIVIDEND', quantity: 0, price: 0, fees: 0, tradeDate: '2024-02-01', currency: 'USD', note: '12.00 cash dividend' }),
    ]);

    expect(warnings).toEqual([]);
    const aapl = holdings.find((h) => h.instrumentId === 'NASDAQ:AAPL')!;
    expect(aapl.quantity).toBe(10);
    expect(aapl.totalCost).toBeCloseTo(1505, 6);
    expect(aapl.realizedPnl).toBe(0);
  });

  test('a sell exceeding held quantity as-of that date is flagged and not applied', () => {
    const { holdings, warnings } = deriveHoldings([
      tx({ id: 't1', instrumentId: 'SGX:D05', type: 'BUY', quantity: 200, price: 30, fees: 10, tradeDate: '2024-01-01', currency: 'SGD' }),
      tx({ id: 't2', instrumentId: 'SGX:D05', type: 'SELL', quantity: 250, price: 32, fees: 5, tradeDate: '2024-01-02', currency: 'SGD' }),
    ]);

    expect(warnings).toEqual([
      { transactionId: 't2', instrumentId: 'SGX:D05', message: 'Sell quantity 250 exceeds held quantity 200 as of 2024-01-02' },
    ]);
    const dbs = holdings.find((h) => h.instrumentId === 'SGX:D05')!;
    // invalid sell is not applied — holding reflects only the buy
    expect(dbs.quantity).toBe(200);
    expect(dbs.totalCost).toBeCloseTo(6010, 6);
    expect(dbs.realizedPnl).toBe(0);
  });

  test('transactions are applied in trade-date order regardless of array order', () => {
    const { holdings } = deriveHoldings([
      tx({ id: 't2', instrumentId: 'ASX:BHP', type: 'SELL', quantity: 40, price: 45, fees: 0, tradeDate: '2024-01-05' }),
      tx({ id: 't1', instrumentId: 'ASX:BHP', type: 'BUY', quantity: 100, price: 40, fees: 0, tradeDate: '2024-01-01' }),
    ]);

    const bhp = holdings.find((h) => h.instrumentId === 'ASX:BHP')!;
    expect(bhp.quantity).toBe(60);
  });

  test('golden fixture: a realistic multi-currency, multi-exchange transaction history', () => {
    const transactions: Transaction[] = [
      // BHP — ASX, AUD
      tx({ id: 'bhp-1', instrumentId: 'ASX:BHP', type: 'BUY', quantity: 100, price: 40, fees: 10, tradeDate: '2024-01-01', currency: 'AUD' }),
      tx({ id: 'bhp-2', instrumentId: 'ASX:BHP', type: 'BUY', quantity: 50, price: 42, fees: 5, tradeDate: '2024-02-01', currency: 'AUD' }),
      tx({ id: 'bhp-3', instrumentId: 'ASX:BHP', type: 'SELL', quantity: 60, price: 45, fees: 8, tradeDate: '2024-03-01', currency: 'AUD' }),

      // AAPL — NASDAQ, USD
      tx({ id: 'aapl-1', instrumentId: 'NASDAQ:AAPL', type: 'BUY', quantity: 10, price: 150, fees: 5, tradeDate: '2024-01-10', currency: 'USD' }),
      tx({ id: 'aapl-2', instrumentId: 'NASDAQ:AAPL', type: 'SELL', quantity: 4, price: 160, fees: 2, tradeDate: '2024-02-10', currency: 'USD' }),
      tx({ id: 'aapl-3', instrumentId: 'NASDAQ:AAPL', type: 'DIVIDEND', quantity: 0, price: 0, fees: 0, tradeDate: '2024-03-10', currency: 'USD' }),

      // DBS — SGX, SGD — includes an over-sell that must be flagged, not applied
      tx({ id: 'dbs-1', instrumentId: 'SGX:D05', type: 'BUY', quantity: 200, price: 30, fees: 10, tradeDate: '2024-01-15', currency: 'SGD' }),
      tx({ id: 'dbs-2', instrumentId: 'SGX:D05', type: 'SELL', quantity: 250, price: 32, fees: 5, tradeDate: '2024-02-15', currency: 'SGD' }),
    ];

    const { holdings, warnings } = deriveHoldings(transactions);

    // Hand-calculated expectations:
    // BHP: total cost 4010 + 2105 = 6115 / 150 = 40.766667 avg cost.
    //   sell 60 @ 45 fees 8: proceeds 2692, cost removed 60 * 40.766667 = 2446, realized 246.
    //   remaining: qty 90, totalCost 6115 - 2446 = 3669, avgCost unchanged 40.766667.
    const bhpAvgCost = 6115 / 150;
    const bhpCostRemoved = 60 * bhpAvgCost;

    // AAPL: cost 1505 / 10 = 150.5 avg cost.
    //   sell 4 @ 160 fees 2: proceeds 638, cost removed 4 * 150.5 = 602, realized 36.
    //   remaining: qty 6, totalCost 1505 - 602 = 903. Dividend does not change this.
    const aaplCostRemoved = 4 * 150.5;

    // DBS: only the buy applies; the 250-share sell exceeds the 200 held and is flagged.
    expect(warnings).toEqual([
      { transactionId: 'dbs-2', instrumentId: 'SGX:D05', message: 'Sell quantity 250 exceeds held quantity 200 as of 2024-02-15' },
    ]);

    const byId = Object.fromEntries(holdings.map((h) => [h.instrumentId, h]));

    expect(byId['ASX:BHP'].quantity).toBe(90);
    expect(byId['ASX:BHP'].avgCostPerShare).toBeCloseTo(bhpAvgCost, 6);
    expect(byId['ASX:BHP'].totalCost).toBeCloseTo(6115 - bhpCostRemoved, 6);
    expect(byId['ASX:BHP'].realizedPnl).toBeCloseTo(2692 - bhpCostRemoved, 6);

    expect(byId['NASDAQ:AAPL'].quantity).toBe(6);
    expect(byId['NASDAQ:AAPL'].avgCostPerShare).toBeCloseTo(150.5, 6);
    expect(byId['NASDAQ:AAPL'].totalCost).toBeCloseTo(1505 - aaplCostRemoved, 6);
    expect(byId['NASDAQ:AAPL'].realizedPnl).toBeCloseTo(638 - aaplCostRemoved, 6);

    expect(byId['SGX:D05'].quantity).toBe(200);
    expect(byId['SGX:D05'].totalCost).toBeCloseTo(6010, 6);
    expect(byId['SGX:D05'].realizedPnl).toBe(0);
  });
});

describe('quantityHeldAsOf', () => {
  const history: Transaction[] = [
    tx({ id: 't1', instrumentId: 'ASX:BHP', type: 'BUY', quantity: 100, price: 40, tradeDate: '2024-01-01' }),
    tx({ id: 't2', instrumentId: 'ASX:BHP', type: 'BUY', quantity: 50, price: 42, tradeDate: '2024-02-01' }),
    tx({ id: 't3', instrumentId: 'ASX:BHP', type: 'SELL', quantity: 60, price: 45, tradeDate: '2024-03-01' }),
  ];

  test('only counts transactions up to and including the given date', () => {
    expect(quantityHeldAsOf(history, 'ASX:BHP', '2024-01-15')).toBe(100);
    expect(quantityHeldAsOf(history, 'ASX:BHP', '2024-02-01')).toBe(150);
    expect(quantityHeldAsOf(history, 'ASX:BHP', '2024-03-01')).toBe(90);
  });

  test('returns 0 for an instrument with no transactions as of that date', () => {
    expect(quantityHeldAsOf(history, 'ASX:BHP', '2023-12-31')).toBe(0);
    expect(quantityHeldAsOf(history, 'NASDAQ:AAPL', '2024-03-01')).toBe(0);
  });

  test('excludes a transaction by id, so an in-place edit can be validated against its own prior state', () => {
    expect(quantityHeldAsOf(history, 'ASX:BHP', '2024-03-01', 't3')).toBe(150);
  });
});

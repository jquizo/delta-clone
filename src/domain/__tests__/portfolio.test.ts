import { describe, expect, test } from 'vitest';
import { summarise } from '../portfolio';
import type { FxRate, Holding, PriceQuote } from '../types';

function holding(overrides: Partial<Holding> & Pick<Holding, 'instrumentId'>): Holding {
  return { quantity: 0, avgCostPerShare: 0, totalCost: 0, realizedPnl: 0, ...overrides };
}

function quote(overrides: Partial<PriceQuote> & Pick<PriceQuote, 'instrumentId' | 'currency'>): PriceQuote {
  return { price: 0, previousClose: 0, marketState: 'CLOSED', asOf: 1, ...overrides };
}

describe('summarise', () => {
  test('a single AUD holding rolls up with no conversion needed', () => {
    const holdings = [holding({ instrumentId: 'ASX:BHP', quantity: 100, avgCostPerShare: 40, totalCost: 4000 })];
    const quotes = [quote({ instrumentId: 'ASX:BHP', currency: 'AUD', price: 45, previousClose: 44 })];

    const summary = summarise(holdings, quotes, [], 'AUD');

    expect(summary.totalValue).toBeCloseTo(4500, 6); // 100 * 45
    expect(summary.totalCost).toBeCloseTo(4000, 6);
    expect(summary.unrealizedPnl).toBeCloseTo(500, 6);
    expect(summary.dayChangeValue).toBeCloseTo(100, 6); // 100 * (45 - 44)
    expect(summary.hasMissingData).toBe(false);
  });

  test('converts a foreign-currency holding into the base currency using the given rates', () => {
    const holdings = [holding({ instrumentId: 'NASDAQ:AAPL', quantity: 10, avgCostPerShare: 150, totalCost: 1500 })];
    const quotes = [quote({ instrumentId: 'NASDAQ:AAPL', currency: 'USD', price: 160, previousClose: 155 })];
    const rates: FxRate[] = [{ pair: 'USDAUD', rate: 1.5, asOf: 1, source: 'yahoo' }];

    const summary = summarise(holdings, quotes, rates, 'AUD');

    expect(summary.totalValue).toBeCloseTo(10 * 160 * 1.5, 6);
    expect(summary.totalCost).toBeCloseTo(1500 * 1.5, 6);
    expect(summary.unrealizedPnl).toBeCloseTo((1600 - 1500) * 1.5, 6);
    expect(summary.dayChangeValue).toBeCloseTo(10 * (160 - 155) * 1.5, 6);
    expect(summary.hasMissingData).toBe(false);
  });

  test('rolls up a multi-currency, multi-holding portfolio into one coherent base-currency total', () => {
    const holdings = [
      holding({ instrumentId: 'ASX:BHP', quantity: 100, avgCostPerShare: 40, totalCost: 4000 }),
      holding({ instrumentId: 'NASDAQ:AAPL', quantity: 10, avgCostPerShare: 150, totalCost: 1500 }),
      holding({ instrumentId: 'SGX:D05', quantity: 200, avgCostPerShare: 30, totalCost: 6000 }),
    ];
    const quotes = [
      quote({ instrumentId: 'ASX:BHP', currency: 'AUD', price: 45, previousClose: 44 }),
      quote({ instrumentId: 'NASDAQ:AAPL', currency: 'USD', price: 160, previousClose: 155 }),
      quote({ instrumentId: 'SGX:D05', currency: 'SGD', price: 32, previousClose: 31 }),
    ];
    const rates: FxRate[] = [
      { pair: 'USDAUD', rate: 1.5, asOf: 1, source: 'yahoo' },
      { pair: 'SGDAUD', rate: 1.1, asOf: 1, source: 'yahoo' },
    ];

    const summary = summarise(holdings, quotes, rates, 'AUD');

    const bhpValue = 100 * 45;
    const aaplValue = 10 * 160 * 1.5;
    const dbsValue = 200 * 32 * 1.1;
    expect(summary.totalValue).toBeCloseTo(bhpValue + aaplValue + dbsValue, 6);
    expect(summary.hasMissingData).toBe(false);
  });

  test('a fully-sold (zero quantity) holding contributes nothing and is not treated as missing data', () => {
    const holdings = [holding({ instrumentId: 'ASX:BHP', quantity: 0, avgCostPerShare: 0, totalCost: 0, realizedPnl: 500 })];

    const summary = summarise(holdings, [], [], 'AUD');

    expect(summary.totalValue).toBe(0);
    expect(summary.hasMissingData).toBe(false);
  });

  test('a missing quote flags hasMissingData and excludes that holding from the totals', () => {
    const holdings = [
      holding({ instrumentId: 'ASX:BHP', quantity: 100, avgCostPerShare: 40, totalCost: 4000 }),
      holding({ instrumentId: 'NASDAQ:AAPL', quantity: 10, avgCostPerShare: 150, totalCost: 1500 }),
    ];
    const quotes = [quote({ instrumentId: 'ASX:BHP', currency: 'AUD', price: 45, previousClose: 44 })];

    const summary = summarise(holdings, quotes, [], 'AUD');

    expect(summary.hasMissingData).toBe(true);
    expect(summary.totalValue).toBeCloseTo(4500, 6); // only the priced BHP holding
  });

  test('a missing FX rate flags hasMissingData rather than silently treating the rate as 1', () => {
    const holdings = [holding({ instrumentId: 'NASDAQ:AAPL', quantity: 10, avgCostPerShare: 150, totalCost: 1500 })];
    const quotes = [quote({ instrumentId: 'NASDAQ:AAPL', currency: 'USD', price: 160, previousClose: 155 })];

    const summary = summarise(holdings, quotes, [], 'AUD'); // no USDAUD rate available

    expect(summary.hasMissingData).toBe(true);
    expect(summary.totalValue).toBe(undefined);
  });

  test('with no priced holdings at all, every total is undefined rather than 0', () => {
    const holdings = [holding({ instrumentId: 'NASDAQ:AAPL', quantity: 10, avgCostPerShare: 150, totalCost: 1500 })];

    const summary = summarise(holdings, [], [], 'AUD');

    expect(summary.totalValue).toBeUndefined();
    expect(summary.totalCost).toBeUndefined();
    expect(summary.unrealizedPnl).toBeUndefined();
    expect(summary.dayChangeValue).toBeUndefined();
    expect(summary.dayChangePercent).toBeUndefined();
    expect(summary.hasMissingData).toBe(true);
  });
});

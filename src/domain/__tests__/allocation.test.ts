import { describe, expect, test } from 'vitest';
import { groupAllocation } from '../allocation';
import type { Holding, PriceQuote } from '../types';

function holding(overrides: Partial<Holding> & Pick<Holding, 'instrumentId'>): Holding {
  return { quantity: 0, avgCostPerShare: 0, totalCost: 0, realizedPnl: 0, ...overrides };
}

function quote(overrides: Partial<PriceQuote> & Pick<PriceQuote, 'instrumentId' | 'currency'>): PriceQuote {
  return { price: 0, previousClose: 0, marketState: 'CLOSED', asOf: 1, ...overrides };
}

describe('groupAllocation', () => {
  const holdings = [
    holding({ instrumentId: 'ASX:BHP', quantity: 100 }),
    holding({ instrumentId: 'NASDAQ:AAPL', quantity: 10 }),
    holding({ instrumentId: 'LSE:VOD', quantity: 50 }),
  ];
  const quotes = [
    quote({ instrumentId: 'ASX:BHP', currency: 'AUD', price: 45 }), // 4500
    quote({ instrumentId: 'NASDAQ:AAPL', currency: 'USD', price: 160 }), // 1600
    quote({ instrumentId: 'LSE:VOD', currency: 'GBP', price: 2 }), // 100
  ];
  const rates = [
    { pair: 'USDAUD', rate: 1.5, asOf: 1, source: 'yahoo' as const }, // 1600 USD -> 2400 AUD
    { pair: 'GBPAUD', rate: 2, asOf: 1, source: 'yahoo' as const }, // 100 GBP -> 200 AUD
  ];

  test('groups by holding, one slice per instrument, value in base currency', () => {
    const result = groupAllocation(holdings, quotes, rates, 'AUD', 'holding');
    const byLabel = Object.fromEntries(result.map((r) => [r.label, r.value]));

    expect(byLabel['ASX:BHP']).toBeCloseTo(4500, 6);
    expect(byLabel['NASDAQ:AAPL']).toBeCloseTo(2400, 6);
    expect(byLabel['LSE:VOD']).toBeCloseTo(200, 6);
  });

  test('groups by exchange, summing instruments on the same exchange', () => {
    const result = groupAllocation(holdings, quotes, rates, 'AUD', 'exchange');
    const byLabel = Object.fromEntries(result.map((r) => [r.label, r.value]));

    expect(Object.keys(byLabel).sort()).toEqual(['ASX', 'LSE', 'NASDAQ']);
    expect(byLabel.ASX).toBeCloseTo(4500, 6);
  });

  test('groups by currency, summing instruments in the same native currency', () => {
    const result = groupAllocation(holdings, quotes, rates, 'AUD', 'currency');
    const byLabel = Object.fromEntries(result.map((r) => [r.label, r.value]));

    expect(byLabel.AUD).toBeCloseTo(4500, 6);
    expect(byLabel.USD).toBeCloseTo(2400, 6);
    expect(byLabel.GBP).toBeCloseTo(200, 6);
  });

  test('excludes a holding with no quote or no fx path, rather than crashing or showing it as 0', () => {
    const incompleteRates = [{ pair: 'USDAUD', rate: 1.5, asOf: 1, source: 'yahoo' as const }]; // missing GBPAUD
    const result = groupAllocation(holdings, quotes, incompleteRates, 'AUD', 'holding');
    expect(result.map((r) => r.label)).not.toContain('LSE:VOD');
  });

  test('returns an empty array for a portfolio with no priceable holdings', () => {
    expect(groupAllocation([], [], [], 'AUD', 'holding')).toEqual([]);
  });
});

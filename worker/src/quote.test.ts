import { describe, expect, test } from 'vitest';
import { normaliseYahooMeta, parseSymbolsParam } from './quote';

describe('parseSymbolsParam', () => {
  test('splits a comma-separated list and trims whitespace', () => {
    expect(parseSymbolsParam('BHP.AX, AAPL, D05.SI')).toEqual(['BHP.AX', 'AAPL', 'D05.SI']);
  });

  test('drops empty entries', () => {
    expect(parseSymbolsParam('BHP.AX,,AAPL,')).toEqual(['BHP.AX', 'AAPL']);
  });

  test('returns an empty array for a missing or blank param', () => {
    expect(parseSymbolsParam(null)).toEqual([]);
    expect(parseSymbolsParam('')).toEqual([]);
  });
});

describe('normaliseYahooMeta', () => {
  test('extracts a normalised quote from a well-formed chart meta object', () => {
    const meta = {
      regularMarketPrice: 45.12,
      currency: 'AUD',
      chartPreviousClose: 44.8,
      marketState: 'REGULAR',
      regularMarketTime: 1700000000,
    };

    expect(normaliseYahooMeta('BHP.AX', meta)).toEqual({
      symbol: 'BHP.AX',
      price: 45.12,
      currency: 'AUD',
      previousClose: 44.8,
      marketState: 'OPEN',
      asOf: 1700000000000,
    });
  });

  test('maps Yahoo market states to the app’s OPEN/CLOSED/PRE/POST vocabulary', () => {
    const base = { regularMarketPrice: 1, currency: 'USD', chartPreviousClose: 1, regularMarketTime: 1 };
    expect(normaliseYahooMeta('X', { ...base, marketState: 'REGULAR' })?.marketState).toBe('OPEN');
    expect(normaliseYahooMeta('X', { ...base, marketState: 'PRE' })?.marketState).toBe('PRE');
    expect(normaliseYahooMeta('X', { ...base, marketState: 'POST' })?.marketState).toBe('POST');
    expect(normaliseYahooMeta('X', { ...base, marketState: 'CLOSED' })?.marketState).toBe('CLOSED');
    expect(normaliseYahooMeta('X', { ...base, marketState: 'PREPRE' })?.marketState).toBe('CLOSED');
  });

  test('falls back to previousClose field and current time when chartPreviousClose or regularMarketTime are absent', () => {
    const before = Date.now();
    const result = normaliseYahooMeta('X', {
      regularMarketPrice: 10,
      currency: 'USD',
      previousClose: 9.5,
      marketState: 'CLOSED',
    });
    const after = Date.now();

    expect(result?.previousClose).toBe(9.5);
    expect(result?.asOf).toBeGreaterThanOrEqual(before);
    expect(result?.asOf).toBeLessThanOrEqual(after);
  });

  test('returns null when the meta is missing a usable price', () => {
    expect(normaliseYahooMeta('X', {})).toBeNull();
    expect(normaliseYahooMeta('X', null)).toBeNull();
    expect(normaliseYahooMeta('X', { regularMarketPrice: 'not-a-number' })).toBeNull();
  });
});

import { describe, expect, test } from 'vitest';
import { normaliseYahooFxMeta } from './fx';

describe('normaliseYahooFxMeta', () => {
  test('extracts pair, rate, and asOf from a well-formed FX chart meta object', () => {
    const meta = { regularMarketPrice: 1.4428, regularMarketTime: 1783916826 };
    expect(normaliseYahooFxMeta('USDAUD', meta)).toEqual({ pair: 'USDAUD', rate: 1.4428, asOf: 1783916826000 });
  });

  test('falls back to the current time when regularMarketTime is absent', () => {
    const before = Date.now();
    const result = normaliseYahooFxMeta('USDAUD', { regularMarketPrice: 1.4428 });
    const after = Date.now();

    expect(result?.rate).toBe(1.4428);
    expect(result?.asOf).toBeGreaterThanOrEqual(before);
    expect(result?.asOf).toBeLessThanOrEqual(after);
  });

  test('returns null when the meta is missing a usable rate', () => {
    expect(normaliseYahooFxMeta('USDAUD', {})).toBeNull();
    expect(normaliseYahooFxMeta('USDAUD', null)).toBeNull();
    expect(normaliseYahooFxMeta('USDAUD', { regularMarketPrice: 'not-a-number' })).toBeNull();
  });
});

import { describe, expect, test } from 'vitest';
import { convert, formatMoney, resolveFxRateToBase } from '../money';
import type { FxRate } from '../types';

describe('resolveFxRateToBase', () => {
  test('same-currency transactions always resolve to 1, unflagged', () => {
    expect(resolveFxRateToBase('AUD', 'AUD', undefined)).toEqual({ fxRateToBase: 1, fxRateFlagged: false });
    expect(resolveFxRateToBase('AUD', 'AUD', 1.37)).toEqual({ fxRateToBase: 1, fxRateFlagged: false });
  });

  test('uses the cached rate, unflagged, when one is available', () => {
    expect(resolveFxRateToBase('USD', 'AUD', 1.52)).toEqual({ fxRateToBase: 1.52, fxRateFlagged: false });
  });

  test('falls back to 1 and flags for correction when no cached rate is available', () => {
    expect(resolveFxRateToBase('USD', 'AUD', undefined)).toEqual({ fxRateToBase: 1, fxRateFlagged: true });
  });
});

function rate(pair: string, value: number): FxRate {
  return { pair, rate: value, asOf: 1, source: 'yahoo' };
}

describe('convert', () => {
  test('returns the amount unchanged when converting a currency to itself', () => {
    expect(convert(100, 'AUD', 'AUD', [])).toBe(100);
  });

  test('converts using a direct rate', () => {
    const rates = [rate('USDAUD', 1.5)];
    expect(convert(100, 'USD', 'AUD', rates)).toBeCloseTo(150, 6);
  });

  test('converts using the inverse of a rate when only the opposite direction is cached', () => {
    const rates = [rate('USDAUD', 1.5)];
    expect(convert(150, 'AUD', 'USD', rates)).toBeCloseTo(100, 6);
  });

  test('pivots through a common currency when no direct or inverse rate exists', () => {
    // USD->AUD and GBP->AUD are both known; converting USD->GBP must pivot through AUD.
    const rates = [rate('USDAUD', 1.5), rate('GBPAUD', 2)];
    // 100 USD -> 150 AUD -> 75 GBP
    expect(convert(100, 'USD', 'GBP', rates)).toBeCloseTo(75, 6);
  });

  test('round-trips: converting out and back returns the original amount', () => {
    const rates = [rate('USDAUD', 1.4428)];
    const converted = convert(100, 'USD', 'AUD', rates);
    expect(converted).toBeDefined();
    const roundTripped = convert(converted!, 'AUD', 'USD', rates);
    expect(roundTripped).toBeCloseTo(100, 6);
  });

  test('returns undefined when no rate path exists, rather than silently returning 0', () => {
    const rates = [rate('USDAUD', 1.5)];
    expect(convert(100, 'USD', 'JPY', rates)).toBeUndefined();
    expect(convert(100, 'JPY', 'USD', [])).toBeUndefined();
  });
});

const NBSP = ' ';

describe('formatMoney', () => {
  test('formats AUD with its native symbol, thousands separator, and two decimal places', () => {
    expect(formatMoney(1234.5, 'AUD')).toBe('$1,234.50');
  });

  test('formats a "foreign" currency (relative to the en-AU locale) with its ISO code, not a possibly-ambiguous symbol', () => {
    expect(formatMoney(1234.5, 'USD')).toBe(`USD${NBSP}1,234.50`);
    expect(formatMoney(1234.5, 'GBP')).toBe(`GBP${NBSP}1,234.50`);
    expect(formatMoney(1234.5, 'SGD')).toBe(`SGD${NBSP}1,234.50`);
  });

  test('rounds to two decimal places', () => {
    expect(formatMoney(70.789, 'SGD')).toBe(`SGD${NBSP}70.79`);
  });

  test('formats negative amounts', () => {
    expect(formatMoney(-500, 'GBP')).toBe(`-GBP${NBSP}500.00`);
  });

  test('formats zero', () => {
    expect(formatMoney(0, 'AUD')).toBe('$0.00');
  });

  test('falls back to a plain number with the currency code when given an unrecognised currency', () => {
    expect(formatMoney(100, 'NOT_A_CODE')).toBe('100.00 NOT_A_CODE');
  });
});

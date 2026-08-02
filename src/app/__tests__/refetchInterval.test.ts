import { describe, expect, test } from 'vitest';
import { computeQuotesRefetchInterval } from '../refetchInterval';

describe('computeQuotesRefetchInterval', () => {
  test('polls when at least one instrument is on a market that is currently open', () => {
    // 2026-01-14 14:30 UTC = 09:30 EST — NASDAQ is open.
    const now = new Date(Date.UTC(2026, 0, 14, 14, 30));
    expect(computeQuotesRefetchInterval(['ASX:BHP', 'NASDAQ:AAPL'], now)).toBe(60_000);
  });

  test('does not poll when every instrument is on a closed market', () => {
    // 2026-01-17 is a Saturday — every exchange is closed regardless of time of day.
    const now = new Date(Date.UTC(2026, 0, 17, 14, 30));
    expect(computeQuotesRefetchInterval(['ASX:BHP', 'NASDAQ:AAPL'], now)).toBe(false);
  });

  test('does not poll when given no instruments', () => {
    expect(computeQuotesRefetchInterval([], new Date())).toBe(false);
  });
});

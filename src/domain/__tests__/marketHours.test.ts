import { describe, expect, test } from 'vitest';
import { isMarketOpen } from '../marketHours';

describe('isMarketOpen', () => {
  describe('NASDAQ (09:30–16:00 New York)', () => {
    test('is open exactly at the 09:30 open (EST, winter)', () => {
      expect(isMarketOpen('NASDAQ', new Date(Date.UTC(2026, 0, 14, 14, 30)))).toBe(true);
    });

    test('is closed one minute before open', () => {
      expect(isMarketOpen('NASDAQ', new Date(Date.UTC(2026, 0, 14, 14, 29)))).toBe(false);
    });

    test('is open one minute before close', () => {
      expect(isMarketOpen('NASDAQ', new Date(Date.UTC(2026, 0, 14, 20, 59)))).toBe(true);
    });

    test('is closed exactly at the 16:00 close (close boundary is exclusive)', () => {
      expect(isMarketOpen('NASDAQ', new Date(Date.UTC(2026, 0, 14, 21, 0)))).toBe(false);
    });

    test('is open at 09:30 in summer (EDT) — the same wall-clock time as winter, different UTC offset', () => {
      expect(isMarketOpen('NASDAQ', new Date(Date.UTC(2026, 6, 8, 13, 30)))).toBe(true);
    });

    test('is closed on a Saturday even during normal session hours', () => {
      // 2026-01-17 is a Saturday; 14:30 UTC is 09:30 EST.
      expect(isMarketOpen('NASDAQ', new Date(Date.UTC(2026, 0, 17, 14, 30)))).toBe(false);
    });
  });

  describe('NYSE (09:30–16:00 New York)', () => {
    test('is open exactly at the 09:30 open (EST, winter)', () => {
      expect(isMarketOpen('NYSE', new Date(Date.UTC(2026, 0, 14, 14, 30)))).toBe(true);
    });

    test('is closed one minute before open', () => {
      expect(isMarketOpen('NYSE', new Date(Date.UTC(2026, 0, 14, 14, 29)))).toBe(false);
    });

    test('is closed exactly at the 16:00 close (close boundary is exclusive)', () => {
      expect(isMarketOpen('NYSE', new Date(Date.UTC(2026, 0, 14, 21, 0)))).toBe(false);
    });

    test('is open at 09:30 in summer (EDT) — the same wall-clock time as winter, different UTC offset', () => {
      expect(isMarketOpen('NYSE', new Date(Date.UTC(2026, 6, 8, 13, 30)))).toBe(true);
    });

    test('is closed on a Saturday even during normal session hours', () => {
      expect(isMarketOpen('NYSE', new Date(Date.UTC(2026, 0, 17, 14, 30)))).toBe(false);
    });
  });

  describe('ARCA / NYSE Arca (09:30–16:00 New York, same session as NYSE)', () => {
    test('is open exactly at the 09:30 open (EST, winter)', () => {
      expect(isMarketOpen('ARCA', new Date(Date.UTC(2026, 0, 14, 14, 30)))).toBe(true);
    });

    test('is closed one minute before open', () => {
      expect(isMarketOpen('ARCA', new Date(Date.UTC(2026, 0, 14, 14, 29)))).toBe(false);
    });

    test('is closed exactly at the 16:00 close (close boundary is exclusive)', () => {
      expect(isMarketOpen('ARCA', new Date(Date.UTC(2026, 0, 14, 21, 0)))).toBe(false);
    });

    test('is closed on a Saturday even during normal session hours', () => {
      expect(isMarketOpen('ARCA', new Date(Date.UTC(2026, 0, 17, 14, 30)))).toBe(false);
    });
  });

  describe('OTC (09:30–16:00 New York, same session as NYSE)', () => {
    test('is open exactly at the 09:30 open (EST, winter)', () => {
      expect(isMarketOpen('OTC', new Date(Date.UTC(2026, 0, 14, 14, 30)))).toBe(true);
    });

    test('is closed one minute before open', () => {
      expect(isMarketOpen('OTC', new Date(Date.UTC(2026, 0, 14, 14, 29)))).toBe(false);
    });

    test('is closed exactly at the 16:00 close (close boundary is exclusive)', () => {
      expect(isMarketOpen('OTC', new Date(Date.UTC(2026, 0, 14, 21, 0)))).toBe(false);
    });

    test('is closed on a Saturday even during normal session hours', () => {
      expect(isMarketOpen('OTC', new Date(Date.UTC(2026, 0, 17, 14, 30)))).toBe(false);
    });
  });

  describe('ASX (10:00–16:00 Sydney)', () => {
    test('is open at the 10:00 open in southern-hemisphere winter (AEST, UTC+10)', () => {
      expect(isMarketOpen('ASX', new Date(Date.UTC(2026, 6, 8, 0, 0)))).toBe(true);
    });

    test('is open at the 10:00 open in southern-hemisphere summer (AEDT, UTC+11)', () => {
      expect(isMarketOpen('ASX', new Date(Date.UTC(2026, 0, 14, 23, 0)))).toBe(true);
    });

    test('is closed at 16:00 close (exclusive)', () => {
      // 2026-07-08 06:00 UTC = 16:00 AEST.
      expect(isMarketOpen('ASX', new Date(Date.UTC(2026, 6, 8, 6, 0)))).toBe(false);
    });
  });

  describe('LSE (08:00–16:30 London)', () => {
    test('is open at the 08:00 open in winter (GMT)', () => {
      expect(isMarketOpen('LSE', new Date(Date.UTC(2026, 0, 14, 8, 0)))).toBe(true);
    });

    test('is open at the 08:00 open in summer (BST, UTC+1) — same wall clock, different offset', () => {
      expect(isMarketOpen('LSE', new Date(Date.UTC(2026, 6, 8, 7, 0)))).toBe(true);
    });

    test('is closed at 16:30 close (exclusive)', () => {
      // 2026-01-14 16:30 GMT = 16:30 UTC.
      expect(isMarketOpen('LSE', new Date(Date.UTC(2026, 0, 14, 16, 30)))).toBe(false);
    });
  });

  describe('SGX (09:00–17:00 Singapore, no DST)', () => {
    test('is open at the 09:00 open', () => {
      expect(isMarketOpen('SGX', new Date(Date.UTC(2026, 6, 8, 1, 0)))).toBe(true);
    });

    test('is closed at 17:00 close (exclusive)', () => {
      expect(isMarketOpen('SGX', new Date(Date.UTC(2026, 6, 8, 9, 0)))).toBe(false);
    });

    test('is closed outside session hours, e.g. midnight Singapore time', () => {
      expect(isMarketOpen('SGX', new Date(Date.UTC(2026, 6, 7, 16, 0)))).toBe(false);
    });
  });

  describe('SBF / Euronext Paris (09:00–17:30 Paris)', () => {
    test('is open at the 09:00 open in winter (CET, UTC+1)', () => {
      expect(isMarketOpen('SBF', new Date(Date.UTC(2026, 0, 14, 8, 0)))).toBe(true);
    });

    test('is open at the 09:00 open in summer (CEST, UTC+2) — same wall clock, different offset', () => {
      expect(isMarketOpen('SBF', new Date(Date.UTC(2026, 6, 8, 7, 0)))).toBe(true);
    });

    test('is closed at 17:30 close (exclusive)', () => {
      expect(isMarketOpen('SBF', new Date(Date.UTC(2026, 0, 14, 16, 30)))).toBe(false);
    });

    test('is closed on a Saturday even during normal session hours', () => {
      expect(isMarketOpen('SBF', new Date(Date.UTC(2026, 0, 17, 8, 0)))).toBe(false);
    });
  });

  describe('OSE / Oslo Børs (09:00–16:20 Oslo)', () => {
    test('is open at the 09:00 open in winter (CET, UTC+1)', () => {
      expect(isMarketOpen('OSE', new Date(Date.UTC(2026, 0, 14, 8, 0)))).toBe(true);
    });

    test('is open at the 09:00 open in summer (CEST, UTC+2) — same wall clock, different offset', () => {
      expect(isMarketOpen('OSE', new Date(Date.UTC(2026, 6, 8, 7, 0)))).toBe(true);
    });

    test('is closed at 16:20 close (exclusive)', () => {
      expect(isMarketOpen('OSE', new Date(Date.UTC(2026, 0, 14, 15, 20)))).toBe(false);
    });

    test('is closed on a Saturday even during normal session hours', () => {
      expect(isMarketOpen('OSE', new Date(Date.UTC(2026, 0, 17, 8, 0)))).toBe(false);
    });
  });
});

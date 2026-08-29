import type { Exchange } from './types';

const EXCHANGE_TIMEZONE: Record<Exchange, string> = {
  ASX: 'Australia/Sydney',
  NASDAQ: 'America/New_York',
  NYSE: 'America/New_York',
  ARCA: 'America/New_York',
  LSE: 'Europe/London',
  SGX: 'Asia/Singapore',
  OTC: 'America/New_York',
  SBF: 'Europe/Paris',
  OSE: 'Europe/Oslo',
};

interface Session {
  openMinutes: number;
  closeMinutes: number;
}

const EXCHANGE_SESSION: Record<Exchange, Session> = {
  ASX: { openMinutes: 10 * 60, closeMinutes: 16 * 60 },
  NASDAQ: { openMinutes: 9 * 60 + 30, closeMinutes: 16 * 60 },
  NYSE: { openMinutes: 9 * 60 + 30, closeMinutes: 16 * 60 },
  ARCA: { openMinutes: 9 * 60 + 30, closeMinutes: 16 * 60 },
  LSE: { openMinutes: 8 * 60, closeMinutes: 16 * 60 + 30 },
  SGX: { openMinutes: 9 * 60, closeMinutes: 17 * 60 },
  OTC: { openMinutes: 9 * 60 + 30, closeMinutes: 16 * 60 },
  SBF: { openMinutes: 9 * 60, closeMinutes: 17 * 60 + 30 },
  OSE: { openMinutes: 9 * 60, closeMinutes: 16 * 60 + 20 },
};

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function localWeekdayAndMinutes(date: Date, timeZone: string): { weekday: number; minutesSinceMidnight: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const weekdayStr = parts.find((p) => p.type === 'weekday')!.value;
  const hour = Number(parts.find((p) => p.type === 'hour')!.value);
  const minute = Number(parts.find((p) => p.type === 'minute')!.value);

  return { weekday: WEEKDAY_INDEX[weekdayStr], minutesSinceMidnight: hour * 60 + minute };
}

/**
 * Whether `exchange` is in its regular trading session at `date` (any instant
 * in time), using each exchange's local wall-clock hours. DST is handled by
 * Intl's timezone database, not hard-coded UTC offsets. Weekends are always
 * closed; public holidays are not accounted for yet.
 */
export function isMarketOpen(exchange: Exchange, date: Date): boolean {
  const { weekday, minutesSinceMidnight } = localWeekdayAndMinutes(date, EXCHANGE_TIMEZONE[exchange]);

  if (weekday === 0 || weekday === 6) return false;

  const { openMinutes, closeMinutes } = EXCHANGE_SESSION[exchange];
  return minutesSinceMidnight >= openMinutes && minutesSinceMidnight < closeMinutes;
}

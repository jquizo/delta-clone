import { describe, expect, test } from 'vitest';
import { formatRelativeTime } from '../formatRelativeTime';

describe('formatRelativeTime', () => {
  test('renders "just now" for anything under a minute', () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    expect(formatRelativeTime(now - 30_000, now)).toBe('just now');
  });

  test('renders whole minutes for under an hour', () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(formatRelativeTime(now - 59 * 60_000, now)).toBe('59 min ago');
  });

  test('renders whole hours for under a day', () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    expect(formatRelativeTime(now - 60 * 60_000, now)).toBe('1 hr ago');
    expect(formatRelativeTime(now - 23 * 60 * 60_000, now)).toBe('23 hr ago');
  });

  test('renders whole days beyond that', () => {
    const now = Date.UTC(2026, 0, 5, 12, 0, 0);
    expect(formatRelativeTime(now - 24 * 60 * 60_000, now)).toBe('1 d ago');
    expect(formatRelativeTime(now - 3 * 24 * 60 * 60_000, now)).toBe('3 d ago');
  });
});

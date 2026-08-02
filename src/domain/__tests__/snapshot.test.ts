import { describe, expect, test } from 'vitest';
import { shouldWriteDailySnapshot } from '../snapshot';

describe('shouldWriteDailySnapshot', () => {
  test('writes when there is no snapshot yet today and quotes are fresh', () => {
    expect(shouldWriteDailySnapshot({ hasSnapshotForToday: false, quotesAreFresh: true })).toBe(true);
  });

  test('does not write again once today already has a snapshot', () => {
    expect(shouldWriteDailySnapshot({ hasSnapshotForToday: true, quotesAreFresh: true })).toBe(false);
  });

  test('does not write from stale or incomplete quotes, even if today has no snapshot yet', () => {
    expect(shouldWriteDailySnapshot({ hasSnapshotForToday: false, quotesAreFresh: false })).toBe(false);
  });
});

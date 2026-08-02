import { describe, expect, test } from 'vitest';
import { parseHistoryResponse } from './history';

describe('parseHistoryResponse', () => {
  test('pairs timestamps with closes into date/close points', () => {
    const json = {
      chart: {
        result: [
          {
            timestamp: [1781481600, 1781568000],
            indicators: { quote: [{ close: [65.18, 65.19] }] },
          },
        ],
      },
    };

    expect(parseHistoryResponse(json)).toEqual([
      { date: '2026-06-15', close: 65.18 },
      { date: '2026-06-16', close: 65.19 },
    ]);
  });

  test('skips days with a null close (e.g. a market holiday)', () => {
    const json = {
      chart: {
        result: [
          {
            timestamp: [1781481600, 1781568000, 1781654400],
            indicators: { quote: [{ close: [65.18, null, 65.59] }] },
          },
        ],
      },
    };

    expect(parseHistoryResponse(json)).toEqual([
      { date: '2026-06-15', close: 65.18 },
      { date: '2026-06-17', close: 65.59 },
    ]);
  });

  test('returns an empty array when the response has no result', () => {
    expect(parseHistoryResponse({ chart: { result: [] } })).toEqual([]);
    expect(parseHistoryResponse({ chart: { result: null } })).toEqual([]);
    expect(parseHistoryResponse(null)).toEqual([]);
  });

  test('returns an empty array when timestamp or close arrays are missing', () => {
    expect(parseHistoryResponse({ chart: { result: [{}] } })).toEqual([]);
    expect(
      parseHistoryResponse({ chart: { result: [{ timestamp: [1781481600], indicators: {} }] } }),
    ).toEqual([]);
  });
});

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useHistory } from '../queries';
import { db } from '../../data/db';
import { priceHistoryRepo } from '../../data/repositories';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(async () => {
  await db.priceHistory.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useHistory', () => {
  test('fetches from the worker and caches the result when nothing is cached yet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => [{ date: '2026-01-01', close: 40 }],
      })),
    );

    const { result } = renderHook(() => useHistory('ASX:BHP', '6M'), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([{ date: '2026-01-01', close: 40 }]);

    const cached = await priceHistoryRepo.getCached('ASX:BHP', '6M');
    expect(cached).toEqual([{ date: '2026-01-01', close: 40 }]);
  });

  test('serves from the cache without fetching when a fresh entry already exists', async () => {
    await priceHistoryRepo.save('ASX:BHP', '6M', [{ date: '2026-01-01', close: 40 }]);

    let called = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        called = true;
        return { ok: true, json: async () => [] };
      }),
    );

    const { result } = renderHook(() => useHistory('ASX:BHP', '6M'), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([{ date: '2026-01-01', close: 40 }]);
    expect(called).toBe(false);
  });
});

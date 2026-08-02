import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useQuotes } from '../queries';
import { db } from '../../data/db';
import { quotesCacheRepo } from '../../data/repositories';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(async () => {
  await db.quotesCache.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useQuotes', () => {
  test('on success, persists the fetched quotes to the cache and reports isStale: false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => [{ symbol: 'BHP.AX', price: 45.12, currency: 'AUD', previousClose: 44.8, marketState: 'OPEN', asOf: 1 }],
      })),
    );

    const { result } = renderHook(() => useQuotes(['ASX:BHP']), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([
      { instrumentId: 'ASX:BHP', price: 45.12, currency: 'AUD', previousClose: 44.8, marketState: 'OPEN', asOf: 1 },
    ]);
    expect(result.current.isStale).toBe(false);

    const cached = await quotesCacheRepo.getQuotes(['ASX:BHP']);
    expect(cached).toHaveLength(1);
    expect(cached[0].price).toBe(45.12);
  });

  test('on provider failure, hydrates from the cache and reports isStale: true', async () => {
    await quotesCacheRepo.saveQuotes([
      { instrumentId: 'ASX:BHP', price: 40, currency: 'AUD', previousClose: 39.5, marketState: 'CLOSED', asOf: 123 },
    ]);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
    );

    const { result } = renderHook(() => useQuotes(['ASX:BHP']), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([
      { instrumentId: 'ASX:BHP', price: 40, currency: 'AUD', previousClose: 39.5, marketState: 'CLOSED', asOf: 123 },
    ]);
    expect(result.current.isStale).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  test('on provider failure with nothing cached, surfaces the error rather than pretending to succeed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
    );

    const { result } = renderHook(() => useQuotes(['ASX:BHP']), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

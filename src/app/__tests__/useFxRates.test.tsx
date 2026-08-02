import { afterEach, describe, expect, test, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFxRates } from '../queries';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useFxRates', () => {
  test('uses Yahoo (via the worker) when it succeeds, tagging rates with source "yahoo"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes('/fx?')) {
          return { ok: true, json: async () => [{ pair: 'USDAUD', rate: 1.5, asOf: 1 }] } as Response;
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );

    const { result } = renderHook(() => useFxRates(['USDAUD']), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([{ pair: 'USDAUD', rate: 1.5, asOf: 1, source: 'yahoo' }]);
  });

  test('falls back to Frankfurter, tagging rates with source "frankfurter", when the worker /fx call fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes('/fx?')) {
          return { ok: false, status: 500, json: async () => ({}) } as Response;
        }
        if (url.includes('frankfurter.dev')) {
          return {
            ok: true,
            json: async () => ({ amount: 1, base: 'AUD', date: '2026-07-10', rates: { USD: 0.6931 } }),
          } as Response;
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );

    const { result } = renderHook(() => useFxRates(['USDAUD']), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].source).toBe('frankfurter');
    expect(result.current.data?.[0].pair).toBe('USDAUD');
  });
});

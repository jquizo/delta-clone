import { describe, expect, test } from 'vitest';
import { createFrankfurterProvider, createYahooFxProvider } from '../fxProvider';

describe('createYahooFxProvider', () => {
  test('getFxRates fetches the worker /fx endpoint with joined pairs and tags results with source "yahoo"', async () => {
    const requestedUrls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      requestedUrls.push(String(input));
      return {
        ok: true,
        json: async () => [{ pair: 'USDAUD', rate: 1.5, asOf: 1 }],
      } as Response;
    };

    const provider = createYahooFxProvider({ workerUrl: 'https://worker.example', fetchImpl });
    const rates = await provider.getFxRates(['USDAUD']);

    expect(requestedUrls).toEqual(['https://worker.example/fx?pairs=USDAUD']);
    expect(rates).toEqual([{ pair: 'USDAUD', rate: 1.5, asOf: 1, source: 'yahoo' }]);
  });

  test('getFxRates returns an empty array without fetching when given no pairs', async () => {
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return { ok: true, json: async () => [] } as Response;
    };

    const provider = createYahooFxProvider({ workerUrl: 'https://worker.example', fetchImpl });
    expect(await provider.getFxRates([])).toEqual([]);
    expect(called).toBe(false);
  });

  test('getFxRates throws when the worker responds with a non-OK status', async () => {
    const fetchImpl = async () => ({ ok: false, status: 503, json: async () => ({}) }) as Response;
    const provider = createYahooFxProvider({ workerUrl: 'https://worker.example', fetchImpl });
    await expect(provider.getFxRates(['USDAUD'])).rejects.toThrow(/503/);
  });
});

describe('createFrankfurterProvider', () => {
  test('getFxRates pivots through the shared "to" currency, inverting Frankfurter\'s base-relative rates', async () => {
    const requestedUrls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      requestedUrls.push(String(input));
      return {
        ok: true,
        json: async () => ({ amount: 1, base: 'AUD', date: '2026-07-10', rates: { USD: 0.6931, GBP: 0.5155 } }),
      } as Response;
    };

    const provider = createFrankfurterProvider({ fetchImpl });
    const rates = await provider.getFxRates(['USDAUD', 'GBPAUD']);

    expect(requestedUrls).toEqual(['https://api.frankfurter.dev/v1/latest?from=AUD&to=USD,GBP']);
    expect(rates).toHaveLength(2);

    const bySource = Object.fromEntries(rates.map((r) => [r.pair, r]));
    expect(bySource.USDAUD.rate).toBeCloseTo(1 / 0.6931, 6);
    expect(bySource.USDAUD.source).toBe('frankfurter');
    expect(bySource.GBPAUD.rate).toBeCloseTo(1 / 0.5155, 6);
  });

  test('getFxRates omits a pair Frankfurter has no rate for, rather than failing the whole batch', async () => {
    const fetchImpl: typeof fetch = async () =>
      ({ ok: true, json: async () => ({ amount: 1, base: 'AUD', date: '2026-07-10', rates: { USD: 0.6931 } }) }) as Response;

    const provider = createFrankfurterProvider({ fetchImpl });
    const rates = await provider.getFxRates(['USDAUD', 'SGDAUD']);

    expect(rates.map((r) => r.pair)).toEqual(['USDAUD']);
  });

  test('getFxRates returns an empty array without fetching when given no pairs', async () => {
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return { ok: true, json: async () => ({}) } as Response;
    };

    const provider = createFrankfurterProvider({ fetchImpl });
    expect(await provider.getFxRates([])).toEqual([]);
    expect(called).toBe(false);
  });

  test('getFxRates throws when Frankfurter responds with a non-OK status', async () => {
    const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) }) as Response;
    const provider = createFrankfurterProvider({ fetchImpl });
    await expect(provider.getFxRates(['USDAUD'])).rejects.toThrow(/500/);
  });
});

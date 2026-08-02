import { useQuery } from '@tanstack/react-query';
import { computeQuotesRefetchInterval } from './refetchInterval';
import { createFrankfurterProvider, createYahooFxProvider } from '../data/fxProvider';
import { priceHistoryRepo, quotesCacheRepo } from '../data/repositories';
import { yahooProvider } from '../data/yahooProvider';
import type { HistoryRange, PriceQuote } from '../domain/types';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

const yahooFxProvider = createYahooFxProvider({ workerUrl: import.meta.env.VITE_WORKER_URL ?? '' });
const frankfurterProvider = createFrankfurterProvider();

interface QuotesResult {
  quotes: PriceQuote[];
  /** true when the provider fetch failed and this data was hydrated from the last-good cache. */
  isStale: boolean;
}

export function useQuotes(instrumentIds: string[]) {
  const query = useQuery({
    queryKey: ['quotes', [...instrumentIds].sort()],
    queryFn: async (): Promise<QuotesResult> => {
      try {
        const quotes = await yahooProvider.getQuotes(instrumentIds);
        await quotesCacheRepo.saveQuotes(quotes);
        return { quotes, isStale: false };
      } catch (err) {
        const cached = await quotesCacheRepo.getQuotes(instrumentIds);
        if (cached.length === 0) throw err;
        return { quotes: cached, isStale: true };
      }
    },
    staleTime: FIVE_MINUTES_MS,
    enabled: instrumentIds.length > 0,
    refetchInterval: computeQuotesRefetchInterval(instrumentIds),
  });

  return { ...query, data: query.data?.quotes, isStale: query.data?.isStale ?? false };
}

/** `query` is expected to already be debounced by the caller (see useDebouncedValue). */
export function useSymbolSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['symbol-search', trimmed],
    queryFn: () => yahooProvider.searchInstruments(trimmed),
    staleTime: ONE_MINUTE_MS,
    enabled: trimmed.length > 0,
  });
}

/** Tries Yahoo (via the worker) first; falls back to Frankfurter if that fails. */
export function useFxRates(pairs: string[]) {
  return useQuery({
    queryKey: ['fx-rates', [...pairs].sort()],
    queryFn: async () => {
      try {
        return await yahooFxProvider.getFxRates(pairs);
      } catch {
        return frankfurterProvider.getFxRates(pairs);
      }
    },
    staleTime: FIVE_MINUTES_MS,
    enabled: pairs.length > 0,
  });
}

/** Serves price history from the Dexie cache within its TTL; only hits the worker on a cache miss/expiry. */
export function useHistory(instrumentId: string, range: HistoryRange) {
  return useQuery({
    queryKey: ['history', instrumentId, range],
    queryFn: async () => {
      const cached = await priceHistoryRepo.getCached(instrumentId, range);
      if (cached) return cached;

      const points = await yahooProvider.getHistory(instrumentId, range);
      await priceHistoryRepo.save(instrumentId, range, points);
      return points;
    },
    enabled: Boolean(instrumentId),
  });
}

import { z } from 'zod';
import type { Exchange, HistoryPoint, HistoryRange, Instrument, PriceQuote } from '../domain/types';
import { ExchangeSchema } from './schemas';
import type { PriceProvider } from './priceProvider';

const EXCHANGE_SUFFIX: Record<Exchange, string> = {
  ASX: '.AX',
  SGX: '.SI',
  LSE: '.L',
  NASDAQ: '',
  NYSE: '',
  ARCA: '',
  OTC: '',
  SBF: '.PA',
  OSE: '.OL',
};

const HISTORY_RANGE_TO_YAHOO_RANGE: Record<HistoryRange, string> = {
  '1M': '1mo',
  '6M': '6mo',
  '1Y': '1y',
  '5Y': '5y',
};

/** Provider-neutral id ('ASX:BHP') → Yahoo symbol ('BHP.AX'). The only place this mapping lives. */
export function toYahooSymbol(instrumentId: string): string {
  const [exchange, code] = instrumentId.split(':') as [Exchange, string];
  const suffix = EXCHANGE_SUFFIX[exchange];
  if (suffix === undefined) {
    throw new Error(`Unknown exchange in instrument id: ${instrumentId}`);
  }
  return `${code}${suffix}`;
}

const RawWorkerQuoteSchema = z.object({
  symbol: z.string(),
  price: z.number(),
  currency: z.string(),
  previousClose: z.number(),
  marketState: z.enum(['OPEN', 'CLOSED', 'PRE', 'POST']),
  asOf: z.number(),
});
const WorkerQuotesSchema = z.array(RawWorkerQuoteSchema);
export type RawWorkerQuote = z.infer<typeof RawWorkerQuoteSchema>;

/** LSE quotes price in pence (GBp) — normalised to pounds here, and only here. */
export function normaliseRawQuote(raw: RawWorkerQuote, instrumentId: string): PriceQuote {
  if (raw.currency === 'GBp') {
    return {
      instrumentId,
      price: raw.price / 100,
      currency: 'GBP',
      previousClose: raw.previousClose / 100,
      marketState: raw.marketState,
      asOf: raw.asOf,
    };
  }

  return {
    instrumentId,
    price: raw.price,
    currency: raw.currency,
    previousClose: raw.previousClose,
    marketState: raw.marketState,
    asOf: raw.asOf,
  };
}

/** Validates a worker `/quote` response and maps each entry back to its instrument id. */
export function parseWorkerQuotes(json: unknown, instrumentIds: string[]): PriceQuote[] {
  const raws = WorkerQuotesSchema.parse(json);
  const bySymbol = new Map(raws.map((r) => [r.symbol, r]));

  const quotes: PriceQuote[] = [];
  for (const instrumentId of instrumentIds) {
    const symbol = toYahooSymbol(instrumentId);
    const raw = bySymbol.get(symbol);
    if (raw) quotes.push(normaliseRawQuote(raw, instrumentId));
  }
  return quotes;
}

const InstrumentSearchResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  exchange: ExchangeSchema,
  currency: z.string(),
});
const InstrumentSearchResultsSchema = z.array(InstrumentSearchResultSchema);

const HistoryPointSchema = z.object({ date: z.string(), close: z.number() });
const HistoryPointsSchema = z.array(HistoryPointSchema);

export function createYahooProvider(options: { workerUrl: string; fetchImpl?: typeof fetch }): PriceProvider {
  // Resolved per-call rather than captured once, so a global `fetch` stubbed after
  // this singleton is created (as tests do) is still honoured.
  const doFetch = (...args: Parameters<typeof fetch>) => (options.fetchImpl ?? fetch)(...args);

  return {
    async getQuotes(instrumentIds: string[]): Promise<PriceQuote[]> {
      if (instrumentIds.length === 0) return [];

      const symbols = instrumentIds.map(toYahooSymbol).join(',');
      const res = await doFetch(`${options.workerUrl}/quote?symbols=${encodeURIComponent(symbols)}`);
      if (!res.ok) {
        throw new Error(`Worker /quote request failed: ${res.status}`);
      }

      const json = await res.json();
      return parseWorkerQuotes(json, instrumentIds);
    },

    async searchInstruments(query: string): Promise<Instrument[]> {
      const trimmed = query.trim();
      if (!trimmed) return [];

      const res = await doFetch(`${options.workerUrl}/search?q=${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        throw new Error(`Worker /search request failed: ${res.status}`);
      }

      const json = await res.json();
      return InstrumentSearchResultsSchema.parse(json);
    },

    async getHistory(instrumentId: string, range: HistoryRange): Promise<HistoryPoint[]> {
      const symbol = toYahooSymbol(instrumentId);
      const yahooRange = HISTORY_RANGE_TO_YAHOO_RANGE[range];
      const res = await doFetch(`${options.workerUrl}/history?symbol=${encodeURIComponent(symbol)}&range=${yahooRange}`);
      if (!res.ok) {
        throw new Error(`Worker /history request failed: ${res.status}`);
      }

      const json = await res.json();
      return HistoryPointsSchema.parse(json);
    },
  };
}

export const yahooProvider = createYahooProvider({
  workerUrl: import.meta.env.VITE_WORKER_URL ?? '',
});

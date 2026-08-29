export type Exchange = 'ASX' | 'NASDAQ' | 'NYSE' | 'ARCA' | 'LSE' | 'SGX' | 'OTC' | 'SBF' | 'OSE';

export interface InstrumentSearchResult {
  id: string;
  name: string;
  exchange: Exchange;
  currency: string;
}

/** Yahoo's search exchange code → our Exchange. Only these six are supported. */
const YAHOO_EXCHANGE_TO_EXCHANGE: Record<string, Exchange> = {
  ASX: 'ASX',
  NMS: 'NASDAQ',
  NGM: 'NASDAQ',
  NCM: 'NASDAQ',
  NYQ: 'NYSE',
  PCX: 'ARCA',
  LSE: 'LSE',
  SES: 'SGX',
  PNK: 'OTC',
  PAR: 'SBF',
  OSL: 'OSE',
};

const EXCHANGE_CURRENCY: Record<Exchange, string> = {
  ASX: 'AUD',
  NASDAQ: 'USD',
  NYSE: 'USD',
  ARCA: 'USD',
  LSE: 'GBP',
  SGX: 'SGD',
  OTC: 'USD',
  SBF: 'EUR',
  OSE: 'NOK',
};

const EXCHANGE_SUFFIX: Record<Exchange, string> = {
  ASX: '.AX',
  NASDAQ: '',
  NYSE: '',
  ARCA: '',
  LSE: '.L',
  SGX: '.SI',
  OTC: '',
  SBF: '.PA',
  OSE: '.OL',
};

function stripSuffix(symbol: string, suffix: string): string {
  return suffix && symbol.endsWith(suffix) ? symbol.slice(0, -suffix.length) : symbol;
}

const SUPPORTED_QUOTE_TYPES = new Set(['EQUITY', 'ETF']);

/** Filters and maps a raw Yahoo `/v1/finance/search` response to provider-neutral instruments. */
export function toInstrumentSearchResults(json: unknown): InstrumentSearchResult[] {
  if (!json || typeof json !== 'object') return [];

  const quotes = (json as { quotes?: unknown }).quotes;
  if (!Array.isArray(quotes)) return [];

  const results: InstrumentSearchResult[] = [];

  for (const raw of quotes) {
    if (!raw || typeof raw !== 'object') continue;
    const q = raw as Record<string, unknown>;

    if (typeof q.quoteType !== 'string' || !SUPPORTED_QUOTE_TYPES.has(q.quoteType)) continue;
    if (typeof q.exchange !== 'string' || typeof q.symbol !== 'string') continue;

    const exchange = YAHOO_EXCHANGE_TO_EXCHANGE[q.exchange];
    if (!exchange) continue;

    const name = typeof q.longname === 'string' ? q.longname : typeof q.shortname === 'string' ? q.shortname : null;
    if (!name) continue;

    const code = stripSuffix(q.symbol, EXCHANGE_SUFFIX[exchange]);

    results.push({ id: `${exchange}:${code}`, name, exchange, currency: EXCHANGE_CURRENCY[exchange] });
  }

  return results;
}

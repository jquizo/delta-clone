export interface NormalisedQuote {
  symbol: string;
  price: number;
  currency: string;
  previousClose: number;
  marketState: 'OPEN' | 'CLOSED' | 'PRE' | 'POST';
  asOf: number;
}

export function parseSymbolsParam(param: string | null): string[] {
  if (!param) return [];
  return param
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function toMarketState(raw: unknown): NormalisedQuote['marketState'] {
  switch (raw) {
    case 'REGULAR':
      return 'OPEN';
    case 'PRE':
      return 'PRE';
    case 'POST':
      return 'POST';
    default:
      return 'CLOSED';
  }
}

/** Extracts and normalises the fields we need from a Yahoo v8 chart `meta` object. */
export function normaliseYahooMeta(symbol: string, meta: unknown): NormalisedQuote | null {
  if (!meta || typeof meta !== 'object') return null;

  const m = meta as Record<string, unknown>;
  if (typeof m.regularMarketPrice !== 'number') return null;
  if (typeof m.currency !== 'string') return null;

  const previousClose =
    typeof m.chartPreviousClose === 'number'
      ? m.chartPreviousClose
      : typeof m.previousClose === 'number'
        ? m.previousClose
        : null;
  if (previousClose === null) return null;

  const asOf = typeof m.regularMarketTime === 'number' ? m.regularMarketTime * 1000 : Date.now();

  return {
    symbol,
    price: m.regularMarketPrice,
    currency: m.currency,
    previousClose,
    marketState: toMarketState(m.marketState),
    asOf,
  };
}

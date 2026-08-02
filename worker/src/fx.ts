export interface NormalisedFxRate {
  pair: string;
  rate: number;
  asOf: number;
}

/** Extracts rate and timing from a Yahoo v8 chart `meta` object for an FX pair (e.g. 'USDAUD=X'). */
export function normaliseYahooFxMeta(pair: string, meta: unknown): NormalisedFxRate | null {
  if (!meta || typeof meta !== 'object') return null;

  const m = meta as Record<string, unknown>;
  if (typeof m.regularMarketPrice !== 'number') return null;

  const asOf = typeof m.regularMarketTime === 'number' ? m.regularMarketTime * 1000 : Date.now();

  return { pair, rate: m.regularMarketPrice, asOf };
}

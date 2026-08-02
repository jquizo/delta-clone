import type { Currency } from '../domain/types';

/**
 * No FX provider is wired in yet (see Prompt 5) — this always misses, so
 * every cross-currency transaction currently gets fxRateFlagged: true via
 * domain/money.ts's resolveFxRateToBase. Replacing this with a real cache
 * lookup is a one-file change.
 */
export function getCachedFxRate(_from: Currency, _to: Currency): number | undefined {
  return undefined;
}

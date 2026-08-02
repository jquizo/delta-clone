import type { Currency, FxRate } from './types';

export interface ResolvedFxRate {
  fxRateToBase: number;
  /** true when no cached rate was available and the rate defaulted to 1, needing later correction. */
  fxRateFlagged: boolean;
}

/**
 * Decides the fxRateToBase captured on a transaction at entry time. Same-currency
 * transactions never need a rate. Otherwise, use the cached rate if one is
 * available; if not, default to 1 and flag it so it can be corrected later.
 */
export function resolveFxRateToBase(
  currency: Currency,
  baseCurrency: Currency,
  cachedRate: number | undefined,
): ResolvedFxRate {
  if (currency === baseCurrency) {
    return { fxRateToBase: 1, fxRateFlagged: false };
  }

  if (cachedRate !== undefined) {
    return { fxRateToBase: cachedRate, fxRateFlagged: false };
  }

  return { fxRateToBase: 1, fxRateFlagged: true };
}

/** Direct rate `from`→`to`, or the inverse of a cached `to`→`from` rate, if either exists. */
function findRate(rates: FxRate[], from: Currency, to: Currency): number | undefined {
  if (from === to) return 1;

  const direct = rates.find((r) => r.pair === `${from}${to}`);
  if (direct) return direct.rate;

  const inverse = rates.find((r) => r.pair === `${to}${from}`);
  if (inverse) return 1 / inverse.rate;

  return undefined;
}

/**
 * Converts an amount between currencies using the given rates, pivoting
 * through any currency reachable from both `from` and `to` when no direct
 * or inverse rate is cached. Returns undefined — never 0 — when no
 * conversion path exists, so callers can render a "missing rate" state.
 */
export function convert(amount: number, from: Currency, to: Currency, rates: FxRate[]): number | undefined {
  const direct = findRate(rates, from, to);
  if (direct !== undefined) return amount * direct;

  const currencies = new Set<Currency>();
  for (const r of rates) {
    currencies.add(r.pair.slice(0, 3));
    currencies.add(r.pair.slice(3));
  }

  for (const pivot of currencies) {
    const toPivot = findRate(rates, from, pivot);
    const pivotToTarget = findRate(rates, pivot, to);
    if (toPivot !== undefined && pivotToTarget !== undefined) {
      return amount * toPivot * pivotToTarget;
    }
  }

  return undefined;
}

const MONEY_LOCALE = 'en-AU';

/**
 * Formats a currency amount for display. Uses en-AU as the base locale — this
 * shows AUD (and other currencies CLDR treats as "local" to en-AU) with their
 * native symbol, while genuinely foreign currencies (USD, GBP, SGD) render
 * with their ISO code instead of a symbol, avoiding "$" ambiguity between
 * AUD/USD/SGD. Falls back to a plain number + code for unrecognised currencies.
 */
export function formatMoney(amount: number, currency: Currency): string {
  try {
    return new Intl.NumberFormat(MONEY_LOCALE, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

import { convert } from './money';
import type { Currency, FxRate, Holding, PriceQuote } from './types';

export interface PortfolioSummary {
  totalValue: number | undefined;
  totalCost: number | undefined;
  unrealizedPnl: number | undefined;
  dayChangeValue: number | undefined;
  dayChangePercent: number | undefined;
  /** true if any non-zero holding couldn't be fully priced and converted into the base currency. */
  hasMissingData: boolean;
}

/**
 * Rolls up holdings into one base-currency summary. A holding contributes
 * only when it has both a quote and a conversion path to the base currency;
 * otherwise it's excluded from the totals and hasMissingData is set — the
 * totals themselves become undefined (never a silent 0) if nothing could be
 * priced at all.
 */
export function summarise(
  holdings: Holding[],
  quotes: PriceQuote[],
  fxRates: FxRate[],
  baseCurrency: Currency,
): PortfolioSummary {
  const quoteByInstrument = new Map(quotes.map((q) => [q.instrumentId, q]));

  let totalValue = 0;
  let totalCost = 0;
  let dayChangeValue = 0;
  let hasMissingData = false;
  let anyContribution = false;

  for (const holding of holdings) {
    if (holding.quantity === 0 && holding.totalCost === 0) continue;

    const quote = quoteByInstrument.get(holding.instrumentId);
    if (!quote) {
      hasMissingData = true;
      continue;
    }

    const valueInBase = convert(quote.price * holding.quantity, quote.currency, baseCurrency, fxRates);
    const costInBase = convert(holding.totalCost, quote.currency, baseCurrency, fxRates);
    const prevValueInBase = convert(quote.previousClose * holding.quantity, quote.currency, baseCurrency, fxRates);

    if (valueInBase === undefined || costInBase === undefined || prevValueInBase === undefined) {
      hasMissingData = true;
      continue;
    }

    totalValue += valueInBase;
    totalCost += costInBase;
    dayChangeValue += valueInBase - prevValueInBase;
    anyContribution = true;
  }

  if (!anyContribution) {
    // Nothing to price (empty or fully-sold portfolio) is a real zero, not missing data.
    if (!hasMissingData) {
      return { totalValue: 0, totalCost: 0, unrealizedPnl: 0, dayChangeValue: 0, dayChangePercent: undefined, hasMissingData };
    }

    return {
      totalValue: undefined,
      totalCost: undefined,
      unrealizedPnl: undefined,
      dayChangeValue: undefined,
      dayChangePercent: undefined,
      hasMissingData,
    };
  }

  const previousTotalValue = totalValue - dayChangeValue;
  const dayChangePercent = previousTotalValue !== 0 ? (dayChangeValue / previousTotalValue) * 100 : undefined;

  return {
    totalValue,
    totalCost,
    unrealizedPnl: totalValue - totalCost,
    dayChangeValue,
    dayChangePercent,
    hasMissingData,
  };
}

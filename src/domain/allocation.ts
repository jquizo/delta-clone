import { convert } from './money';
import type { Currency, Exchange, FxRate, Holding, PriceQuote } from './types';

export type AllocationGroupBy = 'holding' | 'exchange' | 'currency';

export interface AllocationSlice {
  label: string;
  value: number;
}

function labelFor(instrumentId: string, currency: Currency, groupBy: AllocationGroupBy): string {
  if (groupBy === 'holding') return instrumentId;
  if (groupBy === 'currency') return currency;
  return instrumentId.split(':')[0] as Exchange;
}

/**
 * Groups current holding values (converted to the base currency) by
 * instrument, exchange, or native currency. A holding with no quote or no
 * conversion path is excluded entirely rather than counted as a 0-value slice.
 */
export function groupAllocation(
  holdings: Holding[],
  quotes: PriceQuote[],
  fxRates: FxRate[],
  baseCurrency: Currency,
  groupBy: AllocationGroupBy,
): AllocationSlice[] {
  const quoteByInstrument = new Map(quotes.map((q) => [q.instrumentId, q]));
  const totalsByLabel = new Map<string, number>();

  for (const holding of holdings) {
    if (holding.quantity === 0) continue;

    const quote = quoteByInstrument.get(holding.instrumentId);
    if (!quote) continue;

    const valueInBase = convert(quote.price * holding.quantity, quote.currency, baseCurrency, fxRates);
    if (valueInBase === undefined) continue;

    const label = labelFor(holding.instrumentId, quote.currency, groupBy);
    totalsByLabel.set(label, (totalsByLabel.get(label) ?? 0) + valueInBase);
  }

  return [...totalsByLabel.entries()].map(([label, value]) => ({ label, value }));
}

import { snapshotRepo } from '../data/repositories';
import { summarise } from '../domain/portfolio';
import { shouldWriteDailySnapshot } from '../domain/snapshot';
import type { DailySnapshot, FxRate, Holding, Portfolio, PriceQuote } from '../domain/types';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Writes today's portfolio-value snapshot at most once, and only from a
 * complete, live valuation — never from stale (cache-hydrated) quotes or a
 * portfolio with unpriced holdings, so the history chart never records a
 * misleading value.
 */
export async function maybeWriteDailySnapshot(
  portfolio: Portfolio,
  holdings: Holding[],
  quotes: PriceQuote[],
  fxRates: FxRate[],
  isStale: boolean,
): Promise<DailySnapshot | null> {
  const today = todayIsoDate();
  const hasSnapshotForToday = await snapshotRepo.hasSnapshotForDate(portfolio.id, today);

  const summary = summarise(holdings, quotes, fxRates, portfolio.baseCurrency);
  const quotesAreFresh = !isStale && !summary.hasMissingData && summary.totalValue !== undefined;

  if (!shouldWriteDailySnapshot({ hasSnapshotForToday, quotesAreFresh })) return null;

  return snapshotRepo.add({
    portfolioId: portfolio.id,
    date: today,
    valueInBase: summary.totalValue!,
    costInBase: summary.totalCost!,
  });
}

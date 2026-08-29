import { lazy, Suspense, useEffect, useMemo } from 'react';
import { useAppStore } from '../../app/store';
import { useHoldings, useSnapshots } from '../../app/selectors';
import { useFxRates, useQuotes } from '../../app/queries';
import { maybeWriteDailySnapshot } from '../../app/snapshotActions';
import { formatMoney } from '../../domain/money';
import { summarise } from '../../domain/portfolio';
import { SummaryHeader } from '../components/SummaryHeader';
import { StaleBadge } from '../components/StaleBadge';
import { MarketStatusBadge } from '../components/MarketStatusBadge';
import { Sparkline } from '../components/Sparkline';
import { PLBadge } from '../components/PLBadge';
import { ChartSkeleton, SummaryHeaderSkeleton, TableSkeleton } from '../components/Skeleton';
import type { Currency, Exchange, Portfolio } from '../../domain/types';

// Lazy-loaded: both pull in Recharts, deferred out of the main bundle until
// the Dashboard actually has holdings to chart.
const AllocationDonut = lazy(() => import('../components/AllocationDonut').then((m) => ({ default: m.AllocationDonut })));
const PortfolioValueChart = lazy(() =>
  import('../components/PortfolioValueChart').then((m) => ({ default: m.PortfolioValueChart })),
);

const SUPPORTED_CURRENCIES: Currency[] = ['AUD', 'USD', 'GBP', 'SGD'];

interface DashboardProps {
  portfolio: Portfolio;
}

export function Dashboard({ portfolio }: DashboardProps) {
  const displayCurrency = useAppStore((s) => s.displayCurrency) ?? portfolio.baseCurrency;
  const setDisplayCurrency = useAppStore((s) => s.setDisplayCurrency);
  const viewHoldingDetail = useAppStore((s) => s.viewHoldingDetail);

  const result = useHoldings(portfolio.id);
  const isHoldingsLoading = result === undefined;
  const holdings = useMemo(() => result?.holdings ?? [], [result]);
  const warnings = result?.warnings ?? [];
  const instrumentIds = holdings.map((h) => h.instrumentId);
  const { data: quotes, isLoading, isError, isStale } = useQuotes(instrumentIds);

  const quoteByInstrumentId = new Map((quotes ?? []).map((q) => [q.instrumentId, q]));

  const foreignCurrencies = [...new Set((quotes ?? []).map((q) => q.currency).filter((c) => c !== displayCurrency))];
  const fxPairs = foreignCurrencies.map((c) => `${c}${displayCurrency}`);
  const { data: fxRates, isLoading: isFxLoading } = useFxRates(fxPairs);

  const summary = summarise(holdings, quotes ?? [], fxRates ?? [], displayCurrency);
  const snapshots = useSnapshots(portfolio.id);

  useEffect(() => {
    if (isLoading || isFxLoading || holdings.length === 0) return;
    // Idempotent at the DB level (snapshotRepo.hasSnapshotForDate) — safe to call on every
    // settle of quotes/fx, including the case where fx wasn't ready on an earlier attempt.
    void maybeWriteDailySnapshot(portfolio, holdings, quotes ?? [], fxRates ?? [], isStale);
  }, [isLoading, isFxLoading, isStale, holdings, quotes, fxRates, portfolio]);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">Holdings</h1>
        <label className="text-sm text-muted">
          Display currency{' '}
          <select
            value={displayCurrency}
            onChange={(e) => setDisplayCurrency(e.target.value as Currency)}
            className="rounded-md border border-hairline bg-surface px-2 py-1 text-sm text-ink"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isHoldingsLoading ? (
        <SummaryHeaderSkeleton />
      ) : (
        <SummaryHeader summary={summary} displayCurrency={displayCurrency} />
      )}

      {warnings.length > 0 && (
        <ul className="mb-4 space-y-1 text-sm text-amber-700">
          {warnings.map((w) => (
            <li key={w.transactionId}>{w.message}</li>
          ))}
        </ul>
      )}

      {isError && <p className="mb-4 text-sm text-negative">Failed to load live prices.</p>}
      {isStale && (
        <p className="mb-4 text-sm text-amber-700">
          Live prices are unavailable — showing the last cached quotes.
        </p>
      )}

      {isHoldingsLoading ? (
        <>
          <ChartSkeleton label="Loading allocation chart" />
          <ChartSkeleton label="Loading portfolio value chart" />
          <TableSkeleton columns={9} rows={4} />
        </>
      ) : holdings.length === 0 ? (
        <p className="text-sm text-muted">No holdings yet — add a transaction to get started.</p>
      ) : (
        <>
          {isLoading ? (
            <ChartSkeleton label="Loading allocation chart" />
          ) : (
            <Suspense fallback={<ChartSkeleton label="Loading allocation chart" />}>
              <AllocationDonut holdings={holdings} quotes={quotes ?? []} fxRates={fxRates ?? []} baseCurrency={displayCurrency} />
            </Suspense>
          )}
          <Suspense fallback={<ChartSkeleton label="Loading portfolio value chart" />}>
            <PortfolioValueChart snapshots={snapshots} baseCurrency={portfolio.baseCurrency} />
          </Suspense>

          <div className="overflow-x-auto rounded-xl border border-hairline bg-surface shadow-sm">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-hairline bg-paper text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5 font-medium">Instrument</th>
                  <th className="px-4 py-2.5 font-medium">Market</th>
                  <th className="px-4 py-2.5 text-center font-medium">Trend (1M)</th>
                  <th className="px-4 py-2.5 text-right font-medium">Quantity</th>
                  <th className="px-4 py-2.5 text-right font-medium">Avg cost / share</th>
                  <th className="px-4 py-2.5 text-right font-medium">Price</th>
                  <th className="px-4 py-2.5 text-right font-medium">Current value</th>
                  <th className="px-4 py-2.5 text-right font-medium">Unrealized P/L</th>
                  <th className="px-4 py-2.5 text-right font-medium">As of</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => {
                  const quote = quoteByInstrumentId.get(h.instrumentId);
                  const currentValue = quote ? quote.price * h.quantity : null;
                  const unrealizedPnl = quote ? (quote.price - h.avgCostPerShare) * h.quantity : null;
                  const exchange = h.instrumentId.split(':')[0] as Exchange;

                  return (
                    <tr key={h.instrumentId} className="border-b border-hairline last:border-b-0">
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => viewHoldingDetail(h.instrumentId)}
                          className="font-medium text-accent underline underline-offset-2"
                        >
                          {h.instrumentId}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <MarketStatusBadge exchange={exchange} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-center">
                          <Sparkline instrumentId={h.instrumentId} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-ink">{h.quantity}</td>
                      <td className="px-4 py-2.5 text-right text-ink">
                        {quote ? formatMoney(h.avgCostPerShare, quote.currency) : h.avgCostPerShare.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-ink">
                        {isLoading ? '…' : quote ? formatMoney(quote.price, quote.currency) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-ink">
                        {isLoading ? '…' : quote && currentValue !== null ? formatMoney(currentValue, quote.currency) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {isLoading ? (
                          '…'
                        ) : quote && unrealizedPnl !== null ? (
                          <PLBadge value={unrealizedPnl} currency={quote.currency} />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted">
                        {quote ? (
                          isStale ? (
                            <StaleBadge asOf={quote.asOf} />
                          ) : (
                            new Date(quote.asOf).toLocaleString()
                          )
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

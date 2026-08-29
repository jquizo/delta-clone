import { formatMoney } from '../../domain/money';
import type { PortfolioSummary } from '../../domain/portfolio';
import type { Currency } from '../../domain/types';

interface SummaryHeaderProps {
  summary: PortfolioSummary;
  displayCurrency: Currency;
}

interface StatProps {
  label: string;
  value: number | undefined;
  currency: Currency;
  suffix?: string;
  signed?: boolean;
}

function Stat({ label, value, currency, suffix, signed }: StatProps) {
  const toneClass = signed && value !== undefined ? (value > 0 ? 'text-positive' : value < 0 ? 'text-negative' : 'text-ink') : 'text-ink';

  return (
    <div className="px-4 py-3 first:pl-0 sm:border-l sm:border-hairline sm:first:border-l-0">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      {value === undefined ? (
        <p className="mt-1 flex items-center gap-1 text-sm text-amber-700">
          <span role="img" aria-label="missing data">
            ⚠️
          </span>
          <span>—</span>
        </p>
      ) : (
        <p className={`mt-1 text-lg font-semibold ${toneClass}`}>
          {formatMoney(value, currency)}
          {suffix}
        </p>
      )}
    </div>
  );
}

export function SummaryHeader({ summary, displayCurrency }: SummaryHeaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Portfolio summary"
      className="mb-6 grid grid-cols-2 gap-y-3 rounded-xl border border-hairline bg-surface p-4 shadow-sm sm:grid-cols-4 sm:gap-y-0"
    >
      <Stat label="Total value" value={summary.totalValue} currency={displayCurrency} />
      <Stat label="Total cost" value={summary.totalCost} currency={displayCurrency} />
      <Stat label="Unrealized P/L" value={summary.unrealizedPnl} currency={displayCurrency} signed />
      <Stat
        label="Day change"
        value={summary.dayChangeValue}
        currency={displayCurrency}
        signed
        suffix={
          summary.dayChangePercent !== undefined ? ` (${summary.dayChangePercent >= 0 ? '+' : ''}${summary.dayChangePercent.toFixed(2)}%)` : ''
        }
      />
    </div>
  );
}

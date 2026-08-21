import { useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '../../domain/money';
import type { Currency, DailySnapshot } from '../../domain/types';

type SnapshotRange = '1M' | '3M' | '1Y' | 'All';
const RANGE_OPTIONS: SnapshotRange[] = ['1M', '3M', '1Y', 'All'];
const RANGE_DAYS: Record<SnapshotRange, number | null> = { '1M': 30, '3M': 90, '1Y': 365, All: null };

interface PortfolioValueChartProps {
  snapshots: DailySnapshot[];
  /** Snapshots are always recorded in the portfolio's base currency, not the switchable display currency. */
  baseCurrency: Currency;
}

export function PortfolioValueChart({ snapshots, baseCurrency }: PortfolioValueChartProps) {
  const [range, setRange] = useState<SnapshotRange>('3M');
  // A state initializer runs once on mount, not on every render — unlike calling
  // Date.now() directly in the render body, which React's purity rules flag.
  const [now] = useState(() => Date.now());

  const days = RANGE_DAYS[range];
  const cutoff = days ? new Date(now - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : null;
  const filtered = cutoff ? snapshots.filter((s) => s.date >= cutoff) : snapshots;

  return (
    <div className="mb-6 rounded-xl border border-hairline bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink">Portfolio value</h2>
        <div className="flex gap-1 text-xs">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={`rounded-full px-3 py-2 ${range === r ? 'bg-accent text-white' : 'bg-paper text-muted hover:text-ink'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {snapshots.length === 0 ? (
        <p className="text-sm text-muted">
          No history yet — a snapshot is recorded once per day you open the app, so your value chart builds up from
          today onward.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={filtered}>
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} width={50} />
            <Tooltip formatter={(value) => formatMoney(Number(value), baseCurrency)} />
            <Area type="monotone" dataKey="valueInBase" stroke="#3d5a80" fill="rgba(61,90,128,0.15)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

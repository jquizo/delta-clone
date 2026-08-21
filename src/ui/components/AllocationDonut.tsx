import { useState } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { groupAllocation, type AllocationGroupBy } from '../../domain/allocation';
import { formatMoney } from '../../domain/money';
import { displayLabel } from './allocationLabel';
import type { Currency, FxRate, Holding, PriceQuote } from '../../domain/types';

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];
const GROUP_OPTIONS: AllocationGroupBy[] = ['holding', 'exchange', 'currency'];

interface AllocationDonutProps {
  holdings: Holding[];
  quotes: PriceQuote[];
  fxRates: FxRate[];
  baseCurrency: Currency;
}

export function AllocationDonut({ holdings, quotes, fxRates, baseCurrency }: AllocationDonutProps) {
  const [groupBy, setGroupBy] = useState<AllocationGroupBy>('holding');
  const slices = groupAllocation(holdings, quotes, fxRates, baseCurrency, groupBy);

  return (
    <div className="mb-6 rounded-xl border border-hairline bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-ink">Allocation</h2>
        <div className="flex gap-1 text-xs">
          {GROUP_OPTIONS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroupBy(g)}
              aria-pressed={groupBy === g}
              className={`rounded-full px-3 py-2 ${groupBy === g ? 'bg-accent text-white' : 'bg-paper text-muted hover:text-ink'}`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {slices.length === 0 ? (
        <p className="text-sm text-muted">No priced holdings yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={slices.map((s) => ({ ...s, label: displayLabel(s.label) }))}
              dataKey="value"
              nameKey="label"
              innerRadius={60}
              outerRadius={90}
            >
              {slices.map((s, i) => (
                <Cell key={s.label} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatMoney(Number(value), baseCurrency)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

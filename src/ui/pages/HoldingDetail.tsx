import { useState } from 'react';
import { useHistory } from '../../app/queries';
import { PriceChart } from '../components/PriceChart';
import { ChartSkeleton } from '../components/Skeleton';
import type { HistoryRange } from '../../domain/types';

const RANGES: HistoryRange[] = ['1M', '6M', '1Y', '5Y'];

interface HoldingDetailProps {
  instrumentId: string;
  onBack: () => void;
}

export function HoldingDetail({ instrumentId, onBack }: HoldingDetailProps) {
  const [range, setRange] = useState<HistoryRange>('6M');
  const { data: points, isLoading, isError } = useHistory(instrumentId, range);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <button type="button" onClick={onBack} className="mb-4 text-sm text-accent hover:underline">
        ← Back
      </button>
      <h1 className="mb-4 text-xl font-semibold text-ink">{instrumentId}</h1>

      <div className="mb-4 flex gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            aria-pressed={range === r}
            className={`rounded-full px-3 py-1 text-sm ${range === r ? 'bg-accent text-white' : 'bg-paper text-muted hover:text-ink'}`}
          >
            {r}
          </button>
        ))}
      </div>

      {isLoading && <ChartSkeleton label="Loading price chart" height={300} />}
      {isError && <p className="text-sm text-negative">Failed to load price history.</p>}
      {points && points.length > 0 && <PriceChart points={points} />}
      {points && points.length === 0 && <p className="text-sm text-muted">No price history available.</p>}
    </main>
  );
}

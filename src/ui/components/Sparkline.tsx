import { useHistory } from '../../app/queries';
import { Skeleton } from './Skeleton';
import { SPARKLINE_HEIGHT, SPARKLINE_PADDING, SPARKLINE_WIDTH, pointsToPolyline, trendOf, type SparklineTrend } from './sparklineMath';

const TREND_COLOR: Record<SparklineTrend, string> = {
  positive: 'var(--color-positive)',
  negative: 'var(--color-negative)',
  flat: 'var(--color-muted)',
};

interface SparklineProps {
  instrumentId: string;
}

export function Sparkline({ instrumentId }: SparklineProps) {
  const { data, isLoading } = useHistory(instrumentId, '1M');

  if (isLoading || !data) {
    return <Skeleton className="h-6 w-[72px] rounded" />;
  }

  if (data.length < 2) {
    return (
      <svg
        width={SPARKLINE_WIDTH}
        height={SPARKLINE_HEIGHT}
        viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
        role="img"
        aria-label="Not enough price history for a trend line"
      >
        <line
          x1={SPARKLINE_PADDING}
          y1={SPARKLINE_HEIGHT / 2}
          x2={SPARKLINE_WIDTH - SPARKLINE_PADDING}
          y2={SPARKLINE_HEIGHT / 2}
          stroke="var(--color-hairline-strong)"
          strokeWidth={2}
        />
      </svg>
    );
  }

  const trend = trendOf(data);

  return (
    <svg
      width={SPARKLINE_WIDTH}
      height={SPARKLINE_HEIGHT}
      viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
      role="img"
      aria-label={`1 month price trend: ${trend}`}
    >
      <polyline
        points={pointsToPolyline(data)}
        fill="none"
        stroke={TREND_COLOR[trend]}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

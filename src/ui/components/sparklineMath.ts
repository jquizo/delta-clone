import type { HistoryPoint } from '../../domain/types';

const WIDTH = 72;
const HEIGHT = 24;
const PADDING = 2;

export type SparklineTrend = 'positive' | 'negative' | 'flat';

export function trendOf(points: HistoryPoint[]): SparklineTrend {
  if (points.length < 2) return 'flat';
  const first = points[0].close;
  const last = points[points.length - 1].close;
  if (last > first) return 'positive';
  if (last < first) return 'negative';
  return 'flat';
}

export function pointsToPolyline(points: HistoryPoint[]): string {
  if (points.length === 0) return '';
  const closes = points.map((p) => p.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const innerWidth = WIDTH - PADDING * 2;
  const innerHeight = HEIGHT - PADDING * 2;
  const step = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  return closes
    .map((close, i) => {
      const x = PADDING + i * step;
      const y = PADDING + innerHeight - ((close - min) / range) * innerHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export const SPARKLINE_WIDTH = WIDTH;
export const SPARKLINE_HEIGHT = HEIGHT;
export const SPARKLINE_PADDING = PADDING;

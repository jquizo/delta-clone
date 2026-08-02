import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sparkline } from '../Sparkline';
import { pointsToPolyline, trendOf } from '../sparklineMath';
import { db } from '../../../data/db';
import { priceHistoryRepo } from '../../../data/repositories';
import type { HistoryPoint } from '../../../domain/types';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('trendOf', () => {
  test('is positive when the last close is higher than the first', () => {
    expect(trendOf([{ date: '2026-01-01', close: 10 }, { date: '2026-01-02', close: 12 }])).toBe('positive');
  });

  test('is negative when the last close is lower than the first', () => {
    expect(trendOf([{ date: '2026-01-01', close: 12 }, { date: '2026-01-02', close: 10 }])).toBe('negative');
  });

  test('is flat when there are fewer than two points, or no net change', () => {
    expect(trendOf([{ date: '2026-01-01', close: 10 }])).toBe('flat');
    expect(trendOf([{ date: '2026-01-01', close: 10 }, { date: '2026-01-02', close: 10 }])).toBe('flat');
  });
});

describe('pointsToPolyline', () => {
  test('produces one coordinate pair per point', () => {
    const points: HistoryPoint[] = [
      { date: '2026-01-01', close: 10 },
      { date: '2026-01-02', close: 12 },
      { date: '2026-01-03', close: 11 },
    ];
    expect(pointsToPolyline(points).split(' ')).toHaveLength(3);
  });

  test('returns an empty string for no points', () => {
    expect(pointsToPolyline([])).toBe('');
  });
});

describe('Sparkline', () => {
  beforeEach(async () => {
    await db.priceHistory.clear();
  });

  test('renders a trend line labelled with the direction once history loads', async () => {
    await priceHistoryRepo.save('ASX:BHP', '1M', [
      { date: '2026-01-01', close: 40 },
      { date: '2026-01-02', close: 44 },
    ]);

    render(<Sparkline instrumentId="ASX:BHP" />, { wrapper });

    const svg = await screen.findByRole('img', { name: /1 month price trend: positive/i });
    expect(svg).toBeInTheDocument();
  });
});

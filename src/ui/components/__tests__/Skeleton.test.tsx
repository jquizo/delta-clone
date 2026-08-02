import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartSkeleton, SummaryHeaderSkeleton, TableSkeleton } from '../Skeleton';

describe('loading skeletons', () => {
  test('SummaryHeaderSkeleton exposes a status role for assistive tech', () => {
    render(<SummaryHeaderSkeleton />);
    expect(screen.getByRole('status', { name: /loading portfolio summary/i })).toBeInTheDocument();
  });

  test('TableSkeleton renders the requested number of rows and columns', () => {
    const { container } = render(<TableSkeleton columns={4} rows={2} />);
    const rows = container.querySelectorAll('[role="status"] > div');
    expect(rows).toHaveLength(2);
    expect(rows[0].children).toHaveLength(4);
  });

  test('ChartSkeleton uses the given accessible label', () => {
    render(<ChartSkeleton label="Loading allocation chart" />);
    expect(screen.getByRole('status', { name: /loading allocation chart/i })).toBeInTheDocument();
  });
});

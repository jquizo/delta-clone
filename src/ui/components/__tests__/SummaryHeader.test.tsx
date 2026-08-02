import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SummaryHeader } from '../SummaryHeader';
import type { PortfolioSummary } from '../../../domain/portfolio';

describe('SummaryHeader', () => {
  test('renders formatted totals when everything is priced', () => {
    const summary: PortfolioSummary = {
      totalValue: 4500,
      totalCost: 4000,
      unrealizedPnl: 500,
      dayChangeValue: 100,
      dayChangePercent: 2.27,
      hasMissingData: false,
    };

    render(<SummaryHeader summary={summary} displayCurrency="AUD" />);

    expect(screen.getByText(/4,?500\.00/)).toBeInTheDocument();
    expect(screen.getByText(/4,?000\.00/)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /missing/i })).not.toBeInTheDocument();
  });

  test('renders "—" with a warning icon instead of 0 when a value is missing', () => {
    const summary: PortfolioSummary = {
      totalValue: undefined,
      totalCost: undefined,
      unrealizedPnl: undefined,
      dayChangeValue: undefined,
      dayChangePercent: undefined,
      hasMissingData: true,
    };

    render(<SummaryHeader summary={summary} displayCurrency="AUD" />);

    expect(screen.queryByText('0.00')).not.toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('img', { name: /missing/i }).length).toBeGreaterThan(0);
  });

  test('renders a partial total (not "—") for a value that is defined even when other data is missing', () => {
    const summary: PortfolioSummary = {
      totalValue: 4500,
      totalCost: 4000,
      unrealizedPnl: 500,
      dayChangeValue: undefined,
      dayChangePercent: undefined,
      hasMissingData: true,
    };

    render(<SummaryHeader summary={summary} displayCurrency="AUD" />);

    expect(screen.getByText(/4,?500\.00/)).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(1);
  });
});

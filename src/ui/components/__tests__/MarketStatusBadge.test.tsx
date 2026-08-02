import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarketStatusBadge } from '../MarketStatusBadge';

describe('MarketStatusBadge', () => {
  test('renders an OPEN badge for the exchange when it is within trading hours', () => {
    // 2026-01-14 14:30 UTC = 09:30 EST — NASDAQ open.
    render(<MarketStatusBadge exchange="NASDAQ" now={new Date(Date.UTC(2026, 0, 14, 14, 30))} />);
    expect(screen.getByText(/NASDAQ/)).toBeInTheDocument();
    expect(screen.getByText(/open/i)).toBeInTheDocument();
  });

  test('renders a CLOSED badge for the exchange outside trading hours', () => {
    // Saturday — every exchange closed.
    render(<MarketStatusBadge exchange="ASX" now={new Date(Date.UTC(2026, 0, 17, 14, 30))} />);
    expect(screen.getByText(/ASX/)).toBeInTheDocument();
    expect(screen.getByText(/closed/i)).toBeInTheDocument();
  });
});

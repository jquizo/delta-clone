import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarketStatusBadge } from '../MarketStatusBadge';

describe('MarketStatusBadge', () => {
  test('shows only the exchange name when it is within trading hours, with open state on the accessible label', () => {
    // 2026-01-14 14:30 UTC = 09:30 EST — NASDAQ open.
    render(<MarketStatusBadge exchange="NASDAQ" now={new Date(Date.UTC(2026, 0, 14, 14, 30))} />);
    const badge = screen.getByLabelText(/NASDAQ market open/i);
    expect(badge).toHaveTextContent(/^NASDAQ$/);
  });

  test('shows only the exchange name when outside trading hours, with closed state on the accessible label', () => {
    // Saturday — every exchange closed.
    render(<MarketStatusBadge exchange="ASX" now={new Date(Date.UTC(2026, 0, 17, 14, 30))} />);
    const badge = screen.getByLabelText(/ASX market closed/i);
    expect(badge).toHaveTextContent(/^ASX$/);
  });
});

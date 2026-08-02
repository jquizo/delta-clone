import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PLBadge } from '../PLBadge';

describe('PLBadge', () => {
  test('renders a positive value with a leading + and the positive tone', () => {
    render(<PLBadge value={412} currency="AUD" />);
    const badge = screen.getByText(/\+\$412\.00/);
    expect(badge).toHaveClass('text-positive');
  });

  test('renders a negative value with the negative tone and no double minus', () => {
    render(<PLBadge value={-210} currency="AUD" />);
    const badge = screen.getByText(/-\$210\.00/);
    expect(badge).toHaveClass('text-negative');
    expect(badge.textContent).not.toContain('--');
  });

  test('renders a zero value with the neutral tone', () => {
    render(<PLBadge value={0} currency="AUD" />);
    const badge = screen.getByText(/\$0\.00/);
    expect(badge).toHaveClass('text-muted');
  });
});

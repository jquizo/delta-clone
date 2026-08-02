import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StaleBadge } from '../StaleBadge';

describe('StaleBadge', () => {
  test('renders an amber warning with relative time', () => {
    const asOf = Date.now() - 5 * 60_000;
    render(<StaleBadge asOf={asOf} />);

    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent(/stale/i);
    expect(badge).toHaveTextContent('5 min ago');
  });
});

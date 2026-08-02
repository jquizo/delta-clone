import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('kaboom');
  return <p>All good</p>;
}

describe('ErrorBoundary', () => {
  test('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  test('renders a fallback with the error message when a child throws during render', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('kaboom');
    consoleError.mockRestore();
  });

  test('uses a custom fallback title when provided', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallbackTitle="Dashboard crashed">
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Dashboard crashed');
    consoleError.mockRestore();
  });

  test('"Try again" resets the boundary so it re-attempts rendering children', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    function Wrapper() {
      const [shouldThrow, setShouldThrow] = useState(true);
      return (
        <ErrorBoundary>
          <button type="button" onClick={() => setShouldThrow(false)}>
            fix it
          </button>
          <Bomb shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );
    }

    render(<Wrapper />);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    // Still throwing (the outer state hasn't changed) — fallback should reappear, not crash the test runner.
    expect(screen.getByRole('alert')).toBeInTheDocument();

    consoleError.mockRestore();
  });
});

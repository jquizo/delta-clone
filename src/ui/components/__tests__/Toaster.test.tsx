import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from 'react';
import { Toaster } from '../Toaster';
import { useToastStore } from '../../../app/toastStore';

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Toaster', () => {
  test('renders nothing when there are no toasts', () => {
    const { container } = render(<Toaster />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders an active toast with role="alert"', () => {
    render(<Toaster />);
    act(() => useToastStore.getState().addToast('Failed to save'));
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to save');
  });

  test('clicking dismiss removes the toast', () => {
    render(<Toaster />);
    act(() => useToastStore.getState().addToast('Failed to save'));

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('a toast auto-dismisses after its timeout', () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => useToastStore.getState().addToast('Failed to save'));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5000));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useDebouncedValue } from '../useDebouncedValue';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebouncedValue', () => {
  test('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('a', 300));
    expect(result.current).toBe('a');
  });

  test('does not update until the delay has elapsed', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ab' });
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('ab');
  });

  test('resets the timer on rapid successive changes, only settling on the last value', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ab' });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: 'abc' });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('abc');
  });
});

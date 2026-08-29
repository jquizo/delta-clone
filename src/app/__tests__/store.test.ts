import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useAppStore } from '../store';

function stubSystemPrefersDark(prefersDark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' && prefersDark,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ theme: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('useAppStore theme', () => {
  test('toggleTheme flips away from the OS preference when nothing has been chosen yet', () => {
    stubSystemPrefersDark(true);
    useAppStore.getState().toggleTheme();
    expect(useAppStore.getState().theme).toBe('light');
  });

  test('toggleTheme flips away from light OS preference to dark', () => {
    stubSystemPrefersDark(false);
    useAppStore.getState().toggleTheme();
    expect(useAppStore.getState().theme).toBe('dark');
  });

  test('toggleTheme flips an explicit choice to its opposite, ignoring OS preference', () => {
    stubSystemPrefersDark(true);
    useAppStore.setState({ theme: 'dark' });
    useAppStore.getState().toggleTheme();
    expect(useAppStore.getState().theme).toBe('light');

    useAppStore.getState().toggleTheme();
    expect(useAppStore.getState().theme).toBe('dark');
  });

  test('toggleTheme persists the explicit choice to localStorage', () => {
    stubSystemPrefersDark(false);
    useAppStore.getState().toggleTheme();
    expect(localStorage.getItem('delta-clone-theme')).toBe('dark');
  });
});

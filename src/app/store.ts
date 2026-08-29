import { create } from 'zustand';
import type { Currency, Portfolio } from '../domain/types';

export type ActiveView = 'dashboard' | 'transactions' | 'holding-detail' | 'settings';

/** null = follow the OS preference; 'light'/'dark' = explicit user override, persisted. */
export type ThemePreference = 'light' | 'dark' | null;

const THEME_STORAGE_KEY = 'delta-clone-theme';

function readStoredTheme(): ThemePreference {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

interface AppState {
  activePortfolio: Portfolio | null;
  activeView: ActiveView;
  displayCurrency: Currency | null;
  selectedInstrumentId: string | null;
  theme: ThemePreference;
  setActivePortfolio: (portfolio: Portfolio) => void;
  setActiveView: (view: ActiveView) => void;
  setDisplayCurrency: (currency: Currency) => void;
  viewHoldingDetail: (instrumentId: string) => void;
  toggleTheme: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  activePortfolio: null,
  activeView: 'dashboard',
  displayCurrency: null,
  selectedInstrumentId: null,
  theme: readStoredTheme(),
  setActivePortfolio: (portfolio) =>
    set({ activePortfolio: portfolio, displayCurrency: get().displayCurrency ?? portfolio.baseCurrency }),
  setActiveView: (view) => set({ activeView: view }),
  setDisplayCurrency: (currency) => set({ displayCurrency: currency }),
  viewHoldingDetail: (instrumentId) => set({ activeView: 'holding-detail', selectedInstrumentId: instrumentId }),
  toggleTheme: () => {
    // Toggles the *effective* theme: if nothing's been chosen yet, flip away
    // from whatever the OS currently resolves to, not a hardcoded default.
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const currentlyDark = get().theme === 'dark' || (get().theme === null && prefersDark);
    const next: ThemePreference = currentlyDark ? 'light' : 'dark';
    localStorage.setItem(THEME_STORAGE_KEY, next);
    set({ theme: next });
  },
}));

import { create } from 'zustand';
import type { Currency, Portfolio } from '../domain/types';

export type ActiveView = 'dashboard' | 'transactions' | 'holding-detail' | 'settings';

interface AppState {
  activePortfolio: Portfolio | null;
  activeView: ActiveView;
  displayCurrency: Currency | null;
  selectedInstrumentId: string | null;
  setActivePortfolio: (portfolio: Portfolio) => void;
  setActiveView: (view: ActiveView) => void;
  setDisplayCurrency: (currency: Currency) => void;
  viewHoldingDetail: (instrumentId: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  activePortfolio: null,
  activeView: 'dashboard',
  displayCurrency: null,
  selectedInstrumentId: null,
  setActivePortfolio: (portfolio) =>
    set({ activePortfolio: portfolio, displayCurrency: get().displayCurrency ?? portfolio.baseCurrency }),
  setActiveView: (view) => set({ activeView: view }),
  setDisplayCurrency: (currency) => set({ displayCurrency: currency }),
  viewHoldingDetail: (instrumentId) => set({ activeView: 'holding-detail', selectedInstrumentId: instrumentId }),
}));

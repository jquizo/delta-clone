export type Currency = 'AUD' | 'USD' | 'GBP' | 'SGD' | string;
export type Exchange = 'ASX' | 'NASDAQ' | 'NYSE' | 'ARCA' | 'LSE' | 'SGX' | 'OTC';

/**
 * Instrument.id is provider-neutral ('ASX:BHP'), never the raw Yahoo
 * symbol ('BHP.AX'). See CLAUDE.md — this is what keeps a future
 * provider swap to a one-file change instead of a data migration.
 */
export interface Instrument {
  id: string;
  exchange: Exchange;
  currency: Currency;
  name: string;
}

/** The only financial facts stored. Everything else is derived. */
export interface Transaction {
  id: string;
  portfolioId: string;
  instrumentId: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND';
  quantity: number;
  price: number;
  fees: number;
  currency: Currency;
  tradeDate: string; // 'YYYY-MM-DD'
  fxRateToBase?: number;
  /** true when fxRateToBase defaulted to 1 because no cached rate was available at entry time. */
  fxRateFlagged?: boolean;
  note?: string;
}

export interface Portfolio {
  id: string;
  name: string;
  baseCurrency: Currency;
}

/** DERIVED — never persisted. Recomputed from transactions on every read. */
export interface Holding {
  instrumentId: string;
  quantity: number;
  avgCostPerShare: number;
  totalCost: number;
  realizedPnl: number;
}

export interface PriceQuote {
  instrumentId: string;
  price: number;
  currency: Currency;
  previousClose: number;
  marketState: 'OPEN' | 'CLOSED' | 'PRE' | 'POST';
  asOf: number; // epoch ms
}

export interface FxRate {
  pair: string; // 'USDAUD'
  rate: number;
  asOf: number;
  source: 'yahoo' | 'frankfurter';
}

/** Persisted once per day — makes the history chart possible later, cheaply. */
export interface DailySnapshot {
  id: string; // `${portfolioId}:${date}`
  portfolioId: string;
  date: string;
  valueInBase: number;
  costInBase: number;
}

export type HistoryRange = '1M' | '6M' | '1Y' | '5Y';

export interface HistoryPoint {
  date: string; // 'YYYY-MM-DD'
  close: number;
}

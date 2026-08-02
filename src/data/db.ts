import Dexie, { type EntityTable } from 'dexie';
import type { DailySnapshot, HistoryPoint, HistoryRange, Instrument, Portfolio, PriceQuote, Transaction } from '../domain/types';

/** Cached `/history` response for one instrument + range, with a fetch timestamp for TTL checks. */
export interface PriceHistoryCacheEntry {
  id: string; // `${instrumentId}:${range}`
  instrumentId: string;
  range: HistoryRange;
  points: HistoryPoint[];
  fetchedAt: number;
}

export class DeltaCloneDB extends Dexie {
  portfolios!: EntityTable<Portfolio, 'id'>;
  instruments!: EntityTable<Instrument, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  quotesCache!: EntityTable<PriceQuote, 'instrumentId'>;
  snapshots!: EntityTable<DailySnapshot, 'id'>;
  priceHistory!: EntityTable<PriceHistoryCacheEntry, 'id'>;

  constructor() {
    super('delta-clone');
    this.version(1).stores({
      portfolios: 'id',
      instruments: 'id, exchange',
      transactions: 'id, portfolioId, instrumentId, tradeDate',
      quotesCache: 'instrumentId',
      snapshots: 'id, portfolioId, date',
      priceHistory: 'id, instrumentId',
    });
  }
}

export const db = new DeltaCloneDB();

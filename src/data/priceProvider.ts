import type { HistoryPoint, HistoryRange, Instrument, PriceQuote } from '../domain/types';

export interface PriceProvider {
  getQuotes(instrumentIds: string[]): Promise<PriceQuote[]>;
  searchInstruments(query: string): Promise<Instrument[]>;
  getHistory(instrumentId: string, range: HistoryRange): Promise<HistoryPoint[]>;
}

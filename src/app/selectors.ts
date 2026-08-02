import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';
import { deriveHoldings, type DeriveHoldingsResult } from '../domain/holdings';
import type { DailySnapshot, Instrument, Transaction } from '../domain/types';

/** Streams this portfolio's transactions from Dexie and derives holdings on every change. */
export function useHoldings(portfolioId: string | null): DeriveHoldingsResult | undefined {
  return useLiveQuery(async () => {
    if (!portfolioId) return undefined;
    const transactions = await db.transactions.where('portfolioId').equals(portfolioId).toArray();
    return deriveHoldings(transactions);
  }, [portfolioId]);
}

export function useInstruments(): Instrument[] | undefined {
  return useLiveQuery(() => db.instruments.toArray(), []);
}

export function useTransactions(portfolioId: string | null): Transaction[] | undefined {
  return useLiveQuery(async () => {
    if (!portfolioId) return [];
    return db.transactions.where('portfolioId').equals(portfolioId).toArray();
  }, [portfolioId]);
}

export function useSnapshots(portfolioId: string | null): DailySnapshot[] {
  const result = useLiveQuery(async () => {
    if (!portfolioId) return [];
    const all = await db.snapshots.where('portfolioId').equals(portfolioId).toArray();
    return all.sort((a, b) => a.date.localeCompare(b.date));
  }, [portfolioId]);

  return result ?? [];
}

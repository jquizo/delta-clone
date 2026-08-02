import { quantityHeldAsOf } from '../domain/holdings';
import type { DailySnapshot, HistoryPoint, HistoryRange, Instrument, Portfolio, PriceQuote, Transaction } from '../domain/types';
import { db } from './db';
import { InstrumentSchema, PortfolioSchema, PriceQuoteSchema, TransactionInputSchema } from './schemas';

const HISTORY_TTL_MS = 60 * 60 * 1000; // daily-granularity data doesn't need to be fresher than an hour.

export class SellExceedsHoldingError extends Error {}

async function assertSellDoesNotExceedHolding(transaction: Transaction, excludeTransactionId?: string): Promise<void> {
  if (transaction.type !== 'SELL') return;

  const others = (await db.transactions.toArray()).filter((t) => t.id !== excludeTransactionId);
  const held = quantityHeldAsOf(others, transaction.instrumentId, transaction.tradeDate);

  if (transaction.quantity > held) {
    throw new SellExceedsHoldingError(
      `Sell quantity ${transaction.quantity} exceeds held quantity ${held} as of ${transaction.tradeDate}`,
    );
  }
}

export const portfolioRepo = {
  async getAll(): Promise<Portfolio[]> {
    return db.portfolios.toArray();
  },

  async add(portfolio: Portfolio): Promise<Portfolio> {
    const validated = PortfolioSchema.parse(portfolio);
    await db.portfolios.add(validated);
    return validated;
  },

  /** Returns the first portfolio, creating a default one if none exists yet. */
  async ensureDefault(): Promise<Portfolio> {
    const existing = await db.portfolios.toCollection().first();
    if (existing) return existing;

    return portfolioRepo.add({ id: crypto.randomUUID(), name: 'Personal', baseCurrency: 'AUD' });
  },

  async update(portfolio: Portfolio): Promise<Portfolio> {
    const validated = PortfolioSchema.parse(portfolio);
    await db.portfolios.put(validated);
    return validated;
  },
};

export const instrumentRepo = {
  async getAll(): Promise<Instrument[]> {
    return db.instruments.toArray();
  },

  async upsert(instrument: Instrument): Promise<Instrument> {
    const validated = InstrumentSchema.parse(instrument);
    await db.instruments.put(validated);
    return validated;
  },
};

export const transactionRepo = {
  async getAll(): Promise<Transaction[]> {
    return db.transactions.toArray();
  },

  async add(input: Omit<Transaction, 'id'> & { id?: string }): Promise<Transaction> {
    const candidate = { ...input, id: input.id ?? crypto.randomUUID() };
    const validated = TransactionInputSchema.parse(candidate) as Transaction;

    await assertSellDoesNotExceedHolding(validated);

    await db.transactions.add(validated);
    return validated;
  },

  async update(transaction: Transaction): Promise<Transaction> {
    const validated = TransactionInputSchema.parse(transaction) as Transaction;

    await assertSellDoesNotExceedHolding(validated, validated.id);

    await db.transactions.put(validated);
    return validated;
  },

  async remove(id: string): Promise<void> {
    await db.transactions.delete(id);
  },

  /** All-or-nothing: replays inputs in trade-date order inside one Dexie transaction, so any single invalid row rolls back the whole batch. */
  async bulkAdd(inputs: Array<Omit<Transaction, 'id'> & { id?: string }>): Promise<Transaction[]> {
    return db.transaction('rw', db.transactions, async () => {
      const sorted = [...inputs].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
      const saved: Transaction[] = [];
      for (const input of sorted) {
        saved.push(await transactionRepo.add(input));
      }
      return saved;
    });
  },
};

export const quotesCacheRepo = {
  /** Persists last-good quotes so the app can hydrate from cache when the provider fails. */
  async saveQuotes(quotes: PriceQuote[]): Promise<void> {
    if (quotes.length === 0) return;
    await db.quotesCache.bulkPut(quotes.map((q) => PriceQuoteSchema.parse(q)));
  },

  async getQuotes(instrumentIds: string[]): Promise<PriceQuote[]> {
    if (instrumentIds.length === 0) return [];
    const found = await db.quotesCache.bulkGet(instrumentIds);
    return found
      .filter((q): q is PriceQuote => q !== undefined)
      .flatMap((q) => {
        const parsed = PriceQuoteSchema.safeParse(q);
        return parsed.success ? [parsed.data] : [];
      });
  },
};

export const priceHistoryRepo = {
  async getCached(instrumentId: string, range: HistoryRange, now: number = Date.now()): Promise<HistoryPoint[] | undefined> {
    const entry = await db.priceHistory.get(`${instrumentId}:${range}`);
    if (!entry) return undefined;
    if (now - entry.fetchedAt > HISTORY_TTL_MS) return undefined;
    return entry.points;
  },

  async save(instrumentId: string, range: HistoryRange, points: HistoryPoint[], fetchedAt: number = Date.now()): Promise<void> {
    await db.priceHistory.put({ id: `${instrumentId}:${range}`, instrumentId, range, points, fetchedAt });
  },
};

export const snapshotRepo = {
  async hasSnapshotForDate(portfolioId: string, date: string): Promise<boolean> {
    const existing = await db.snapshots.get(`${portfolioId}:${date}`);
    return existing !== undefined;
  },

  async add(snapshot: Omit<DailySnapshot, 'id'>): Promise<DailySnapshot> {
    const withId = { ...snapshot, id: `${snapshot.portfolioId}:${snapshot.date}` };
    await db.snapshots.put(withId);
    return withId;
  },

  async getAll(portfolioId: string): Promise<DailySnapshot[]> {
    const all = await db.snapshots.where('portfolioId').equals(portfolioId).toArray();
    return all.sort((a, b) => a.date.localeCompare(b.date));
  },
};

/** Danger zone: empties every table. Used by Settings' "wipe all data" action. */
export async function wipeAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.transactions, db.instruments, db.portfolios, db.quotesCache, db.snapshots, db.priceHistory],
    async () => {
      await Promise.all([
        db.transactions.clear(),
        db.instruments.clear(),
        db.portfolios.clear(),
        db.quotesCache.clear(),
        db.snapshots.clear(),
        db.priceHistory.clear(),
      ]);
    },
  );
}

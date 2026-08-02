import type { Holding, Transaction } from './types';

export interface HoldingWarning {
  transactionId: string;
  instrumentId: string;
  message: string;
}

export interface DeriveHoldingsResult {
  holdings: Holding[];
  warnings: HoldingWarning[];
}

/**
 * Derives per-instrument holdings from a transaction history using the
 * average-cost method. Transactions are replayed in trade-date order.
 * A SELL that would exceed the quantity held as of that date is flagged
 * as a warning and skipped — the running holding state is left untouched
 * rather than allowed to go negative.
 */
export function deriveHoldings(transactions: Transaction[]): DeriveHoldingsResult {
  const ordered = [...transactions].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));

  const holdingsByInstrument = new Map<string, Holding>();
  const warnings: HoldingWarning[] = [];

  const getOrCreate = (instrumentId: string): Holding => {
    let holding = holdingsByInstrument.get(instrumentId);
    if (!holding) {
      holding = { instrumentId, quantity: 0, avgCostPerShare: 0, totalCost: 0, realizedPnl: 0 };
      holdingsByInstrument.set(instrumentId, holding);
    }
    return holding;
  };

  for (const transaction of ordered) {
    const holding = getOrCreate(transaction.instrumentId);

    if (transaction.type === 'BUY') {
      const cost = transaction.quantity * transaction.price + transaction.fees;
      holding.totalCost += cost;
      holding.quantity += transaction.quantity;
      holding.avgCostPerShare = holding.quantity === 0 ? 0 : holding.totalCost / holding.quantity;
      continue;
    }

    if (transaction.type === 'SELL') {
      if (transaction.quantity > holding.quantity) {
        warnings.push({
          transactionId: transaction.id,
          instrumentId: transaction.instrumentId,
          message: `Sell quantity ${transaction.quantity} exceeds held quantity ${holding.quantity} as of ${transaction.tradeDate}`,
        });
        continue;
      }

      const proceeds = transaction.quantity * transaction.price - transaction.fees;
      const costRemoved = transaction.quantity * holding.avgCostPerShare;

      holding.realizedPnl += proceeds - costRemoved;
      holding.totalCost -= costRemoved;
      holding.quantity -= transaction.quantity;

      if (holding.quantity === 0) {
        holding.totalCost = 0;
        holding.avgCostPerShare = 0;
      }
      continue;
    }

    // DIVIDEND: cash only, no quantity or cost-basis change.
  }

  return { holdings: [...holdingsByInstrument.values()], warnings };
}

/**
 * Quantity of `instrumentId` held as of `asOfDate` (inclusive), replaying
 * only transactions up to that date. `excludeTransactionId` lets an
 * in-place edit be validated against the holding as it stood before that
 * transaction was applied.
 */
export function quantityHeldAsOf(
  transactions: Transaction[],
  instrumentId: string,
  asOfDate: string,
  excludeTransactionId?: string,
): number {
  const relevant = transactions.filter(
    (t) => t.instrumentId === instrumentId && t.tradeDate <= asOfDate && t.id !== excludeTransactionId,
  );
  const { holdings } = deriveHoldings(relevant);
  return holdings.find((h) => h.instrumentId === instrumentId)?.quantity ?? 0;
}

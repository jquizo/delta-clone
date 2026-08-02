import type { Transaction } from './types';

export type TransactionLike = Pick<Transaction, 'instrumentId' | 'tradeDate' | 'type' | 'quantity' | 'price'>;

/** Two transactions are duplicates if they agree on instrument, date, type, quantity, and price. */
export function isDuplicateTransaction(a: TransactionLike, b: TransactionLike): boolean {
  return (
    a.instrumentId === b.instrumentId &&
    a.tradeDate === b.tradeDate &&
    a.type === b.type &&
    a.quantity === b.quantity &&
    a.price === b.price
  );
}

import { stringifyCsv } from './csv';
import type { Exchange, Instrument, Transaction } from '../domain/types';

/**
 * Documented CSV column format for transaction export/import. `id` is exported
 * for reference but ignored on import (a fresh id is always assigned) so that
 * re-importing never depends on a specific UUID being free. `portfolioId` is
 * deliberately not a column — import always targets the currently active
 * portfolio, since a portfolio id from one database is meaningless in another.
 */
export const CSV_COLUMNS = [
  'id',
  'instrumentId',
  'exchange',
  'instrumentName',
  'type',
  'quantity',
  'price',
  'fees',
  'currency',
  'tradeDate',
  'fxRateToBase',
  'fxRateFlagged',
  'note',
] as const;

function exchangeOf(instrumentId: string): Exchange {
  return instrumentId.split(':')[0] as Exchange;
}

export function exportTransactionsCsv(transactions: Transaction[], instruments: Instrument[]): string {
  const instrumentById = new Map(instruments.map((i) => [i.id, i]));

  const rows = transactions.map((t) => {
    const instrument = instrumentById.get(t.instrumentId);
    return [
      t.id,
      t.instrumentId,
      instrument?.exchange ?? exchangeOf(t.instrumentId),
      instrument?.name ?? '',
      t.type,
      String(t.quantity),
      String(t.price),
      String(t.fees),
      t.currency,
      t.tradeDate,
      t.fxRateToBase !== undefined ? String(t.fxRateToBase) : '',
      t.fxRateFlagged !== undefined ? String(t.fxRateFlagged) : '',
      t.note ?? '',
    ];
  });

  return stringifyCsv([[...CSV_COLUMNS], ...rows]);
}

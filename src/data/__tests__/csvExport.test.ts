import { describe, expect, test } from 'vitest';
import { CSV_COLUMNS, exportTransactionsCsv } from '../csvExport';
import type { Instrument, Transaction } from '../../domain/types';

const instruments: Instrument[] = [{ id: 'ASX:BHP', exchange: 'ASX', currency: 'AUD', name: 'BHP Group Ltd' }];

const transactions: Transaction[] = [
  {
    id: 't1',
    portfolioId: 'p1',
    instrumentId: 'ASX:BHP',
    type: 'BUY',
    quantity: 100,
    price: 40,
    fees: 10,
    currency: 'AUD',
    tradeDate: '2024-01-01',
    fxRateToBase: 1,
    fxRateFlagged: false,
  },
  {
    id: 't2',
    portfolioId: 'p1',
    instrumentId: 'NASDAQ:AAPL',
    type: 'DIVIDEND',
    quantity: 0,
    price: 12,
    fees: 0,
    currency: 'USD',
    tradeDate: '2024-02-01',
    note: 'quarterly, "nice"',
  },
];

describe('exportTransactionsCsv', () => {
  test('writes the documented header row', () => {
    const csv = exportTransactionsCsv(transactions, instruments);
    expect(csv.split('\n')[0]).toBe(CSV_COLUMNS.join(','));
  });

  test('writes a fully-populated row, resolving instrument metadata from the instruments list', () => {
    const csv = exportTransactionsCsv([transactions[0]], instruments);
    const [, row] = csv.split('\n');
    expect(row).toBe('t1,ASX:BHP,ASX,BHP Group Ltd,BUY,100,40,10,AUD,2024-01-01,1,false,');
  });

  test('leaves optional fields blank when absent, and derives exchange from the id when the instrument is unknown', () => {
    const csv = exportTransactionsCsv([transactions[1]], []);
    const [, row] = csv.split('\n');
    expect(row).toBe('t2,NASDAQ:AAPL,NASDAQ,,DIVIDEND,0,12,0,USD,2024-02-01,,,"quarterly, ""nice"""');
  });

  test('round-trips an empty transaction list to just the header row', () => {
    expect(exportTransactionsCsv([], [])).toBe(CSV_COLUMNS.join(','));
  });
});

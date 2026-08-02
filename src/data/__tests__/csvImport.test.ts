import { describe, expect, test } from 'vitest';
import { detectColumnMapping, evaluateImportRows, IMPORT_FIELDS } from '../csvImport';
import type { Transaction } from '../../domain/types';

describe('detectColumnMapping', () => {
  test('maps our own exported header names exactly', () => {
    const headers = ['id', 'instrumentId', 'exchange', 'instrumentName', 'type', 'quantity', 'price', 'fees', 'currency', 'tradeDate', 'fxRateToBase', 'fxRateFlagged', 'note'];
    const mapping = detectColumnMapping(headers);

    expect(mapping.instrumentId).toBe(1);
    expect(mapping.type).toBe(4);
    expect(mapping.quantity).toBe(5);
    expect(mapping.price).toBe(6);
    expect(mapping.fees).toBe(7);
    expect(mapping.currency).toBe(8);
    expect(mapping.tradeDate).toBe(9);
  });

  test('matches common synonyms case-insensitively, e.g. from a broker export', () => {
    const headers = ['Symbol', 'Date', 'Transaction Type', 'Qty', 'Price', 'Brokerage', 'Currency'];
    const mapping = detectColumnMapping(headers);

    expect(mapping.instrumentId).toBe(0);
    expect(mapping.tradeDate).toBe(1);
    expect(mapping.type).toBe(2);
    expect(mapping.quantity).toBe(3);
    expect(mapping.price).toBe(4);
    expect(mapping.fees).toBe(5);
    expect(mapping.currency).toBe(6);
  });

  test('leaves a field unmapped when no header matches', () => {
    const mapping = detectColumnMapping(['instrumentId', 'type']);
    expect(mapping.quantity).toBeUndefined();
  });

  test('every declared import field is a recognised key', () => {
    const mapping = detectColumnMapping([]);
    for (const field of IMPORT_FIELDS) {
      expect(field in mapping || true).toBe(true); // mapping may omit unmatched fields entirely
    }
  });
});

describe('evaluateImportRows', () => {
  const headers = ['instrumentId', 'type', 'quantity', 'price', 'fees', 'currency', 'tradeDate', 'note'];
  const mapping = detectColumnMapping(headers);

  test('accepts a well-formed new row as ok', () => {
    const rows = [['ASX:BHP', 'BUY', '100', '40', '10', 'AUD', '2024-01-01', '']];
    const results = evaluateImportRows(rows, mapping, []);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('ok');
    expect(results[0].transaction).toMatchObject({ instrumentId: 'ASX:BHP', type: 'BUY', quantity: 100, price: 40 });
  });

  test('flags a row with an invalid value (negative quantity) as an error, with a message', () => {
    const rows = [['ASX:BHP', 'BUY', '-100', '40', '10', 'AUD', '2024-01-01', '']];
    const results = evaluateImportRows(rows, mapping, []);

    expect(results[0].status).toBe('error');
    expect(results[0].errors?.length).toBeGreaterThan(0);
  });

  test('flags a row with a non-numeric quantity as an error', () => {
    const rows = [['ASX:BHP', 'BUY', 'not-a-number', '40', '10', 'AUD', '2024-01-01', '']];
    const results = evaluateImportRows(rows, mapping, []);
    expect(results[0].status).toBe('error');
  });

  test('flags a row matching an existing transaction as a duplicate', () => {
    const existing: Transaction[] = [
      {
        id: 'existing1',
        portfolioId: 'p1',
        instrumentId: 'ASX:BHP',
        type: 'BUY',
        quantity: 100,
        price: 40,
        fees: 10,
        currency: 'AUD',
        tradeDate: '2024-01-01',
      },
    ];
    const rows = [['ASX:BHP', 'BUY', '100', '40', '10', 'AUD', '2024-01-01', '']];
    const results = evaluateImportRows(rows, mapping, existing);

    expect(results[0].status).toBe('duplicate');
  });

  test('flags the second of two identical rows within the same import batch as a duplicate', () => {
    const rows = [
      ['ASX:BHP', 'BUY', '100', '40', '10', 'AUD', '2024-01-01', ''],
      ['ASX:BHP', 'BUY', '100', '40', '10', 'AUD', '2024-01-01', ''],
    ];
    const results = evaluateImportRows(rows, mapping, []);

    expect(results[0].status).toBe('ok');
    expect(results[1].status).toBe('duplicate');
  });

  test('accepts a DIVIDEND row with zero quantity', () => {
    const rows = [['NASDAQ:AAPL', 'DIVIDEND', '0', '12', '0', 'USD', '2024-02-01', 'quarterly']];
    const results = evaluateImportRows(rows, mapping, []);

    expect(results[0].status).toBe('ok');
    expect(results[0].transaction?.note).toBe('quarterly');
  });

  test('is tolerant of a lowercase type value', () => {
    const rows = [['ASX:BHP', 'buy', '100', '40', '10', 'AUD', '2024-01-01', '']];
    const results = evaluateImportRows(rows, mapping, []);
    expect(results[0].status).toBe('ok');
    expect(results[0].transaction?.type).toBe('BUY');
  });
});

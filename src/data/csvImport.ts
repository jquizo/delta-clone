import { isDuplicateTransaction } from '../domain/duplicateDetection';
import type { Currency, Exchange, Transaction } from '../domain/types';
import { TransactionInputSchema } from './schemas';

export type ImportField =
  | 'instrumentId'
  | 'exchange'
  | 'instrumentName'
  | 'type'
  | 'quantity'
  | 'price'
  | 'fees'
  | 'currency'
  | 'tradeDate'
  | 'note';

export const IMPORT_FIELDS: ImportField[] = [
  'instrumentId',
  'exchange',
  'instrumentName',
  'type',
  'quantity',
  'price',
  'fees',
  'currency',
  'tradeDate',
  'note',
];

const REQUIRED_FIELDS: ImportField[] = ['instrumentId', 'type', 'quantity', 'price', 'fees', 'currency', 'tradeDate'];

const FIELD_SYNONYMS: Record<ImportField, string[]> = {
  instrumentId: ['instrumentid', 'instrument', 'symbol'],
  exchange: ['exchange', 'market'],
  instrumentName: ['instrumentname', 'name'],
  type: ['type', 'transactiontype'],
  quantity: ['quantity', 'qty', 'shares'],
  price: ['price', 'priceperunit', 'priceper share', 'pricepershare'],
  fees: ['fees', 'brokerage', 'commission'],
  currency: ['currency'],
  tradeDate: ['tradedate', 'date'],
  note: ['note', 'notes'],
};

function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[\s_-]/g, '');
}

export type ColumnMapping = Partial<Record<ImportField, number>>;

/** Auto-detects which CSV column corresponds to each known field, by name (case/spacing-insensitive). */
export function detectColumnMapping(headers: string[]): ColumnMapping {
  const normalised = headers.map(normaliseHeader);
  const mapping: ColumnMapping = {};

  for (const field of IMPORT_FIELDS) {
    const index = normalised.findIndex((h) => FIELD_SYNONYMS[field].includes(h));
    if (index !== -1) mapping[field] = index;
  }

  return mapping;
}

export interface ImportCandidate {
  instrumentId: string;
  exchange?: Exchange;
  instrumentName?: string;
  type: Transaction['type'];
  quantity: number;
  price: number;
  fees: number;
  currency: Currency;
  tradeDate: string;
  note?: string;
}

export interface ImportRowResult {
  rowIndex: number;
  status: 'ok' | 'error' | 'duplicate';
  transaction?: ImportCandidate;
  errors?: string[];
}

function cell(row: string[], mapping: ColumnMapping, field: ImportField): string | undefined {
  const index = mapping[field];
  if (index === undefined) return undefined;
  return row[index]?.trim();
}

function parseRowToCandidate(row: string[], mapping: ColumnMapping): { candidate: ImportCandidate } | { error: string } {
  for (const field of REQUIRED_FIELDS) {
    if (!cell(row, mapping, field)) {
      return { error: `Missing required field: ${field}` };
    }
  }

  const quantityRaw = cell(row, mapping, 'quantity')!;
  const priceRaw = cell(row, mapping, 'price')!;
  const feesRaw = cell(row, mapping, 'fees')!;

  const quantity = Number(quantityRaw);
  const price = Number(priceRaw);
  const fees = Number(feesRaw);
  if (Number.isNaN(quantity)) return { error: `Quantity is not a number: "${quantityRaw}"` };
  if (Number.isNaN(price)) return { error: `Price is not a number: "${priceRaw}"` };
  if (Number.isNaN(fees)) return { error: `Fees is not a number: "${feesRaw}"` };

  const typeRaw = cell(row, mapping, 'type')!.toUpperCase();
  if (typeRaw !== 'BUY' && typeRaw !== 'SELL' && typeRaw !== 'DIVIDEND') {
    return { error: `Type must be BUY, SELL, or DIVIDEND: "${typeRaw}"` };
  }

  const candidate: ImportCandidate = {
    instrumentId: cell(row, mapping, 'instrumentId')!,
    type: typeRaw,
    quantity,
    price,
    fees,
    currency: cell(row, mapping, 'currency')!,
    tradeDate: cell(row, mapping, 'tradeDate')!,
  };

  const exchange = cell(row, mapping, 'exchange');
  if (exchange) candidate.exchange = exchange as Exchange;
  const instrumentName = cell(row, mapping, 'instrumentName');
  if (instrumentName) candidate.instrumentName = instrumentName;
  const note = cell(row, mapping, 'note');
  if (note) candidate.note = note;

  return { candidate };
}

/**
 * Validates and de-duplicates every CSV row: parse errors and zod validation
 * failures are flagged as 'error'; rows matching an existing transaction or an
 * earlier row in the same batch are flagged as 'duplicate'. Only 'ok' rows are
 * meant to be imported.
 */
export function evaluateImportRows(
  rows: string[][],
  mapping: ColumnMapping,
  existingTransactions: Transaction[],
): ImportRowResult[] {
  const results: ImportRowResult[] = [];
  const acceptedSoFar: ImportCandidate[] = [];

  rows.forEach((row, rowIndex) => {
    const parsed = parseRowToCandidate(row, mapping);
    if ('error' in parsed) {
      results.push({ rowIndex, status: 'error', errors: [parsed.error] });
      return;
    }

    const { candidate } = parsed;

    const validation = TransactionInputSchema.safeParse({ id: 'dry-run', portfolioId: 'dry-run', ...candidate });
    if (!validation.success) {
      results.push({ rowIndex, status: 'error', errors: validation.error.issues.map((i) => i.message) });
      return;
    }

    const isDuplicate =
      existingTransactions.some((t) => isDuplicateTransaction(t, candidate)) ||
      acceptedSoFar.some((t) => isDuplicateTransaction(t, candidate));

    if (isDuplicate) {
      results.push({ rowIndex, status: 'duplicate', transaction: candidate });
      return;
    }

    acceptedSoFar.push(candidate);
    results.push({ rowIndex, status: 'ok', transaction: candidate });
  });

  return results;
}

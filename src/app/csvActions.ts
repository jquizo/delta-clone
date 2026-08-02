import { parseCsv } from '../data/csv';
import { detectColumnMapping, evaluateImportRows, type ColumnMapping, type ImportRowResult } from '../data/csvImport';
import { exportTransactionsCsv } from '../data/csvExport';
import { instrumentRepo, transactionRepo } from '../data/repositories';

export async function exportPortfolioCsv(portfolioId: string): Promise<string> {
  const [allTransactions, instruments] = await Promise.all([transactionRepo.getAll(), instrumentRepo.getAll()]);
  const transactions = allTransactions.filter((t) => t.portfolioId === portfolioId);
  return exportTransactionsCsv(transactions, instruments);
}

/** Reads the CSV's header row and auto-detects the column mapping, for the mapping-preview UI. */
export function detectMappingFromCsv(csvText: string): { headers: string[]; mapping: ColumnMapping } {
  const [header] = parseCsv(csvText);
  const headers = header ?? [];
  return { headers, mapping: detectColumnMapping(headers) };
}

/** Parses and validates every row of `csvText` against the portfolio's existing transactions, using an explicit column mapping. Writes nothing. */
export async function dryRunImportWithMapping(
  csvText: string,
  mapping: ColumnMapping,
  portfolioId: string,
): Promise<ImportRowResult[]> {
  const [, ...dataRows] = parseCsv(csvText);
  const existing = (await transactionRepo.getAll()).filter((t) => t.portfolioId === portfolioId);
  return evaluateImportRows(dataRows, mapping, existing);
}

/** Same as dryRunImportWithMapping, but auto-detects the column mapping from the CSV's own header row. */
export async function dryRunImport(csvText: string, portfolioId: string): Promise<ImportRowResult[]> {
  const { mapping } = detectMappingFromCsv(csvText);
  return dryRunImportWithMapping(csvText, mapping, portfolioId);
}

/** Writes only the 'ok' rows from a dry run, atomically, upserting any instrument metadata they carried. */
export async function confirmImport(dryRun: ImportRowResult[], portfolioId: string): Promise<void> {
  const okRows = dryRun.filter((r) => r.status === 'ok' && r.transaction);

  for (const row of okRows) {
    const { instrumentId, exchange, instrumentName, currency } = row.transaction!;
    if (exchange && instrumentName) {
      await instrumentRepo.upsert({ id: instrumentId, exchange, currency, name: instrumentName });
    }
  }

  await transactionRepo.bulkAdd(
    okRows.map((r) => ({
      portfolioId,
      instrumentId: r.transaction!.instrumentId,
      type: r.transaction!.type,
      quantity: r.transaction!.quantity,
      price: r.transaction!.price,
      fees: r.transaction!.fees,
      currency: r.transaction!.currency,
      tradeDate: r.transaction!.tradeDate,
      note: r.transaction!.note,
    })),
  );
}

import { useState, type ChangeEvent } from 'react';
import { confirmImport, detectMappingFromCsv, dryRunImportWithMapping, exportPortfolioCsv } from '../../app/csvActions';
import { useToastStore } from '../../app/toastStore';
import { IMPORT_FIELDS, type ColumnMapping, type ImportField, type ImportRowResult } from '../../data/csvImport';
import type { Portfolio } from '../../domain/types';

const FIELD_LABELS: Record<ImportField, string> = {
  instrumentId: 'Instrument',
  exchange: 'Exchange',
  instrumentName: 'Instrument name',
  type: 'Type',
  quantity: 'Quantity',
  price: 'Price',
  fees: 'Fees',
  currency: 'Currency',
  tradeDate: 'Trade date',
  note: 'Note',
};

interface CsvImportExportProps {
  portfolio: Portfolio;
  onImported: () => void;
}

export function CsvImportExport({ portfolio, onImported }: CsvImportExportProps) {
  const [csvText, setCsvText] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [dryRun, setDryRun] = useState<ImportRowResult[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const addToast = useToastStore((s) => s.addToast);

  async function handleExport() {
    try {
      const csv = await exportPortfolioCsv(portfolio.id);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions-${portfolio.id}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Export failed');
    }
  }

  async function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const text = await file.text();
    const { headers: detectedHeaders, mapping: detectedMapping } = detectMappingFromCsv(text);

    setCsvText(text);
    setHeaders(detectedHeaders);
    setMapping(detectedMapping);
    setDryRun(null);
    setImportedCount(null);
    setImportError(null);
  }

  async function handlePreview() {
    if (!csvText) return;
    setDryRun(await dryRunImportWithMapping(csvText, mapping, portfolio.id));
  }

  async function handleConfirm() {
    if (!dryRun) return;
    setImportError(null);
    try {
      const okCount = dryRun.filter((r) => r.status === 'ok').length;
      await confirmImport(dryRun, portfolio.id);
      setImportedCount(okCount);
      setCsvText(null);
      setHeaders([]);
      setMapping({});
      setDryRun(null);
      onImported();
      addToast(`Imported ${okCount} transaction${okCount === 1 ? '' : 's'}.`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed';
      setImportError(message);
      addToast(message);
    }
  }

  const okCount = dryRun?.filter((r) => r.status === 'ok').length ?? 0;
  const duplicateCount = dryRun?.filter((r) => r.status === 'duplicate').length ?? 0;
  const errorCount = dryRun?.filter((r) => r.status === 'error').length ?? 0;

  return (
    <div className="mb-6 rounded-xl border border-hairline bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-medium text-ink">CSV import / export</h2>

      <button
        type="button"
        onClick={handleExport}
        className="mb-4 rounded-md border border-hairline bg-paper px-3 py-2 text-sm text-ink hover:bg-hairline"
      >
        Export CSV
      </button>

      <div className="mb-2">
        <label htmlFor="csv-file" className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
          Import CSV
        </label>
        <input id="csv-file" type="file" accept=".csv,text/csv" onChange={handleFileSelected} className="block text-sm text-ink" />
      </div>

      {headers.length > 0 && (
        <div className="mb-4 rounded-lg border border-hairline bg-paper p-3">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Column mapping</h3>
          <div className="grid grid-cols-2 gap-3">
            {IMPORT_FIELDS.map((field) => (
              <div key={field}>
                <label htmlFor={`mapping-${field}`} className="mb-1 block text-xs text-muted">
                  {FIELD_LABELS[field]}
                </label>
                <select
                  id={`mapping-${field}`}
                  value={mapping[field] ?? ''}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [field]: e.target.value === '' ? undefined : Number(e.target.value) }))
                  }
                  className="w-full rounded-md border border-hairline bg-white px-2 py-1 text-sm text-ink"
                >
                  <option value="">— not mapped —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handlePreview}
            className="mt-3 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            Preview import
          </button>
        </div>
      )}

      {dryRun && (
        <div className="mb-4">
          <p className="mb-2 text-sm text-ink">
            {okCount} to import, {duplicateCount} duplicate{duplicateCount === 1 ? '' : 's'} skipped, {errorCount} error
            {errorCount === 1 ? '' : 's'}.
          </p>

          {errorCount > 0 && (
            <ul className="mb-2 space-y-1 text-xs text-negative">
              {dryRun
                .filter((r) => r.status === 'error')
                .map((r) => (
                  <li key={r.rowIndex}>
                    Row {r.rowIndex + 1}: {r.errors?.join('; ')}
                  </li>
                ))}
            </ul>
          )}

          {importError && <p className="mb-2 text-sm text-negative">{importError}</p>}

          <button
            type="button"
            onClick={handleConfirm}
            disabled={okCount === 0}
            className="rounded-md bg-positive px-3 py-2 text-sm font-medium text-white hover:bg-positive/90 disabled:opacity-50"
          >
            Confirm import ({okCount})
          </button>
        </div>
      )}

      {importedCount !== null && (
        <p role="status" className="text-sm text-positive">
          Imported {importedCount} transaction{importedCount === 1 ? '' : 's'}.
        </p>
      )}
    </div>
  );
}

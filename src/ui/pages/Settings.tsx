import { useState, type ChangeEvent } from 'react';
import { updateBaseCurrency, wipeAndResetPortfolio } from '../../app/portfolioActions';
import { exportPortfolioCsv } from '../../app/csvActions';
import { useToastStore } from '../../app/toastStore';
import type { Currency, Portfolio } from '../../domain/types';

const SUPPORTED_CURRENCIES: Currency[] = ['AUD', 'USD', 'GBP', 'SGD'];
const CONFIRM_PHRASE = 'DELETE';

interface SettingsPageProps {
  portfolio: Portfolio;
  onPortfolioUpdated: (portfolio: Portfolio) => void;
}

export function SettingsPage({ portfolio, onPortfolioUpdated }: SettingsPageProps) {
  const addToast = useToastStore((s) => s.addToast);
  const [confirmText, setConfirmText] = useState('');
  const [wiping, setWiping] = useState(false);

  async function handleBaseCurrencyChange(e: ChangeEvent<HTMLSelectElement>) {
    try {
      const updated = await updateBaseCurrency(portfolio, e.target.value as Currency);
      onPortfolioUpdated(updated);
      addToast('Base currency updated.', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to update base currency');
    }
  }

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

  async function handleWipe() {
    if (confirmText !== CONFIRM_PHRASE) return;

    setWiping(true);
    try {
      const fresh = await wipeAndResetPortfolio();
      onPortfolioUpdated(fresh);
      setConfirmText('');
      addToast('All local data has been erased.', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to wipe data');
    } finally {
      setWiping(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-xl font-semibold text-ink">Settings</h1>

      <section className="mb-6 rounded-xl border border-hairline bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-medium text-ink">Base currency</h2>
        <label htmlFor="base-currency" className="block text-sm text-muted">
          Portfolio base currency
        </label>
        <select
          id="base-currency"
          value={portfolio.baseCurrency}
          onChange={handleBaseCurrencyChange}
          className="mt-1 rounded-md border border-hairline bg-white px-2 py-1 text-sm text-ink"
        >
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </section>

      <section className="mb-6 rounded-xl border border-hairline bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-medium text-ink">Export</h2>
        <button
          type="button"
          onClick={handleExport}
          className="rounded-md border border-hairline bg-paper px-3 py-2 text-sm text-ink hover:bg-hairline"
        >
          Export all transactions (CSV)
        </button>
      </section>

      <section className="rounded-xl border border-negative/30 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-medium text-negative">Danger zone</h2>
        <p className="mb-2 text-sm text-muted">
          Permanently erases every portfolio, transaction, and cached price on this device. This cannot be undone.
        </p>
        <label htmlFor="wipe-confirm" className="block text-sm text-muted">
          Type <strong>{CONFIRM_PHRASE}</strong> to confirm
        </label>
        <input
          id="wipe-confirm"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="mb-2 mt-1 block rounded-md border border-hairline px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={handleWipe}
          disabled={confirmText !== CONFIRM_PHRASE || wiping}
          className="rounded-md bg-negative px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          Wipe all data
        </button>
      </section>
    </main>
  );
}

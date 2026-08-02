import { lazy, Suspense, useEffect } from 'react';
import { ensureDefaultPortfolio } from '../app/portfolioActions';
import { useAppStore } from '../app/store';
import { Dashboard } from './pages/Dashboard';
import { TransactionsPage } from './pages/Transactions';
import { SettingsPage } from './pages/Settings';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/Toaster';
import { ChartSkeleton } from './components/Skeleton';

// Lazy-loaded: pulls in lightweight-charts, which most sessions never need
// (only visited by clicking into a specific holding), so it shouldn't sit in
// the main bundle everyone downloads on first load.
const HoldingDetail = lazy(() => import('./pages/HoldingDetail').then((m) => ({ default: m.HoldingDetail })));

export function AppRoot() {
  const activePortfolio = useAppStore((s) => s.activePortfolio);
  const setActivePortfolio = useAppStore((s) => s.setActivePortfolio);
  const activeView = useAppStore((s) => s.activeView);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const selectedInstrumentId = useAppStore((s) => s.selectedInstrumentId);

  useEffect(() => {
    ensureDefaultPortfolio().then(setActivePortfolio);
  }, [setActivePortfolio]);

  if (!activePortfolio) {
    return <p className="p-6 text-sm text-muted">Loading…</p>;
  }

  const navItemClass = (view: typeof activeView) =>
    `border-b-2 pb-3 text-sm font-medium transition-colors ${
      activeView === view ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
    }`;

  return (
    <div className="min-h-screen bg-paper">
      <Toaster />
      <nav className="flex gap-6 border-b border-hairline-strong bg-paper px-5 pt-3">
        <button type="button" onClick={() => setActiveView('dashboard')} aria-current={activeView === 'dashboard'} className={navItemClass('dashboard')}>
          Dashboard
        </button>
        <button type="button" onClick={() => setActiveView('transactions')} aria-current={activeView === 'transactions'} className={navItemClass('transactions')}>
          Transactions
        </button>
        <button type="button" onClick={() => setActiveView('settings')} aria-current={activeView === 'settings'} className={navItemClass('settings')}>
          Settings
        </button>
      </nav>
      {activeView === 'transactions' && (
        <ErrorBoundary fallbackTitle="The transactions page hit a problem">
          <TransactionsPage portfolio={activePortfolio} />
        </ErrorBoundary>
      )}
      {activeView === 'holding-detail' && selectedInstrumentId && (
        <ErrorBoundary fallbackTitle="The holding detail page hit a problem">
          <Suspense fallback={<ChartSkeleton label="Loading price chart" height={300} />}>
            <HoldingDetail instrumentId={selectedInstrumentId} onBack={() => setActiveView('dashboard')} />
          </Suspense>
        </ErrorBoundary>
      )}
      {activeView === 'settings' && (
        <ErrorBoundary fallbackTitle="The settings page hit a problem">
          <SettingsPage portfolio={activePortfolio} onPortfolioUpdated={setActivePortfolio} />
        </ErrorBoundary>
      )}
      {activeView === 'dashboard' && (
        <ErrorBoundary fallbackTitle="The dashboard hit a problem">
          <Dashboard portfolio={activePortfolio} />
        </ErrorBoundary>
      )}
    </div>
  );
}

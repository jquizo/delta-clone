import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransactionsPage } from '../Transactions';
import { db } from '../../../data/db';
import { transactionRepo } from '../../../data/repositories';
import type { Portfolio } from '../../../domain/types';

const portfolio: Portfolio = { id: 'p1', name: 'Personal', baseCurrency: 'AUD' };

function renderPage() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <TransactionsPage portfolio={portfolio} />
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  await Promise.all([db.transactions.clear(), db.instruments.clear()]);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] }) as Response));
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe('TransactionsPage', () => {
  test('switching the edit target (without saving) updates the form to the newly-clicked row, not the previous one', async () => {
    await transactionRepo.add({
      portfolioId: portfolio.id,
      instrumentId: 'ASX:BHP',
      type: 'BUY',
      quantity: 100,
      price: 40,
      fees: 10,
      currency: 'AUD',
      tradeDate: '2024-01-01',
    });
    await transactionRepo.add({
      portfolioId: portfolio.id,
      instrumentId: 'NASDAQ:AAPL',
      type: 'BUY',
      quantity: 10,
      price: 150,
      fees: 5,
      currency: 'USD',
      tradeDate: '2024-01-10',
    });

    renderPage();

    await waitFor(() => expect(screen.getAllByRole('button', { name: /^edit$/i })).toHaveLength(2));
    // TransactionList sorts by trade date descending, so AAPL (2024-01-10) is first.
    const editButtons = screen.getAllByRole('button', { name: /^edit$/i });

    fireEvent.click(editButtons[0]);
    await waitFor(() => expect(screen.getByLabelText('Instrument')).toHaveValue('NASDAQ:AAPL'));

    fireEvent.click(editButtons[1]);
    await waitFor(() => expect(screen.getByLabelText('Instrument')).toHaveValue('ASX:BHP'));
    expect(screen.getByLabelText('Quantity')).toHaveValue(100);
  });
});

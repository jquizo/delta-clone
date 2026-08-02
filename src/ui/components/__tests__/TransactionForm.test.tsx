import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransactionForm } from '../TransactionForm';
import { db } from '../../../data/db';
import type { Portfolio } from '../../../domain/types';

const portfolio: Portfolio = { id: 'p1', name: 'Personal', baseCurrency: 'AUD' };

function renderForm(props: Partial<React.ComponentProps<typeof TransactionForm>> = {}) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <TransactionForm portfolio={portfolio} instruments={[]} onSaved={vi.fn()} {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  await Promise.all([db.transactions.clear(), db.instruments.clear()]);
  // No worker is running in this test; SymbolSearch's underlying query should
  // always resolve to no suggestions, leaving the manual-entry fallback in play.
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] }) as Response));
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe('TransactionForm', () => {
  test('shows a validation error and saves nothing when quantity is not positive', async () => {
    const onSaved = vi.fn();
    renderForm({ onSaved });

    fireEvent.change(screen.getByLabelText('Instrument'), { target: { value: 'ASX:BHP' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'BHP Group Ltd' } });
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Price per share'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: /add transaction/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/positive/i);
    expect(onSaved).not.toHaveBeenCalled();
    expect(await db.transactions.count()).toBe(0);
  });

  test('saves a well-formed BUY transaction, upserting the new instrument along the way', async () => {
    const onSaved = vi.fn();
    renderForm({ onSaved });

    fireEvent.change(screen.getByLabelText('Instrument'), { target: { value: 'ASX:BHP' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'BHP Group Ltd' } });
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Price per share'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: /add transaction/i }));

    await waitFor(async () => expect(await db.transactions.count()).toBe(1));
    expect(onSaved).toHaveBeenCalled();
    expect(await db.instruments.get('ASX:BHP')).toMatchObject({ name: 'BHP Group Ltd', exchange: 'ASX' });
  });

  test('blocks a SELL that exceeds current holdings', async () => {
    const onSaved = vi.fn();
    const instruments = [{ id: 'ASX:BHP', exchange: 'ASX' as const, currency: 'AUD', name: 'BHP Group Ltd' }];
    renderForm({ onSaved, instruments });

    fireEvent.change(screen.getByLabelText('Instrument'), { target: { value: 'ASX:BHP' } });
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'SELL' } });
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Price per share'), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: /add transaction/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/exceeds held quantity/i);
    expect(onSaved).not.toHaveBeenCalled();
  });

  test('moves focus to the instrument field when opened in edit mode', () => {
    const editing = {
      id: 't1',
      portfolioId: portfolio.id,
      instrumentId: 'ASX:BHP',
      type: 'BUY' as const,
      quantity: 100,
      price: 40,
      fees: 10,
      currency: 'AUD',
      tradeDate: '2024-01-01',
    };
    renderForm({ editing });

    expect(screen.getByLabelText('Instrument')).toHaveFocus();
  });
});

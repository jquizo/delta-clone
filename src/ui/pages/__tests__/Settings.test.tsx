import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPage } from '../Settings';
import { db } from '../../../data/db';
import { transactionRepo } from '../../../data/repositories';
import type { Portfolio } from '../../../domain/types';

const portfolio: Portfolio = { id: 'p1', name: 'Personal', baseCurrency: 'AUD' };

beforeEach(async () => {
  await Promise.all([db.transactions.clear(), db.portfolios.clear(), db.instruments.clear()]);
  await db.portfolios.put(portfolio);
});

describe('SettingsPage', () => {
  test('changing base currency persists it and notifies the parent', async () => {
    const onPortfolioUpdated = vi.fn();
    render(<SettingsPage portfolio={portfolio} onPortfolioUpdated={onPortfolioUpdated} />);

    fireEvent.change(screen.getByLabelText(/base currency/i), { target: { value: 'USD' } });

    await waitFor(() => expect(onPortfolioUpdated).toHaveBeenCalledWith(expect.objectContaining({ baseCurrency: 'USD' })));
    expect((await db.portfolios.get('p1'))?.baseCurrency).toBe('USD');
  });

  test('the wipe button is disabled until the confirmation phrase is typed exactly', () => {
    render(<SettingsPage portfolio={portfolio} onPortfolioUpdated={vi.fn()} />);

    const wipeButton = screen.getByRole('button', { name: /wipe all data/i });
    expect(wipeButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/type.*to confirm/i), { target: { value: 'delete' } });
    expect(wipeButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/type.*to confirm/i), { target: { value: 'DELETE' } });
    expect(wipeButton).not.toBeDisabled();
  });

  test('confirming the wipe erases all data and hands back a fresh portfolio', async () => {
    await transactionRepo.add({
      portfolioId: portfolio.id,
      instrumentId: 'ASX:BHP',
      type: 'BUY',
      quantity: 100,
      price: 40,
      fees: 0,
      currency: 'AUD',
      tradeDate: '2024-01-01',
    });

    const onPortfolioUpdated = vi.fn();
    render(<SettingsPage portfolio={portfolio} onPortfolioUpdated={onPortfolioUpdated} />);

    fireEvent.change(screen.getByLabelText(/type.*to confirm/i), { target: { value: 'DELETE' } });
    fireEvent.click(screen.getByRole('button', { name: /wipe all data/i }));

    await waitFor(() => expect(onPortfolioUpdated).toHaveBeenCalled());
    expect(await db.transactions.count()).toBe(0);
    expect(onPortfolioUpdated.mock.calls[0][0].id).not.toBe(portfolio.id);
  });
});

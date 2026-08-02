import 'fake-indexeddb/auto';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SymbolSearch } from '../SymbolSearch';
import { db } from '../../../data/db';
import type { Instrument } from '../../../domain/types';

function Harness({ onSelect }: { onSelect: (instrument: Instrument) => void }) {
  const [value, setValue] = useState('');
  return (
    <>
      <label htmlFor="instrumentId">Instrument</label>
      <SymbolSearch id="instrumentId" value={value} onChange={setValue} onSelect={onSelect} />
    </>
  );
}

function renderSearch() {
  const client = new QueryClient();
  const onSelect = vi.fn();
  const utils = render(
    <QueryClientProvider client={client}>
      <Harness onSelect={onSelect} />
    </QueryClientProvider>,
  );
  return { ...utils, onSelect };
}

beforeEach(async () => {
  await db.instruments.clear();

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/search?q=BHP')) {
        return {
          ok: true,
          json: async () => [{ id: 'ASX:BHP', name: 'BHP Group Limited', exchange: 'ASX', currency: 'AUD' }],
        } as Response;
      }
      if (url.includes('/search?q=DBS')) {
        return {
          ok: true,
          json: async () => [{ id: 'SGX:D05', name: 'DBS Group Holdings Ltd', exchange: 'SGX', currency: 'SGD' }],
        } as Response;
      }
      return { ok: true, json: async () => [] } as Response;
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe('SymbolSearch', () => {
  test('typing "BHP" offers BHP labelled ASX/AUD as a listbox option', async () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText('Instrument'), { target: { value: 'BHP' } });

    const option = await screen.findByRole('option', { name: /BHP Group Limited.*ASX.*AUD/i }, { timeout: 1000 });
    expect(option).toBeInTheDocument();
  });

  test('typing "DBS" offers D05 labelled SGX/SGD as a listbox option', async () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText('Instrument'), { target: { value: 'DBS' } });

    const option = await screen.findByRole('option', { name: /DBS Group Holdings Ltd.*SGX.*SGD/i }, { timeout: 1000 });
    expect(option).toBeInTheDocument();
  });

  test('is a keyboard-navigable, ARIA-compliant combobox', async () => {
    renderSearch();
    const input = screen.getByLabelText('Instrument');

    fireEvent.change(input, { target: { value: 'BHP' } });
    await screen.findByRole('option', { name: /BHP/i }, { timeout: 1000 });

    expect(input).toHaveAttribute('role', 'combobox');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const option = screen.getByRole('option', { name: /BHP/i });
    expect(input).toHaveAttribute('aria-activedescendant', option.id);
    expect(option).toHaveAttribute('aria-selected', 'true');
  });

  test('selecting a result via Enter upserts the instrument into Dexie and notifies the parent', async () => {
    const { onSelect } = renderSearch();
    const input = screen.getByLabelText('Instrument') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'BHP' } });
    await screen.findByRole('option', { name: /BHP/i }, { timeout: 1000 });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    const expected: Instrument = { id: 'ASX:BHP', name: 'BHP Group Limited', exchange: 'ASX', currency: 'AUD' };
    expect(input.value).toBe('ASX:BHP');
    expect(onSelect).toHaveBeenCalledWith(expected);

    await waitFor(async () => {
      expect(await db.instruments.get('ASX:BHP')).toEqual(expected);
    });
  });

  test('Escape closes the listbox without selecting', async () => {
    renderSearch();
    const input = screen.getByLabelText('Instrument');

    fireEvent.change(input, { target: { value: 'BHP' } });
    await screen.findByRole('option', { name: /BHP/i }, { timeout: 1000 });

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

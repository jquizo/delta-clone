import { useEffect, useState, type FormEvent } from 'react';
import { addTransaction, updateTransaction, type TransactionFormInput } from '../../app/transactionActions';
import { upsertInstrument } from '../../app/instrumentActions';
import { useToastStore } from '../../app/toastStore';
import { SymbolSearch } from './SymbolSearch';
import type { Exchange, Instrument, Portfolio, Transaction } from '../../domain/types';

const EXCHANGES: Exchange[] = ['ASX', 'NASDAQ', 'NYSE', 'ARCA', 'LSE', 'SGX', 'OTC'];

const LABEL_CLASS = 'mb-1 block text-xs font-medium uppercase tracking-wide text-muted';
const INPUT_CLASS =
  'w-full rounded-md border border-hairline bg-white px-2.5 py-1.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30';

interface TransactionFormProps {
  portfolio: Portfolio;
  instruments: Instrument[];
  editing?: Transaction | null;
  onSaved: () => void;
  onCancelEdit?: () => void;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionForm({ portfolio, instruments, editing, onSaved, onCancelEdit }: TransactionFormProps) {
  const [instrumentId, setInstrumentId] = useState(editing?.instrumentId ?? '');
  const [exchange, setExchange] = useState<Exchange>('ASX');
  const [instrumentName, setInstrumentName] = useState('');
  const [type, setType] = useState<Transaction['type']>(editing?.type ?? 'BUY');
  const [quantity, setQuantity] = useState(editing ? String(editing.quantity) : '');
  const [price, setPrice] = useState(editing ? String(editing.price) : '');
  const [fees, setFees] = useState(editing ? String(editing.fees) : '0');
  const [currency, setCurrency] = useState(editing?.currency ?? portfolio.baseCurrency);
  const [tradeDate, setTradeDate] = useState(editing?.tradeDate ?? todayIsoDate());
  const [note, setNote] = useState(editing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const addToast = useToastStore((s) => s.addToast);

  const knownInstrument = instruments.find((i) => i.id === instrumentId);

  // TransactionsPage remounts this form (via `key`) whenever the edit target changes,
  // so this effect runs exactly once per "start editing" — moving focus to the field
  // the user needs, since the form they clicked "Edit" on lives above the list.
  useEffect(() => {
    if (editing) {
      document.getElementById('instrumentId')?.focus();
    }
  }, [editing]);

  function resetForm() {
    setInstrumentId('');
    setInstrumentName('');
    setQuantity('');
    setPrice('');
    setFees('0');
    setNote('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      const trimmedId = instrumentId.trim();
      if (!trimmedId) {
        throw new Error('Instrument is required');
      }

      if (!knownInstrument) {
        if (!instrumentName.trim()) {
          throw new Error('Name is required for a new instrument');
        }
        await upsertInstrument({ id: trimmedId, exchange, currency, name: instrumentName.trim() });
      }

      const input: TransactionFormInput = {
        instrumentId: trimmedId,
        type,
        quantity: type === 'DIVIDEND' ? 0 : Number(quantity),
        price: Number(price),
        fees: Number(fees || 0),
        currency,
        tradeDate,
        note: note.trim() || undefined,
      };

      if (editing) {
        await updateTransaction(editing.id, input, portfolio);
      } else {
        await addTransaction(input, portfolio);
      }

      resetForm();
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save transaction';
      setError(message);
      addToast(message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 space-y-3 rounded-xl border border-hairline bg-white p-4 shadow-sm">
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}

      <div>
        <label htmlFor="instrumentId" className={LABEL_CLASS}>
          Instrument
        </label>
        <SymbolSearch
          id="instrumentId"
          value={instrumentId}
          onChange={setInstrumentId}
          onSelect={(instrument) => setCurrency(instrument.currency)}
        />
      </div>

      {!knownInstrument && instrumentId.trim() && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="exchange" className={LABEL_CLASS}>
              Exchange
            </label>
            <select id="exchange" value={exchange} onChange={(e) => setExchange(e.target.value as Exchange)} className={INPUT_CLASS}>
              {EXCHANGES.map((ex) => (
                <option key={ex} value={ex}>
                  {ex}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="instrumentName" className={LABEL_CLASS}>
              Name
            </label>
            <input
              id="instrumentName"
              value={instrumentName}
              onChange={(e) => setInstrumentName(e.target.value)}
              placeholder="BHP Group Ltd"
              className={INPUT_CLASS}
            />
          </div>
        </div>
      )}

      <div>
        <label htmlFor="type" className={LABEL_CLASS}>
          Type
        </label>
        <select id="type" value={type} onChange={(e) => setType(e.target.value as Transaction['type'])} className={INPUT_CLASS}>
          <option value="BUY">Buy</option>
          <option value="SELL">Sell</option>
          <option value="DIVIDEND">Dividend</option>
        </select>
      </div>

      {type !== 'DIVIDEND' && (
        <div>
          <label htmlFor="quantity" className={LABEL_CLASS}>
            Quantity
          </label>
          <input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={INPUT_CLASS} />
        </div>
      )}

      <div>
        <label htmlFor="price" className={LABEL_CLASS}>
          {type === 'DIVIDEND' ? 'Cash amount' : 'Price per share'}
        </label>
        <input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={INPUT_CLASS} />
      </div>

      <div>
        <label htmlFor="fees" className={LABEL_CLASS}>
          Fees
        </label>
        <input id="fees" type="number" value={fees} onChange={(e) => setFees(e.target.value)} className={INPUT_CLASS} />
      </div>

      <div>
        <label htmlFor="currency" className={LABEL_CLASS}>
          Currency
        </label>
        <input id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={INPUT_CLASS} />
      </div>

      <div>
        <label htmlFor="tradeDate" className={LABEL_CLASS}>
          Trade date
        </label>
        <input
          id="tradeDate"
          type="date"
          value={tradeDate}
          onChange={(e) => setTradeDate(e.target.value)}
          max={todayIsoDate()}
          className={INPUT_CLASS}
        />
      </div>

      <div>
        <label htmlFor="note" className={LABEL_CLASS}>
          Note
        </label>
        <input id="note" value={note} onChange={(e) => setNote(e.target.value)} className={INPUT_CLASS} />
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90">
          {editing ? 'Save changes' : 'Add transaction'}
        </button>
        {editing && onCancelEdit && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-md border border-hairline bg-paper px-3 py-2 text-sm text-ink hover:bg-hairline"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

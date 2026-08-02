import { removeTransaction } from '../../app/transactionActions';
import { useToastStore } from '../../app/toastStore';
import { formatMoney } from '../../domain/money';
import type { Instrument, Transaction } from '../../domain/types';

interface TransactionListProps {
  transactions: Transaction[];
  instruments: Instrument[];
  onEdit: (transaction: Transaction) => void;
}

export function TransactionList({ transactions, instruments, onEdit }: TransactionListProps) {
  const addToast = useToastStore((s) => s.addToast);
  const nameFor = (instrumentId: string) => instruments.find((i) => i.id === instrumentId)?.name ?? instrumentId;
  const sorted = [...transactions].sort((a, b) => b.tradeDate.localeCompare(a.tradeDate));

  async function handleDelete(id: string) {
    try {
      await removeTransaction(id);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to delete transaction');
    }
  }

  if (sorted.length === 0) {
    return <p className="text-sm text-muted">No transactions yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-white shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-hairline bg-paper text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-2.5 font-medium">Date</th>
            <th className="px-4 py-2.5 font-medium">Instrument</th>
            <th className="px-4 py-2.5 font-medium">Type</th>
            <th className="px-4 py-2.5 text-right font-medium">Quantity</th>
            <th className="px-4 py-2.5 text-right font-medium">Price</th>
            <th className="px-4 py-2.5 text-right font-medium">Fees</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr key={t.id} className="border-b border-hairline last:border-b-0">
              <td className="px-4 py-2.5 text-muted">{t.tradeDate}</td>
              <td className="px-4 py-2.5 font-medium text-ink">{nameFor(t.instrumentId)}</td>
              <td className="px-4 py-2.5 text-ink">{t.type}</td>
              <td className="px-4 py-2.5 text-right text-ink">{t.quantity}</td>
              <td className="px-4 py-2.5 text-right text-ink">{formatMoney(t.price, t.currency)}</td>
              <td className="px-4 py-2.5 text-right text-ink">{formatMoney(t.fees, t.currency)}</td>
              <td className="px-4 py-2.5 text-right text-xs">
                <button type="button" onClick={() => onEdit(t)} className="text-accent hover:underline">
                  Edit
                </button>{' '}
                <button type="button" onClick={() => handleDelete(t.id)} className="text-negative hover:underline">
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

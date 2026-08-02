import { useState } from 'react';
import { useInstruments, useTransactions } from '../../app/selectors';
import { TransactionForm } from '../components/TransactionForm';
import { TransactionList } from '../components/TransactionList';
import { CsvImportExport } from '../components/CsvImportExport';
import type { Portfolio, Transaction } from '../../domain/types';

interface TransactionsPageProps {
  portfolio: Portfolio;
}

export function TransactionsPage({ portfolio }: TransactionsPageProps) {
  const instruments = useInstruments() ?? [];
  const transactions = useTransactions(portfolio.id) ?? [];
  const [editing, setEditing] = useState<Transaction | null>(null);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-xl font-semibold text-ink">Transactions</h1>
      <CsvImportExport portfolio={portfolio} onImported={() => {}} />
      <TransactionForm
        key={editing?.id ?? 'new'}
        portfolio={portfolio}
        instruments={instruments}
        editing={editing}
        onSaved={() => setEditing(null)}
        onCancelEdit={() => setEditing(null)}
      />
      <TransactionList transactions={transactions} instruments={instruments} onEdit={setEditing} />
    </main>
  );
}

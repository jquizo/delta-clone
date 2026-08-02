import { getCachedFxRate } from '../data/fxCache';
import { transactionRepo } from '../data/repositories';
import { resolveFxRateToBase } from '../domain/money';
import type { Portfolio, Transaction } from '../domain/types';

export interface TransactionFormInput {
  instrumentId: string;
  type: Transaction['type'];
  quantity: number;
  price: number;
  fees: number;
  currency: string;
  tradeDate: string;
  note?: string;
}

function withFxRate(input: TransactionFormInput, portfolio: Portfolio) {
  const cachedRate = getCachedFxRate(input.currency, portfolio.baseCurrency);
  const { fxRateToBase, fxRateFlagged } = resolveFxRateToBase(input.currency, portfolio.baseCurrency, cachedRate);
  return { ...input, portfolioId: portfolio.id, fxRateToBase, fxRateFlagged };
}

export async function addTransaction(input: TransactionFormInput, portfolio: Portfolio): Promise<Transaction> {
  return transactionRepo.add(withFxRate(input, portfolio));
}

export async function updateTransaction(
  id: string,
  input: TransactionFormInput,
  portfolio: Portfolio,
): Promise<Transaction> {
  return transactionRepo.update({ id, ...withFxRate(input, portfolio) });
}

export async function removeTransaction(id: string): Promise<void> {
  return transactionRepo.remove(id);
}

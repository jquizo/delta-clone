import { portfolioRepo, wipeAllData } from '../data/repositories';
import type { Currency, Portfolio } from '../domain/types';

export async function ensureDefaultPortfolio(): Promise<Portfolio> {
  return portfolioRepo.ensureDefault();
}

export async function updateBaseCurrency(portfolio: Portfolio, baseCurrency: Currency): Promise<Portfolio> {
  return portfolioRepo.update({ ...portfolio, baseCurrency });
}

/** Danger zone: erases all local data, then seeds a fresh default portfolio. */
export async function wipeAndResetPortfolio(): Promise<Portfolio> {
  await wipeAllData();
  return portfolioRepo.ensureDefault();
}

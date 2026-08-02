import { z } from 'zod';
import type { FxRate } from '../domain/types';

export interface FxProvider {
  getFxRates(pairs: string[]): Promise<FxRate[]>;
}

const YahooFxRateSchema = z.object({ pair: z.string(), rate: z.number(), asOf: z.number() });
const YahooFxRatesSchema = z.array(YahooFxRateSchema);

export function createYahooFxProvider(options: { workerUrl: string; fetchImpl?: typeof fetch }): FxProvider {
  const doFetch = (...args: Parameters<typeof fetch>) => (options.fetchImpl ?? fetch)(...args);

  return {
    async getFxRates(pairs: string[]): Promise<FxRate[]> {
      if (pairs.length === 0) return [];

      const res = await doFetch(`${options.workerUrl}/fx?pairs=${encodeURIComponent(pairs.join(','))}`);
      if (!res.ok) {
        throw new Error(`Worker /fx request failed: ${res.status}`);
      }

      const json = await res.json();
      const raws = YahooFxRatesSchema.parse(json);
      return raws.map((r) => ({ ...r, source: 'yahoo' as const }));
    },
  };
}

const FRANKFURTER_URL = 'https://api.frankfurter.dev/v1/latest';

const FrankfurterResponseSchema = z.object({
  amount: z.number(),
  base: z.string(),
  date: z.string(),
  rates: z.record(z.string(), z.number()),
});

interface ParsedPair {
  pair: string;
  from: string;
  to: string;
}

export function createFrankfurterProvider(options: { fetchImpl?: typeof fetch } = {}): FxProvider {
  const doFetch = (...args: Parameters<typeof fetch>) => (options.fetchImpl ?? fetch)(...args);

  return {
    async getFxRates(pairs: string[]): Promise<FxRate[]> {
      if (pairs.length === 0) return [];

      const parsed: ParsedPair[] = pairs.map((pair) => ({ pair, from: pair.slice(0, 3), to: pair.slice(3) }));

      const groupsByTo = new Map<string, ParsedPair[]>();
      for (const p of parsed) {
        const group = groupsByTo.get(p.to) ?? [];
        group.push(p);
        groupsByTo.set(p.to, group);
      }

      const results: FxRate[] = [];

      for (const [to, group] of groupsByTo) {
        const froms = group.map((p) => p.from).join(',');
        const res = await doFetch(`${FRANKFURTER_URL}?from=${to}&to=${froms}`);
        if (!res.ok) {
          throw new Error(`Frankfurter request failed: ${res.status}`);
        }

        const json = await res.json();
        const validated = FrankfurterResponseSchema.parse(json);
        const asOf = Date.parse(`${validated.date}T00:00:00Z`);

        for (const p of group) {
          const toFromRate = validated.rates[p.from];
          if (toFromRate === undefined) continue;
          results.push({ pair: p.pair, rate: 1 / toFromRate, asOf, source: 'frankfurter' });
        }
      }

      return results;
    },
  };
}

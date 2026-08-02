import { isMarketOpen } from '../domain/marketHours';
import type { Exchange } from '../domain/types';

const SIXTY_SECONDS_MS = 60_000;

function exchangeOf(instrumentId: string): Exchange {
  return instrumentId.split(':')[0] as Exchange;
}

/**
 * No reason to poll BHP.AX at midnight Sydney time — only auto-refetch
 * quotes while at least one held instrument's market is actually open.
 */
export function computeQuotesRefetchInterval(instrumentIds: string[], now: Date = new Date()): number | false {
  const anyOpen = instrumentIds.some((id) => isMarketOpen(exchangeOf(id), now));
  return anyOpen ? SIXTY_SECONDS_MS : false;
}

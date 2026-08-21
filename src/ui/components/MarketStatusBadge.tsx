import { isMarketOpen } from '../../domain/marketHours';
import type { Exchange } from '../../domain/types';

interface MarketStatusBadgeProps {
  exchange: Exchange;
  now?: Date;
}

export function MarketStatusBadge({ exchange, now = new Date() }: MarketStatusBadgeProps) {
  const open = isMarketOpen(exchange, now);

  return (
    <span
      aria-label={`${exchange} market ${open ? 'open' : 'closed'}`}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
        open ? 'bg-positive-soft text-positive' : 'bg-hairline text-muted'
      }`}
    >
      {exchange}
    </span>
  );
}

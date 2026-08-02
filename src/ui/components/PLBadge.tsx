import { formatMoney } from '../../domain/money';
import type { Currency } from '../../domain/types';

interface PLBadgeProps {
  value: number;
  currency: Currency;
}

export function PLBadge({ value, currency }: PLBadgeProps) {
  const toneClass = value > 0 ? 'bg-positive-soft text-positive' : value < 0 ? 'bg-negative-soft text-negative' : 'bg-hairline text-muted';
  const sign = value > 0 ? '+' : '';

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
      {sign}
      {formatMoney(value, currency)}
    </span>
  );
}

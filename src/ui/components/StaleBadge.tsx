import { formatRelativeTime } from '../formatRelativeTime';

interface StaleBadgeProps {
  asOf: number;
}

export function StaleBadge({ asOf }: StaleBadgeProps) {
  return (
    <span role="status" className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
      <span aria-hidden="true">⚠️</span>
      stale · as of {formatRelativeTime(asOf)}
    </span>
  );
}

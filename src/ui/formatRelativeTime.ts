export function formatRelativeTime(asOf: number, now: number = Date.now()): string {
  const diffMin = Math.floor((now - asOf) / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;

  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} d ago`;
}

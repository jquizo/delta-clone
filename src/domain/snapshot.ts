export interface ShouldWriteDailySnapshotParams {
  hasSnapshotForToday: boolean;
  /** true only when quotes are live (not hydrated-from-cache) and every holding priced successfully. */
  quotesAreFresh: boolean;
}

/** Write at most one snapshot per day, and only from a complete, live valuation. */
export function shouldWriteDailySnapshot({ hasSnapshotForToday, quotesAreFresh }: ShouldWriteDailySnapshotParams): boolean {
  return !hasSnapshotForToday && quotesAreFresh;
}

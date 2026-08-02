export interface HistoryPoint {
  date: string;
  close: number;
}

/** Extracts a daily {date, close} series from a Yahoo v8 chart response. */
export function parseHistoryResponse(json: unknown): HistoryPoint[] {
  if (!json || typeof json !== 'object') return [];

  const result = (json as { chart?: { result?: unknown } }).chart?.result;
  if (!Array.isArray(result) || result.length === 0) return [];

  const entry = result[0] as Record<string, unknown>;
  const timestamps = entry.timestamp;
  const closes = (entry.indicators as { quote?: Array<{ close?: unknown }> } | undefined)?.quote?.[0]?.close;

  if (!Array.isArray(timestamps) || !Array.isArray(closes)) return [];

  const points: HistoryPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (typeof close !== 'number') continue;

    const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
    points.push({ date, close });
  }

  return points;
}

import { normaliseYahooFxMeta, type NormalisedFxRate } from './fx';
import { parseHistoryResponse } from './history';
import { normaliseYahooMeta, parseSymbolsParam, type NormalisedQuote } from './quote';
import { toInstrumentSearchResults } from './search';

const VALID_HISTORY_RANGES = new Set(['1mo', '6mo', '1y', '5y']);

const YAHOO_CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YAHOO_SEARCH_URL = 'https://query1.finance.yahoo.com/v1/finance/search';
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function fetchQuote(symbol: string): Promise<NormalisedQuote | null> {
  const url = `${YAHOO_CHART_BASE}/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  const res = await fetch(url, { headers: { 'User-Agent': BROWSER_USER_AGENT } });
  if (!res.ok) return null;

  const json = (await res.json()) as { chart?: { result?: Array<{ meta?: unknown }> } };
  const meta = json.chart?.result?.[0]?.meta;
  return normaliseYahooMeta(symbol, meta);
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...init.headers },
  });
}

async function handleQuote(request: Request, url: URL): Promise<Response> {
  const symbols = parseSymbolsParam(url.searchParams.get('symbols'));
  if (symbols.length === 0) {
    return jsonResponse({ error: 'symbols query param is required' }, { status: 400 });
  }

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const results = await Promise.all(symbols.map(fetchQuote));
  const quotes = results.filter((q): q is NormalisedQuote => q !== null);

  const response = jsonResponse(quotes, { headers: { 'Cache-Control': 'public, max-age=300' } });
  await cache.put(cacheKey, response.clone());
  return response;
}

async function fetchFxRate(pair: string): Promise<NormalisedFxRate | null> {
  const symbol = `${pair}=X`;
  const url = `${YAHOO_CHART_BASE}/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  const res = await fetch(url, { headers: { 'User-Agent': BROWSER_USER_AGENT } });
  if (!res.ok) return null;

  const json = (await res.json()) as { chart?: { result?: Array<{ meta?: unknown }> } };
  const meta = json.chart?.result?.[0]?.meta;
  return normaliseYahooFxMeta(pair, meta);
}

async function handleFx(request: Request, url: URL): Promise<Response> {
  const pairs = parseSymbolsParam(url.searchParams.get('pairs'));
  if (pairs.length === 0) {
    return jsonResponse({ error: 'pairs query param is required' }, { status: 400 });
  }

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const results = await Promise.all(pairs.map(fetchFxRate));
  const rates = results.filter((r): r is NormalisedFxRate => r !== null);

  const response = jsonResponse(rates, { headers: { 'Cache-Control': 'public, max-age=300' } });
  await cache.put(cacheKey, response.clone());
  return response;
}

async function handleSearch(request: Request, url: URL): Promise<Response> {
  const q = url.searchParams.get('q')?.trim() ?? '';
  if (!q) {
    return jsonResponse({ error: 'q query param is required' }, { status: 400 });
  }

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const yahooUrl = `${YAHOO_SEARCH_URL}?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`;
  const res = await fetch(yahooUrl, { headers: { 'User-Agent': BROWSER_USER_AGENT } });
  const results = res.ok ? toInstrumentSearchResults(await res.json()) : [];

  const response = jsonResponse(results, { headers: { 'Cache-Control': 'public, max-age=300' } });
  await cache.put(cacheKey, response.clone());
  return response;
}

async function handleHistory(request: Request, url: URL): Promise<Response> {
  const symbol = url.searchParams.get('symbol')?.trim() ?? '';
  const range = url.searchParams.get('range') ?? '';
  if (!symbol) {
    return jsonResponse({ error: 'symbol query param is required' }, { status: 400 });
  }
  if (!VALID_HISTORY_RANGES.has(range)) {
    return jsonResponse({ error: `range must be one of ${[...VALID_HISTORY_RANGES].join(', ')}` }, { status: 400 });
  }

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const yahooUrl = `${YAHOO_CHART_BASE}/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
  const res = await fetch(yahooUrl, { headers: { 'User-Agent': BROWSER_USER_AGENT } });
  const points = res.ok ? parseHistoryResponse(await res.json()) : [];

  const response = jsonResponse(points, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  await cache.put(cacheKey, response.clone());
  return response;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    if (url.pathname === '/quote') {
      return handleQuote(request, url);
    }
    if (url.pathname === '/search') {
      return handleSearch(request, url);
    }
    if (url.pathname === '/fx') {
      return handleFx(request, url);
    }
    if (url.pathname === '/history') {
      return handleHistory(request, url);
    }

    return jsonResponse({ error: 'not found' }, { status: 404 });
  },
};

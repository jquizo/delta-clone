import { describe, expect, test } from 'vitest';
import { createYahooProvider, normaliseRawQuote, parseWorkerQuotes, toYahooSymbol } from '../yahooProvider';
import type { RawWorkerQuote } from '../yahooProvider';

describe('toYahooSymbol', () => {
  test('maps ASX ids to the .AX suffix', () => {
    expect(toYahooSymbol('ASX:BHP')).toBe('BHP.AX');
  });

  test('maps SGX ids to the .SI suffix', () => {
    expect(toYahooSymbol('SGX:D05')).toBe('D05.SI');
  });

  test('maps LSE ids to the .L suffix', () => {
    expect(toYahooSymbol('LSE:VOD')).toBe('VOD.L');
  });

  test('maps NASDAQ ids with no suffix', () => {
    expect(toYahooSymbol('NASDAQ:AAPL')).toBe('AAPL');
  });

  test('maps NYSE ids with no suffix', () => {
    expect(toYahooSymbol('NYSE:JPM')).toBe('JPM');
  });

  test('maps ARCA (NYSE Arca) ids with no suffix', () => {
    expect(toYahooSymbol('ARCA:JEPI')).toBe('JEPI');
  });

  test('maps OTC ids with no suffix', () => {
    expect(toYahooSymbol('OTC:BHPLF')).toBe('BHPLF');
  });

  test('maps SBF (Euronext Paris) ids to the .PA suffix', () => {
    expect(toYahooSymbol('SBF:VK')).toBe('VK.PA');
  });

  test('maps OSE (Oslo Børs) ids to the .OL suffix', () => {
    expect(toYahooSymbol('OSE:PGS')).toBe('PGS.OL');
  });

  test('throws for an unrecognised exchange prefix', () => {
    expect(() => toYahooSymbol('TSX:SHOP')).toThrow(/Unknown exchange/);
  });
});

describe('normaliseRawQuote', () => {
  const base: RawWorkerQuote = {
    symbol: 'BHP.AX',
    price: 45.12,
    currency: 'AUD',
    previousClose: 44.8,
    marketState: 'OPEN',
    asOf: 1700000000000,
  };

  test('passes non-GBp quotes through unchanged, keyed to the instrument id', () => {
    expect(normaliseRawQuote(base, 'ASX:BHP')).toEqual({
      instrumentId: 'ASX:BHP',
      price: 45.12,
      currency: 'AUD',
      previousClose: 44.8,
      marketState: 'OPEN',
      asOf: 1700000000000,
    });
  });

  test('normalises GBp (pence) quotes to GBP (pounds) by dividing by 100', () => {
    const raw: RawWorkerQuote = { ...base, symbol: 'VOD.L', currency: 'GBp', price: 12345, previousClose: 12000 };
    expect(normaliseRawQuote(raw, 'LSE:VOD')).toEqual({
      instrumentId: 'LSE:VOD',
      price: 123.45,
      currency: 'GBP',
      previousClose: 120,
      marketState: 'OPEN',
      asOf: 1700000000000,
    });
  });
});

describe('parseWorkerQuotes', () => {
  test('validates and maps a well-formed worker response back to instrument ids', () => {
    const json = [
      { symbol: 'BHP.AX', price: 45.12, currency: 'AUD', previousClose: 44.8, marketState: 'OPEN', asOf: 1 },
      { symbol: 'AAPL', price: 190, currency: 'USD', previousClose: 188, marketState: 'CLOSED', asOf: 2 },
    ];

    const quotes = parseWorkerQuotes(json, ['ASX:BHP', 'NASDAQ:AAPL']);

    expect(quotes).toEqual([
      { instrumentId: 'ASX:BHP', price: 45.12, currency: 'AUD', previousClose: 44.8, marketState: 'OPEN', asOf: 1 },
      { instrumentId: 'NASDAQ:AAPL', price: 190, currency: 'USD', previousClose: 188, marketState: 'CLOSED', asOf: 2 },
    ]);
  });

  test('omits instruments the worker had no quote for, rather than failing the whole batch', () => {
    const json = [{ symbol: 'BHP.AX', price: 45.12, currency: 'AUD', previousClose: 44.8, marketState: 'OPEN', asOf: 1 }];

    const quotes = parseWorkerQuotes(json, ['ASX:BHP', 'NASDAQ:AAPL']);

    expect(quotes).toEqual([
      { instrumentId: 'ASX:BHP', price: 45.12, currency: 'AUD', previousClose: 44.8, marketState: 'OPEN', asOf: 1 },
    ]);
  });

  test('throws when the response does not match the expected shape', () => {
    const json = [{ symbol: 'BHP.AX', price: 'not-a-number' }];
    expect(() => parseWorkerQuotes(json, ['ASX:BHP'])).toThrow();
  });
});

describe('createYahooProvider', () => {
  test('getQuotes fetches the worker with joined yahoo symbols and returns normalised quotes', async () => {
    const requestedUrls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      requestedUrls.push(String(input));
      return {
        ok: true,
        json: async () => [
          { symbol: 'BHP.AX', price: 45.12, currency: 'AUD', previousClose: 44.8, marketState: 'OPEN', asOf: 1 },
        ],
      } as Response;
    };

    const provider = createYahooProvider({ workerUrl: 'https://worker.example', fetchImpl });
    const quotes = await provider.getQuotes(['ASX:BHP']);

    expect(requestedUrls).toEqual(['https://worker.example/quote?symbols=BHP.AX']);
    expect(quotes).toEqual([
      { instrumentId: 'ASX:BHP', price: 45.12, currency: 'AUD', previousClose: 44.8, marketState: 'OPEN', asOf: 1 },
    ]);
  });

  test('getQuotes returns an empty array without fetching when given no ids', async () => {
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return { ok: true, json: async () => [] } as Response;
    };

    const provider = createYahooProvider({ workerUrl: 'https://worker.example', fetchImpl });
    expect(await provider.getQuotes([])).toEqual([]);
    expect(called).toBe(false);
  });

  test('getQuotes throws when the worker responds with a non-OK status', async () => {
    const fetchImpl = async () => ({ ok: false, status: 502, json: async () => ({}) }) as Response;
    const provider = createYahooProvider({ workerUrl: 'https://worker.example', fetchImpl });
    await expect(provider.getQuotes(['ASX:BHP'])).rejects.toThrow(/502/);
  });

  test('searchInstruments fetches the worker /search endpoint and returns validated instruments', async () => {
    const requestedUrls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      requestedUrls.push(String(input));
      return {
        ok: true,
        json: async () => [{ id: 'ASX:BHP', name: 'BHP Group Limited', exchange: 'ASX', currency: 'AUD' }],
      } as Response;
    };

    const provider = createYahooProvider({ workerUrl: 'https://worker.example', fetchImpl });
    const results = await provider.searchInstruments('BHP');

    expect(requestedUrls).toEqual(['https://worker.example/search?q=BHP']);
    expect(results).toEqual([{ id: 'ASX:BHP', name: 'BHP Group Limited', exchange: 'ASX', currency: 'AUD' }]);
  });

  test('searchInstruments returns an empty array without fetching for a blank query', async () => {
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return { ok: true, json: async () => [] } as Response;
    };

    const provider = createYahooProvider({ workerUrl: 'https://worker.example', fetchImpl });
    expect(await provider.searchInstruments('   ')).toEqual([]);
    expect(called).toBe(false);
  });

  test('searchInstruments throws when the worker responds with a non-OK status', async () => {
    const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) }) as Response;
    const provider = createYahooProvider({ workerUrl: 'https://worker.example', fetchImpl });
    await expect(provider.searchInstruments('BHP')).rejects.toThrow(/500/);
  });

  test.each([
    ['1M', '1mo'],
    ['6M', '6mo'],
    ['1Y', '1y'],
    ['5Y', '5y'],
  ] as const)('getHistory maps range %s to the worker range param %s', async (range, workerRange) => {
    const requestedUrls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      requestedUrls.push(String(input));
      return { ok: true, json: async () => [{ date: '2026-01-01', close: 45.12 }] } as Response;
    };

    const provider = createYahooProvider({ workerUrl: 'https://worker.example', fetchImpl });
    const points = await provider.getHistory('ASX:BHP', range);

    expect(requestedUrls).toEqual([`https://worker.example/history?symbol=BHP.AX&range=${workerRange}`]);
    expect(points).toEqual([{ date: '2026-01-01', close: 45.12 }]);
  });

  test('getHistory throws when the worker responds with a non-OK status', async () => {
    const fetchImpl = async () => ({ ok: false, status: 502, json: async () => ({}) }) as Response;
    const provider = createYahooProvider({ workerUrl: 'https://worker.example', fetchImpl });
    await expect(provider.getHistory('ASX:BHP', '1Y')).rejects.toThrow(/502/);
  });
});

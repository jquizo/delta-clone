import { describe, expect, test } from 'vitest';
import { toInstrumentSearchResults } from './search';

describe('toInstrumentSearchResults', () => {
  test('maps an ASX equity quote to a provider-neutral instrument, stripping the .AX suffix', () => {
    const json = {
      quotes: [
        {
          exchange: 'ASX',
          symbol: 'BHP.AX',
          shortname: 'BHP GROUP FPO [BHP]',
          longname: 'BHP Group Limited',
          quoteType: 'EQUITY',
        },
      ],
    };

    expect(toInstrumentSearchResults(json)).toEqual([
      { id: 'ASX:BHP', name: 'BHP Group Limited', exchange: 'ASX', currency: 'AUD' },
    ]);
  });

  test('maps an SGX equity quote to a provider-neutral instrument, stripping the .SI suffix', () => {
    const json = {
      quotes: [
        { exchange: 'SES', symbol: 'D05.SI', shortname: 'DBS', longname: 'DBS Group Holdings Ltd', quoteType: 'EQUITY' },
      ],
    };

    expect(toInstrumentSearchResults(json)).toEqual([
      { id: 'SGX:D05', name: 'DBS Group Holdings Ltd', exchange: 'SGX', currency: 'SGD' },
    ]);
  });

  test('maps a NASDAQ equity quote with no suffix to strip', () => {
    const json = {
      quotes: [{ exchange: 'NMS', symbol: 'AAPL', shortname: 'Apple Inc.', longname: 'Apple Inc.', quoteType: 'EQUITY' }],
    };

    expect(toInstrumentSearchResults(json)).toEqual([
      { id: 'NASDAQ:AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', currency: 'USD' },
    ]);
  });

  test('maps an LSE equity quote, stripping the .L suffix', () => {
    const json = {
      quotes: [{ exchange: 'LSE', symbol: 'BHP.L', longname: 'BHP Group Limited', quoteType: 'EQUITY' }],
    };

    expect(toInstrumentSearchResults(json)).toEqual([
      { id: 'LSE:BHP', name: 'BHP Group Limited', exchange: 'LSE', currency: 'GBP' },
    ]);
  });

  test('falls back to shortname when longname is absent', () => {
    const json = { quotes: [{ exchange: 'ASX', symbol: 'BHP.AX', shortname: 'BHP GROUP FPO [BHP]', quoteType: 'EQUITY' }] };
    expect(toInstrumentSearchResults(json)[0].name).toBe('BHP GROUP FPO [BHP]');
  });

  test('includes ETFs alongside equities', () => {
    const json = { quotes: [{ exchange: 'ASX', symbol: 'VAS.AX', longname: 'Vanguard Australian Shares ETF', quoteType: 'ETF' }] };
    expect(toInstrumentSearchResults(json)).toEqual([
      { id: 'ASX:VAS', name: 'Vanguard Australian Shares ETF', exchange: 'ASX', currency: 'AUD' },
    ]);
  });

  test('excludes non-equity, non-ETF quote types', () => {
    const json = { quotes: [{ exchange: 'PNK', symbol: '0P0001MZ90', longname: 'DBS I.D.E.A. USD Acc', quoteType: 'MUTUALFUND' }] };
    expect(toInstrumentSearchResults(json)).toEqual([]);
  });

  test('maps an NYSE equity quote via the NYQ exchange code, with no suffix to strip', () => {
    const json = {
      quotes: [{ exchange: 'NYQ', symbol: 'JPM', longname: 'JPMorgan Chase & Co.', quoteType: 'EQUITY' }],
    };
    expect(toInstrumentSearchResults(json)).toEqual([
      { id: 'NYSE:JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE', currency: 'USD' },
    ]);
  });

  test('maps an ARCA (NYSE Arca) ETF quote via the PCX exchange code, with no suffix to strip', () => {
    const json = {
      quotes: [{ exchange: 'PCX', symbol: 'JEPI', longname: 'JPMorgan Equity Premium Income ETF', quoteType: 'ETF' }],
    };
    expect(toInstrumentSearchResults(json)).toEqual([
      { id: 'ARCA:JEPI', name: 'JPMorgan Equity Premium Income ETF', exchange: 'ARCA', currency: 'USD' },
    ]);
  });

  test('maps an OTC equity quote via the PNK exchange code, with no suffix to strip', () => {
    const json = {
      quotes: [{ exchange: 'PNK', symbol: 'BHPLF', longname: 'BHP Group Limited', quoteType: 'EQUITY' }],
    };
    expect(toInstrumentSearchResults(json)).toEqual([
      { id: 'OTC:BHPLF', name: 'BHP Group Limited', exchange: 'OTC', currency: 'USD' },
    ]);
  });

  test('maps a Euronext Paris equity quote via the PAR exchange code, stripping the .PA suffix', () => {
    const json = {
      quotes: [{ exchange: 'PAR', symbol: 'VK.PA', longname: 'Vallourec S.A.', quoteType: 'EQUITY' }],
    };
    expect(toInstrumentSearchResults(json)).toEqual([
      { id: 'SBF:VK', name: 'Vallourec S.A.', exchange: 'SBF', currency: 'EUR' },
    ]);
  });

  test('maps an Oslo Børs equity quote via the OSL exchange code, stripping the .OL suffix', () => {
    const json = {
      quotes: [{ exchange: 'OSL', symbol: 'PGS.OL', longname: 'PGS ASA', quoteType: 'EQUITY' }],
    };
    expect(toInstrumentSearchResults(json)).toEqual([
      { id: 'OSE:PGS', name: 'PGS ASA', exchange: 'OSE', currency: 'NOK' },
    ]);
  });

  test('excludes quotes on exchanges outside ASX/NASDAQ/NYSE/ARCA/LSE/SGX/OTC/SBF/OSE', () => {
    const json = {
      quotes: [{ exchange: 'STU', symbol: 'BHP.SG', longname: 'BHP Group (ADRs)', quoteType: 'EQUITY' }],
    };
    expect(toInstrumentSearchResults(json)).toEqual([]);
  });

  test('returns an empty array for a malformed or missing quotes field', () => {
    expect(toInstrumentSearchResults({})).toEqual([]);
    expect(toInstrumentSearchResults(null)).toEqual([]);
    expect(toInstrumentSearchResults({ quotes: 'not-an-array' })).toEqual([]);
  });
});

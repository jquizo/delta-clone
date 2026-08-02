import { describe, expect, test } from 'vitest';
import { parseCsv, stringifyCsv } from '../csv';

describe('stringifyCsv', () => {
  test('joins rows and columns with commas and newlines', () => {
    expect(stringifyCsv([['a', 'b'], ['1', '2']])).toBe('a,b\n1,2');
  });

  test('quotes a field containing a comma', () => {
    expect(stringifyCsv([['a,b', 'c']])).toBe('"a,b",c');
  });

  test('quotes a field containing a quote, doubling the internal quote', () => {
    expect(stringifyCsv([['say "hi"', 'x']])).toBe('"say ""hi""",x');
  });

  test('quotes a field containing a newline', () => {
    expect(stringifyCsv([['line1\nline2', 'x']])).toBe('"line1\nline2",x');
  });

  test('leaves plain fields unquoted', () => {
    expect(stringifyCsv([['ASX:BHP', '100', '40.00']])).toBe('ASX:BHP,100,40.00');
  });
});

describe('parseCsv', () => {
  test('parses a simple two-row CSV', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  test('parses a quoted field containing a comma', () => {
    expect(parseCsv('"a,b",c\n')).toEqual([['a,b', 'c']]);
  });

  test('parses a quoted field with an escaped internal quote', () => {
    expect(parseCsv('"say ""hi""",x')).toEqual([['say "hi"', 'x']]);
  });

  test('parses a quoted field containing an embedded newline', () => {
    expect(parseCsv('"line1\nline2",x')).toEqual([['line1\nline2', 'x']]);
  });

  test('handles trailing newline and blank lines without producing empty rows', () => {
    expect(parseCsv('a,b\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  test('round-trips through stringifyCsv and parseCsv', () => {
    const rows = [
      ['instrumentId', 'note'],
      ['ASX:BHP', 'bought on a dip, "great" timing'],
      ['NASDAQ:AAPL', 'line one\nline two'],
    ];
    expect(parseCsv(stringifyCsv(rows))).toEqual(rows);
  });
});

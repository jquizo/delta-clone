import { describe, expect, test } from 'vitest';
import { displayLabel } from '../allocationLabel';

describe('displayLabel', () => {
  test('strips the exchange prefix from a provider-neutral instrument id', () => {
    expect(displayLabel('NYSE:BMA')).toBe('BMA');
    expect(displayLabel('ASX:BHP')).toBe('BHP');
  });

  test('leaves exchange/currency group labels (no colon) unchanged', () => {
    expect(displayLabel('NASDAQ')).toBe('NASDAQ');
    expect(displayLabel('USD')).toBe('USD');
  });
});

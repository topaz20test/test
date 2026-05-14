import { describe, it, expect } from 'vitest';
import { calculateTotal, validateScore } from './calculations.js';

describe('calculateTotal', () => {
  it('sums four categories to 100', () => {
    expect(calculateTotal(25, 25, 25, 25)).toBe(100);
  });

  it('handles string inputs', () => {
    expect(calculateTotal('22.5', '23', '24', '25')).toBe(94.5);
  });

  it('treats empty as zero', () => {
    expect(calculateTotal('', null, undefined, 10)).toBe(10);
  });
});

describe('validateScore', () => {
  it('accepts 0-25 inclusive', () => {
    expect(validateScore('0').valid).toBe(true);
    expect(validateScore('25').valid).toBe(true);
    expect(validateScore('12.5').valid).toBe(true);
  });

  it('rejects out of range', () => {
    expect(validateScore('26').valid).toBe(false);
    expect(validateScore('-1').valid).toBe(false);
  });
});

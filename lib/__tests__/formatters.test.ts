import { describe, it, expect } from 'vitest';
import { formatPercent, formatCurrency } from '../formatters';

describe('formatPercent', () => {
  it('formats whole number percentages without decimals', () => {
    expect(formatPercent(0.10)).toBe('10%');
    expect(formatPercent(0.15)).toBe('15%');
    expect(formatPercent(0.22)).toBe('22%');
    expect(formatPercent(0.90)).toBe('90%');
  });

  it('formats percentages with one decimal place', () => {
    expect(formatPercent(0.095)).toBe('9.5%');
    expect(formatPercent(0.075)).toBe('7.5%');
    expect(formatPercent(0.125)).toBe('12.5%');
  });

  it('formats percentages with two decimal places', () => {
    expect(formatPercent(0.0495)).toBe('4.95%');
    expect(formatPercent(0.0725)).toBe('7.25%');
    expect(formatPercent(0.1234)).toBe('12.34%');
  });

  it('handles zero', () => {
    expect(formatPercent(0)).toBe('0%');
  });
});

describe('formatCurrency', () => {
  it('formats positive amounts', () => {
    expect(formatCurrency(1000)).toBe('$1,000');
    expect(formatCurrency(1234567)).toBe('$1,234,567');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  it('formats negative amounts', () => {
    expect(formatCurrency(-500)).toBe('-$500');
  });
});

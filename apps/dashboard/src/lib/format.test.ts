import { describe, it, expect } from 'vitest';

import { formatTokens, formatTokensCompact } from './format';

describe('formatTokens', () => {
  it('renders an em dash for nullish values', () => {
    expect(formatTokens(null)).toBe('—');
    expect(formatTokens(undefined)).toBe('—');
  });

  it('formats bigint-as-string without precision loss', () => {
    expect(formatTokens('9007199254740993')).toBe('9,007,199,254,740,993');
  });

  it('groups thousands', () => {
    expect(formatTokens(1234567)).toBe('1,234,567');
  });
});

describe('formatTokensCompact', () => {
  it('passes small numbers through', () => {
    expect(formatTokensCompact(999)).toBe('999');
  });

  it('uses K / M / B suffixes', () => {
    expect(formatTokensCompact(24500)).toBe('24.5K');
    expect(formatTokensCompact(1_200_000)).toBe('1.2M');
    expect(formatTokensCompact(3_000_000_000)).toBe('3B');
  });
});

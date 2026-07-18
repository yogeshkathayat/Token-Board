import { describe, it } from 'node:test';
import assert from 'node:assert';
import { estimateCostUsd } from '@/lib/pricing';
import { TokenTotals } from '@/lib/contract';

describe('pricing', () => {
  it('estimates cost for a known model', () => {
    const totals: TokenTotals = {
      input_tokens: 1_000_000,
      cached_input_tokens: 0,
      cache_creation_input_tokens: 0,
      output_tokens: 500_000,
      reasoning_output_tokens: 0,
      total_tokens: 1_500_000,
      billable_total_tokens: 1_500_000,
    };

    const cost = estimateCostUsd('claude-sonnet-4', totals);
    const expected = (1_000_000 / 1_000_000) * 3.0 + (500_000 / 1_000_000) * 15.0;
    assert.strictEqual(cost, expected.toFixed(6));
  });

  it('handles cache creation cost multiplier', () => {
    const totals: TokenTotals = {
      input_tokens: 0,
      cached_input_tokens: 0,
      cache_creation_input_tokens: 1_000_000,
      output_tokens: 0,
      reasoning_output_tokens: 0,
      total_tokens: 1_000_000,
      billable_total_tokens: 1_000_000,
    };

    const cost = estimateCostUsd('claude-sonnet-4', totals);
    const expected = (1_000_000 / 1_000_000) * 3.0 * 1.25;
    assert.strictEqual(cost, expected.toFixed(6));
  });

  it('returns zero for unknown model', () => {
    const totals: TokenTotals = {
      input_tokens: 1_000_000,
      cached_input_tokens: 0,
      cache_creation_input_tokens: 0,
      output_tokens: 500_000,
      reasoning_output_tokens: 0,
      total_tokens: 1_500_000,
      billable_total_tokens: 1_500_000,
    };

    const cost = estimateCostUsd('unknown-model-xyz', totals);
    assert.strictEqual(cost, '0.000000');
  });

  it('uses substring fallback for partial matches', () => {
    const totals: TokenTotals = {
      input_tokens: 1_000_000,
      cached_input_tokens: 0,
      cache_creation_input_tokens: 0,
      output_tokens: 0,
      reasoning_output_tokens: 0,
      total_tokens: 1_000_000,
      billable_total_tokens: 1_000_000,
    };

    const cost = estimateCostUsd('gpt-4o-2024-08-06', totals);
    const expected = (1_000_000 / 1_000_000) * 2.5;
    assert.strictEqual(cost, expected.toFixed(6));
  });
});

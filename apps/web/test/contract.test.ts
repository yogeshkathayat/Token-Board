import { describe, it } from 'node:test';
import assert from 'node:assert';
import { z } from 'zod';
import { isHalfHourBoundary, isKnownSource } from '@/lib/contract';

const TokenTotalsSchema = z.object({
  input_tokens: z.number().int().min(0),
  cached_input_tokens: z.number().int().min(0),
  cache_creation_input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
  reasoning_output_tokens: z.number().int().min(0),
  total_tokens: z.number().int().min(0),
  billable_total_tokens: z.number().int().min(0),
});

const UsageBucketSchema = TokenTotalsSchema.extend({
  source: z.string().transform((s) => (isKnownSource(s) ? s : 'other')),
  model: z.string(),
  hour_start: z.string().refine(isHalfHourBoundary, 'hour_start must be a UTC half-hour boundary'),
  conversation_count: z.number().int().min(0),
}).strict();

describe('contract validation', () => {
  it('rejects non-half-hour boundaries', () => {
    const bucket = {
      source: 'claude',
      model: 'claude-sonnet-4',
      hour_start: '2026-07-17T14:15:00.000Z',
      input_tokens: 100,
      cached_input_tokens: 0,
      cache_creation_input_tokens: 0,
      output_tokens: 50,
      reasoning_output_tokens: 0,
      total_tokens: 150,
      billable_total_tokens: 150,
      conversation_count: 1,
    };

    const result = UsageBucketSchema.safeParse(bucket);
    assert.strictEqual(result.success, false);
  });

  it('accepts valid half-hour boundaries', () => {
    const bucket = {
      source: 'claude',
      model: 'claude-sonnet-4',
      hour_start: '2026-07-17T14:30:00.000Z',
      input_tokens: 100,
      cached_input_tokens: 0,
      cache_creation_input_tokens: 0,
      output_tokens: 50,
      reasoning_output_tokens: 0,
      total_tokens: 150,
      billable_total_tokens: 150,
      conversation_count: 1,
    };

    const result = UsageBucketSchema.safeParse(bucket);
    assert.strictEqual(result.success, true);
  });

  it('coerces unknown source to other', () => {
    const bucket = {
      source: 'unknown-tool',
      model: 'gpt-4',
      hour_start: '2026-07-17T14:00:00.000Z',
      input_tokens: 100,
      cached_input_tokens: 0,
      cache_creation_input_tokens: 0,
      output_tokens: 50,
      reasoning_output_tokens: 0,
      total_tokens: 150,
      billable_total_tokens: 150,
      conversation_count: 1,
    };

    const result = UsageBucketSchema.safeParse(bucket);
    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.source, 'other');
    }
  });

  it('rejects unknown fields via strict', () => {
    const bucket = {
      source: 'claude',
      model: 'claude-sonnet-4',
      hour_start: '2026-07-17T14:30:00.000Z',
      input_tokens: 100,
      cached_input_tokens: 0,
      cache_creation_input_tokens: 0,
      output_tokens: 50,
      reasoning_output_tokens: 0,
      total_tokens: 150,
      billable_total_tokens: 150,
      conversation_count: 1,
      extra_field: 'should not be here',
    };

    const result = UsageBucketSchema.safeParse(bucket);
    assert.strictEqual(result.success, false);
  });
});

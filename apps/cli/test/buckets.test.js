'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { halfHourFloor, BucketAggregator } = require('../src/lib/buckets.js');

test('halfHourFloor rounds down to nearest UTC half-hour', () => {
  assert.equal(halfHourFloor('2026-05-07T14:37:42Z'), '2026-05-07T14:30:00.000Z');
  assert.equal(halfHourFloor('2026-05-07T14:00:01Z'), '2026-05-07T14:00:00.000Z');
  assert.equal(halfHourFloor('2026-05-07T14:29:59Z'), '2026-05-07T14:00:00.000Z');
  assert.equal(halfHourFloor('2026-05-07T14:30:00Z'), '2026-05-07T14:30:00.000Z');
  assert.equal(halfHourFloor('2026-05-07T23:59:59Z'), '2026-05-07T23:30:00.000Z');
});

test('halfHourFloor throws on invalid input', () => {
  assert.throws(() => halfHourFloor('not a date'), RangeError);
});

test('BucketAggregator merges by source|model|hour_start', () => {
  const agg = new BucketAggregator();
  agg.add('claude', 'claude-opus-4', '2026-05-07T10:05:00Z', { input_tokens: 100, output_tokens: 50 });
  agg.add('claude', 'claude-opus-4', '2026-05-07T10:25:00Z', { input_tokens: 200, output_tokens: 75 });
  agg.add('claude', 'claude-sonnet', '2026-05-07T10:25:00Z', { input_tokens: 10 });
  const out = agg.values();

  assert.equal(out.length, 2, 'two distinct bucket keys');
  const opus = out.find((b) => b.model === 'claude-opus-4');
  assert.equal(opus.input_tokens, 300);
  assert.equal(opus.output_tokens, 125);
  assert.equal(opus.total_tokens, 425);
});

test('BucketAggregator excludes empty buckets', () => {
  const agg = new BucketAggregator();
  agg.add('claude', 'claude-opus-4', '2026-05-07T10:00:00Z', { input_tokens: 0, output_tokens: 0 });
  assert.equal(agg.values().length, 0);
});

// Use a recent timestamp so the cumulative state isn't pruned by the 45-day window.
const RECENT_TS = new Date(Date.now() - 60 * 60 * 1000).toISOString();

test('BucketAggregator emits cumulative totals across runs when seeded with prior state', () => {
  const run1 = new BucketAggregator();
  run1.add('codex', 'gpt-5', RECENT_TS, { input_tokens: 100, output_tokens: 40 });
  assert.equal(run1.values()[0].input_tokens, 100);
  const persisted = run1.state();

  // Next run touches the SAME half-hour with a new delta. The emitted bucket
  // must be the FULL cumulative (140/55), not just the delta — otherwise the
  // API's REPLACE upsert would clobber the prior 100/40 slice.
  const run2 = new BucketAggregator(persisted);
  run2.add('codex', 'gpt-5', RECENT_TS, { input_tokens: 40, output_tokens: 15 });
  const out = run2.values();
  assert.equal(out.length, 1);
  assert.equal(out[0].input_tokens, 140);
  assert.equal(out[0].output_tokens, 55);
  assert.equal(out[0].total_tokens, 195);
});

test('BucketAggregator.values returns only buckets touched this run (idempotent re-sync)', () => {
  const prior = new BucketAggregator();
  prior.add('codex', 'gpt-5', RECENT_TS, { input_tokens: 100 });
  const seeded = new BucketAggregator(prior.state());
  // Nothing added this run → nothing to re-upload (the prior value is already
  // on the server; re-sending would be wasted, though harmless under REPLACE).
  assert.equal(seeded.values().length, 0);
  // …but the cumulative state is retained for future accumulation.
  assert.equal(Object.keys(seeded.state()).length, 1);
});

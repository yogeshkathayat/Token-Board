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

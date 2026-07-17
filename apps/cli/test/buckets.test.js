'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const {
  halfHourFloor,
  isHalfHourBoundary,
  bucketKey,
  initTotals,
  addTotals,
  SOURCES,
} = require('../src/lib/buckets');

test('halfHourFloor floors minutes < 30 to :00', () => {
  assert.strictEqual(halfHourFloor('2024-01-01T10:05:12.345Z'), '2024-01-01T10:00:00.000Z');
});

test('halfHourFloor floors minutes >= 30 to :30', () => {
  assert.strictEqual(halfHourFloor('2024-01-01T10:47:00.000Z'), '2024-01-01T10:30:00.000Z');
});

test('halfHourFloor boundary at exactly :30', () => {
  assert.strictEqual(halfHourFloor('2024-01-01T10:30:00.000Z'), '2024-01-01T10:30:00.000Z');
});

test('isHalfHourBoundary accepts floored values and rejects others', () => {
  assert.ok(isHalfHourBoundary('2024-01-01T10:30:00.000Z'));
  assert.ok(isHalfHourBoundary(halfHourFloor('2024-01-01T10:05:00Z')));
  assert.ok(!isHalfHourBoundary('2024-01-01T10:15:00.000Z'));
  assert.ok(!isHalfHourBoundary('not-a-date'));
});

test('bucketKey composes source|model|hour', () => {
  assert.strictEqual(
    bucketKey('claude', 'sonnet', '2024-01-01T10:00:00.000Z'),
    'claude|sonnet|2024-01-01T10:00:00.000Z',
  );
});

test('addTotals sums fields', () => {
  const a = initTotals();
  addTotals(a, { input_tokens: 5, output_tokens: 3 });
  addTotals(a, { input_tokens: 2 });
  assert.strictEqual(a.input_tokens, 7);
  assert.strictEqual(a.output_tokens, 3);
});

test('SOURCES includes the required tools', () => {
  for (const s of ['claude', 'codex', 'gemini', 'cursor', 'kiro', 'opencode']) {
    assert.ok(SOURCES.includes(s), `SOURCES missing ${s}`);
  }
});

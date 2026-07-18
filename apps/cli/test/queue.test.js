'use strict';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { setupEnv } = require('./helpers');
const queue = require('../src/lib/queue');
const { coalesce } = require('../src/lib/uploader');

const BASE_ROW = {
  source: 'claude',
  model: 'sonnet',
  hour_start: '2024-01-01T10:00:00.000Z',
  input_tokens: 100,
  cached_input_tokens: 10,
  cache_creation_input_tokens: 5,
  output_tokens: 50,
  reasoning_output_tokens: 0,
  total_tokens: 165,
  billable_total_tokens: 155,
  conversation_count: 1,
};

beforeEach(() => setupEnv());

test('serializeBucket drops any non-whitelisted field (privacy)', () => {
  const row = queue.serializeBucket({
    ...BASE_ROW,
    prompt: 'SUPER_SECRET_PROMPT',
    response: 'SUPER_SECRET_RESPONSE',
    filename: '/private/thing.ts',
  });
  const text = JSON.stringify(row);
  assert.ok(!text.includes('SUPER_SECRET'));
  assert.ok(!text.includes('filename'));
  assert.ok(!('prompt' in row));
  assert.strictEqual(row.input_tokens, 100);
  assert.strictEqual(row.conversation_count, 1);
});

test('serializeBucket rejects a non half-hour boundary', () => {
  assert.throws(() => queue.serializeBucket({ ...BASE_ROW, hour_start: '2024-01-01T10:15:00.000Z' }));
});

test('append/read/offset roundtrip', () => {
  queue.appendBucket(BASE_ROW);
  queue.appendBucket({ ...BASE_ROW, hour_start: '2024-01-01T10:30:00.000Z' });

  const first = queue.readFrom(queue.readOffset());
  assert.strictEqual(first.rows.length, 2);
  assert.ok(first.endOffset > 0);

  queue.writeOffset(first.endOffset);
  assert.strictEqual(queue.readOffset(), first.endOffset);

  const second = queue.readFrom(queue.readOffset());
  assert.strictEqual(second.rows.length, 0);
});

test('appended queue lines never contain content fields', () => {
  queue.appendBucket({ ...BASE_ROW, prompt: 'SUPER_SECRET_PROMPT' });
  const { rows } = queue.readFrom(0);
  assert.ok(!JSON.stringify(rows).includes('SUPER_SECRET_PROMPT'));
});

test('coalesce keeps latest cumulative per key', () => {
  const rows = [
    { ...BASE_ROW, total_tokens: 100 },
    { ...BASE_ROW, total_tokens: 300 },
    { ...BASE_ROW, hour_start: '2024-01-01T10:30:00.000Z', total_tokens: 50 },
  ];
  const out = coalesce(rows);
  assert.strictEqual(out.length, 2);
  const tenOclock = out.find((r) => r.hour_start === '2024-01-01T10:00:00.000Z');
  assert.strictEqual(tenOclock.total_tokens, 300);
});

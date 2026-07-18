'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { estimateTurn, turnTimestampIso } = require('../src/parsers/kiro');

test('estimateTurn approximates tokens at 4 chars/token', () => {
  assert.deepEqual(estimateTurn({ user_prompt_length: 40, response_size: 100 }), {
    input: 10,
    output: 25,
  });
});

test('estimateTurn is zero/robust for missing or bad fields', () => {
  assert.deepEqual(estimateTurn({}), { input: 0, output: 0 });
  assert.deepEqual(estimateTurn(null), { input: 0, output: 0 });
  assert.deepEqual(estimateTurn({ user_prompt_length: -5, response_size: 'x' }), {
    input: 0,
    output: 0,
  });
});

test('turnTimestampIso prefers request_start_timestamp_ms, falls back sensibly', () => {
  const ms = Date.UTC(2026, 6, 18, 12, 0, 0);
  assert.equal(turnTimestampIso({ request_start_timestamp_ms: ms }, {}, 0), new Date(ms).toISOString());
  // falls back to updated_at when no per-turn timestamp
  assert.equal(turnTimestampIso({}, {}, ms), new Date(ms).toISOString());
  // nothing usable -> null (turn skipped)
  assert.equal(turnTimestampIso({}, {}, 0), null);
});

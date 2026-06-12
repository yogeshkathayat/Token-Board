'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TEST_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'tokenboard-gemini-home-'));
const TEST_TRACKER_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'tokenboard-gemini-tracker-'));
process.env.HOME = TEST_HOME;
process.env.TOKENBOARD_HOME = TEST_TRACKER_HOME;

function clearCache() {
  for (const k of Object.keys(require.cache)) {
    if (k.includes('/src/')) delete require.cache[k];
  }
}

function writeSession(obj) {
  const dir = path.join(TEST_HOME, '.gemini', 'tmp', 's1', 'chats');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'session-abc.json'), JSON.stringify(obj));
}

function reset() {
  fs.rmSync(TEST_TRACKER_HOME, { recursive: true, force: true });
  fs.mkdirSync(TEST_TRACKER_HOME, { recursive: true });
  fs.rmSync(path.join(TEST_HOME, '.gemini'), { recursive: true, force: true });
  clearCache();
}

const ALLOWED = new Set([
  'hour_start', 'source', 'model', 'input_tokens', 'cached_input_tokens',
  'cache_creation_input_tokens', 'output_tokens', 'reasoning_output_tokens',
  'total_tokens', 'conversation_count',
]);

test('gemini parser aggregates token totals', async () => {
  reset();
  writeSession({
    model: 'gemini-2.5-pro',
    updated_at: '2026-05-07T10:05:00Z',
    total_token_usage: { input_tokens: 120, output_tokens: 30, cached_input_tokens: 10 },
  });
  const gemini = require('../src/parsers/gemini.js');
  const buckets = await gemini.parse();
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].source, 'gemini');
  assert.equal(buckets[0].input_tokens, 120);
  assert.equal(buckets[0].output_tokens, 30);
});

test('gemini parser captures only token counts — never message content (privacy invariant)', async () => {
  reset();
  // The parser JSON.parses the whole session, which carries the messages array.
  writeSession({
    model: 'gemini-2.5-pro',
    updated_at: '2026-05-07T10:05:00Z',
    total_token_usage: { input_tokens: 120, output_tokens: 30 },
    messages: [
      { role: 'user', content: 'SECRET: deploy creds for /Users/secret/prod' },
      { role: 'model', content: 'CONFIDENTIAL response text' },
    ],
  });
  const gemini = require('../src/parsers/gemini.js');
  const buckets = await gemini.parse();
  assert.equal(buckets.length, 1);
  const serialized = JSON.stringify(buckets);
  for (const leak of ['SECRET', 'CONFIDENTIAL', '/Users/secret', 'content', 'messages', 'role']) {
    assert.ok(!serialized.includes(leak), `bucket must not contain "${leak}"`);
  }
  for (const k of Object.keys(buckets[0])) {
    assert.ok(ALLOWED.has(k), `unexpected bucket field "${k}"`);
  }
});

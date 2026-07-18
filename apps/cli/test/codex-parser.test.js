'use strict';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { setupEnv, writeFixture } = require('./helpers');
const { runAll } = require('../src/parsers');

const SECRET = 'SUPER_SECRET_CODEX_TEXT';

const LINES = [
  JSON.stringify({
    type: 'turn_context',
    timestamp: '2024-01-01T10:00:00.000Z',
    payload: { model: 'gpt-5-codex', cwd: '/tmp/x' },
  }),
  JSON.stringify({
    type: 'message',
    timestamp: '2024-01-01T10:01:00.000Z',
    payload: { content: SECRET },
  }),
  JSON.stringify({
    type: 'token_count',
    timestamp: '2024-01-01T10:05:00.000Z',
    payload: {
      type: 'token_count',
      info: { total_token_usage: { input_tokens: 1000, cached_input_tokens: 200, output_tokens: 300, total_tokens: 1300 } },
    },
  }),
  JSON.stringify({
    type: 'token_count',
    timestamp: '2024-01-01T10:10:00.000Z',
    payload: {
      type: 'token_count',
      info: { total_token_usage: { input_tokens: 1500, cached_input_tokens: 200, output_tokens: 500, total_tokens: 2000 } },
    },
  }),
].join('\n') + '\n';

const REL = '.codex/sessions/2024/01/01/rollout-2024-01-01T10-00-00.jsonl';

function collect() {
  const rows = [];
  return { rows, enqueue: (r) => rows.push(r) };
}

beforeEach(() => setupEnv());

test('codex parser captures cumulative-delta token counts', async () => {
  const userHome = process.env.TOKENBOARD_USER_HOME;
  writeFixture(userHome, REL, LINES);
  const cursors = { version: 1, files: {}, buckets: {}, claudeHashes: [] };
  const { rows, enqueue } = collect();
  await runAll({ cursors, enqueue, config: {} });

  const b = rows.find((r) => r.source === 'codex');
  assert.ok(b, 'expected a codex bucket');
  assert.strictEqual(b.model, 'gpt-5-codex');
  // input = (1000-200) + (500-0) = 1300 ; cached = 200 ; output = 300+200 = 500
  assert.strictEqual(b.input_tokens, 1300);
  assert.strictEqual(b.cached_input_tokens, 200);
  assert.strictEqual(b.output_tokens, 500);
  assert.strictEqual(b.total_tokens, 2000);
  assert.strictEqual(b.conversation_count, 2);
});

test('codex parser never emits message content (privacy)', async () => {
  const userHome = process.env.TOKENBOARD_USER_HOME;
  writeFixture(userHome, REL, LINES);
  const cursors = { version: 1, files: {}, buckets: {}, claudeHashes: [] };
  const { rows, enqueue } = collect();
  await runAll({ cursors, enqueue, config: {} });
  assert.ok(!JSON.stringify(rows).includes(SECRET));
});

test('codex parser is incremental', async () => {
  const userHome = process.env.TOKENBOARD_USER_HOME;
  writeFixture(userHome, REL, LINES);
  const cursors = { version: 1, files: {}, buckets: {}, claudeHashes: [] };

  const first = collect();
  await runAll({ cursors, enqueue: first.enqueue, config: {} });
  assert.ok(first.rows.length > 0);

  const second = collect();
  await runAll({ cursors, enqueue: second.enqueue, config: {} });
  assert.strictEqual(second.rows.length, 0);
});

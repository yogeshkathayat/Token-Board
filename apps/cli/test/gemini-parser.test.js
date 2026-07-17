'use strict';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { setupEnv, writeFixture } = require('./helpers');
const { runAll } = require('../src/parsers');

const SECRET = 'SUPER_SECRET_GEMINI_TEXT';

const SESSION = JSON.stringify({
  messages: [
    { role: 'user', timestamp: '2024-01-01T10:01:00.000Z', content: SECRET },
    {
      role: 'assistant',
      model: 'gemini-2.0',
      timestamp: '2024-01-01T10:02:00.000Z',
      tokens: { input: 100, output: 50, total: 150 },
      content: SECRET,
    },
    {
      role: 'assistant',
      model: 'gemini-2.0',
      timestamp: '2024-01-01T10:20:00.000Z',
      tokens: { input: 300, output: 120, total: 420 },
    },
  ],
});

const REL = '.gemini/tmp/hash1/chats/session-1.json';

function collect() {
  const rows = [];
  return { rows, enqueue: (r) => rows.push(r) };
}

beforeEach(() => setupEnv());

test('gemini parser captures cumulative-delta token counts', async () => {
  const userHome = process.env.TOKENBOARD_USER_HOME;
  writeFixture(userHome, REL, SESSION);
  const cursors = { version: 1, files: {}, buckets: {}, claudeHashes: [] };
  const { rows, enqueue } = collect();
  await runAll({ cursors, enqueue, config: {} });

  const b = rows.find((r) => r.source === 'gemini');
  assert.ok(b, 'expected a gemini bucket');
  assert.strictEqual(b.model, 'gemini-2.0');
  // input = 100 + (300-100) = 300 ; output = 50 + (120-50) = 120
  assert.strictEqual(b.input_tokens, 300);
  assert.strictEqual(b.output_tokens, 120);
  assert.strictEqual(b.total_tokens, 420);
  assert.strictEqual(b.conversation_count, 2);
});

test('gemini parser never emits message content (privacy)', async () => {
  const userHome = process.env.TOKENBOARD_USER_HOME;
  writeFixture(userHome, REL, SESSION);
  const cursors = { version: 1, files: {}, buckets: {}, claudeHashes: [] };
  const { rows, enqueue } = collect();
  await runAll({ cursors, enqueue, config: {} });
  assert.ok(!JSON.stringify(rows).includes(SECRET));
});

test('gemini parser is incremental', async () => {
  const userHome = process.env.TOKENBOARD_USER_HOME;
  writeFixture(userHome, REL, SESSION);
  const cursors = { version: 1, files: {}, buckets: {}, claudeHashes: [] };

  const first = collect();
  await runAll({ cursors, enqueue: first.enqueue, config: {} });
  assert.ok(first.rows.length > 0);

  const second = collect();
  await runAll({ cursors, enqueue: second.enqueue, config: {} });
  assert.strictEqual(second.rows.length, 0);
});

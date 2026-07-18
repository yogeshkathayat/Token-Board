'use strict';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { setupEnv, writeFixture } = require('./helpers');
const { runAll } = require('../src/parsers');

const SECRET = 'SUPER_SECRET_CLAUDE_TEXT';

const LINES = [
  JSON.stringify({
    type: 'user',
    timestamp: '2024-01-01T10:05:00.000Z',
    message: { role: 'user', content: [{ type: 'text', text: SECRET }] },
  }),
  JSON.stringify({
    type: 'assistant',
    timestamp: '2024-01-01T10:06:00.000Z',
    requestId: 'req_1',
    message: {
      id: 'msg_1',
      model: 'claude-3-5-sonnet',
      content: [{ type: 'text', text: SECRET }],
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 10,
        cache_creation_input_tokens: 5,
      },
    },
  }),
].join('\n') + '\n';

function collect() {
  const rows = [];
  return { rows, enqueue: (r) => rows.push(r) };
}

beforeEach(() => setupEnv());

test('claude parser captures token counts', async () => {
  const { userHome } = { userHome: process.env.TOKENBOARD_USER_HOME };
  writeFixture(userHome, '.claude/projects/proj/session.jsonl', LINES);

  const cursors = { version: 1, files: {}, buckets: {}, claudeHashes: [] };
  const { rows, enqueue } = collect();
  await runAll({ cursors, enqueue, config: {} });

  const usage = rows.find((r) => r.model === 'claude-3-5-sonnet');
  assert.ok(usage, 'expected a claude usage bucket');
  assert.strictEqual(usage.source, 'claude');
  assert.strictEqual(usage.input_tokens, 100);
  assert.strictEqual(usage.output_tokens, 50);
  assert.strictEqual(usage.cached_input_tokens, 10);
  assert.strictEqual(usage.cache_creation_input_tokens, 5);
  assert.strictEqual(usage.total_tokens, 165);

  const conv = rows.find((r) => r.model === 'unknown');
  assert.ok(conv, 'expected a conversation-count bucket');
  assert.strictEqual(conv.conversation_count, 1);
});

test('claude parser never emits message content (privacy)', async () => {
  const userHome = process.env.TOKENBOARD_USER_HOME;
  writeFixture(userHome, '.claude/projects/proj/session.jsonl', LINES);
  const cursors = { version: 1, files: {}, buckets: {}, claudeHashes: [] };
  const { rows, enqueue } = collect();
  await runAll({ cursors, enqueue, config: {} });
  assert.ok(!JSON.stringify(rows).includes(SECRET));
});

test('claude parser is incremental (no new buckets on unchanged file)', async () => {
  const userHome = process.env.TOKENBOARD_USER_HOME;
  writeFixture(userHome, '.claude/projects/proj/session.jsonl', LINES);
  const cursors = { version: 1, files: {}, buckets: {}, claudeHashes: [] };

  const first = collect();
  await runAll({ cursors, enqueue: first.enqueue, config: {} });
  assert.ok(first.rows.length > 0);

  const second = collect();
  await runAll({ cursors, enqueue: second.enqueue, config: {} });
  assert.strictEqual(second.rows.length, 0);
});

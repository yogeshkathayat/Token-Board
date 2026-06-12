'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Set HOME *before* the parser module loads. The parser reads HOME via
// os.homedir() lazily, but doing this at module-load time avoids any
// edge cases where the test runner has cached env state.
const TEST_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'tokenboard-home-'));
const TEST_TRACKER_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'tokenboard-tracker-'));
process.env.HOME = TEST_HOME;
process.env.TOKENBOARD_HOME = TEST_TRACKER_HOME;

function clearCache() {
  for (const k of Object.keys(require.cache)) {
    if (k.includes('/src/')) delete require.cache[k];
  }
}

function writeProject(project, file, lines) {
  const dir = path.join(TEST_HOME, '.claude', 'projects', project);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
}

function reset() {
  fs.rmSync(TEST_TRACKER_HOME, { recursive: true, force: true });
  fs.mkdirSync(TEST_TRACKER_HOME, { recursive: true });
  fs.rmSync(path.join(TEST_HOME, '.claude'), { recursive: true, force: true });
  clearCache();
}

test('claude parser aggregates token usage from JSONL events', async () => {
  reset();
  writeProject('p1', 'history.jsonl', [
    {
      uuid: 'a',
      timestamp: '2026-05-07T10:05:00Z',
      role: 'user',
      message: { id: 'm1', role: 'user', model: 'claude-opus-4' },
    },
    {
      uuid: 'b',
      timestamp: '2026-05-07T10:06:00Z',
      message: {
        id: 'm2',
        role: 'assistant',
        model: 'claude-opus-4',
        usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 20 },
      },
    },
  ]);

  const claude = require('../src/parsers/claude.js');
  const buckets = await claude.parse();
  assert.equal(buckets.length, 1);
  const b = buckets[0];
  assert.equal(b.source, 'claude');
  assert.equal(b.model, 'claude-opus-4');
  assert.equal(b.input_tokens, 100);
  assert.equal(b.output_tokens, 50);
  assert.equal(b.cached_input_tokens, 20);
  assert.equal(b.total_tokens, 170);
  assert.equal(b.hour_start, '2026-05-07T10:00:00.000Z');
  assert.equal(b.conversation_count, 1);
});

test('claude parser dedupes the same billed message across files', async () => {
  // The same assistant message (same message.id + requestId) is logged into
  // two files — once in the main session, once in a /subagents/ jsonl — with
  // different per-event uuid values. It must be counted once, not twice.
  reset();
  const event = (uuid) => ({
    uuid,
    parentUuid: 'p',
    requestId: 'req_abc123',
    timestamp: '2026-05-12T11:00:00Z',
    isSidechain: false,
    message: {
      id: 'msg_01ZSAME',
      role: 'assistant',
      model: 'claude-opus-4-7',
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 200,
        cache_creation_input_tokens: 10,
      },
    },
  });
  writeProject('p3', 'main.jsonl', [event('uuid-in-main-file')]);
  writeProject('p3/subagents', 'agent.jsonl', [event('uuid-in-subagent-file')]);

  const claude = require('../src/parsers/claude.js');
  const buckets = await claude.parse();
  assert.equal(buckets.length, 1);
  const b = buckets[0];
  assert.equal(b.input_tokens, 100, 'input_tokens counted once');
  assert.equal(b.output_tokens, 50, 'output_tokens counted once');
  assert.equal(b.cached_input_tokens, 200, 'cache_read counted once');
  assert.equal(b.cache_creation_input_tokens, 10, 'cache_creation counted once');
  assert.equal(b.total_tokens, 360);
});

test('claude parser skips all-zero usage events', async () => {
  reset();
  writeProject('p4', 'history.jsonl', [
    {
      uuid: 'zero',
      requestId: 'req_zero',
      timestamp: '2026-05-12T12:00:00Z',
      message: {
        id: 'msg_zero',
        role: 'assistant',
        model: 'claude-opus-4-7',
        usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 },
      },
    },
    {
      uuid: 'real',
      requestId: 'req_real',
      timestamp: '2026-05-12T12:05:00Z',
      message: {
        id: 'msg_real',
        role: 'assistant',
        model: 'claude-opus-4-7',
        usage: { input_tokens: 5, output_tokens: 3 },
      },
    },
  ]);
  const claude = require('../src/parsers/claude.js');
  const buckets = await claude.parse();
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].input_tokens, 5);
  assert.equal(buckets[0].output_tokens, 3);
});

test('claude parser emits cumulative bucket totals across runs (not just deltas)', async () => {
  // The API upserts buckets with REPLACE semantics. If the parser emits only
  // the per-run delta on an incremental sync, the prior full-hour total gets
  // clobbered. The second run must therefore emit the cumulative bucket value
  // (1st event + 2nd event) for the touched hour, not just the 2nd event.
  reset();
  writeProject('p5', 'history.jsonl', [
    {
      uuid: 'e1',
      requestId: 'req_1',
      timestamp: '2026-05-12T17:05:00Z',
      message: {
        id: 'msg_1',
        role: 'assistant',
        model: 'claude-opus-4-7',
        usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100 },
      },
    },
  ]);
  const claude = require('../src/parsers/claude.js');
  const first = await claude.parse();
  assert.equal(first.length, 1);
  assert.equal(first[0].total_tokens, 115);

  // Append a second event in the SAME hour and re-parse.
  fs.appendFileSync(
    path.join(TEST_HOME, '.claude', 'projects', 'p5', 'history.jsonl'),
    JSON.stringify({
      uuid: 'e2',
      requestId: 'req_2',
      timestamp: '2026-05-12T17:10:00Z',
      message: {
        id: 'msg_2',
        role: 'assistant',
        model: 'claude-opus-4-7',
        usage: { input_tokens: 20, output_tokens: 8, cache_read_input_tokens: 200 },
      },
    }) + '\n',
  );
  const second = await claude.parse();
  assert.equal(second.length, 1, 'one touched bucket');
  // Cumulative: 10+20 input, 5+8 output, 100+200 cached.
  assert.equal(second[0].input_tokens, 30);
  assert.equal(second[0].output_tokens, 13);
  assert.equal(second[0].cached_input_tokens, 300);
  assert.equal(second[0].total_tokens, 343);
});

const ALLOWED_BUCKET_KEYS = new Set([
  'hour_start',
  'source',
  'model',
  'input_tokens',
  'cached_input_tokens',
  'cache_creation_input_tokens',
  'output_tokens',
  'reasoning_output_tokens',
  'total_tokens',
  'conversation_count',
]);

test('claude parser captures ONLY token counts — never prompt/response/file content (privacy invariant)', async () => {
  reset();
  // Feed events stuffed with content the parser must never forward: prompt text,
  // assistant response text, file paths, cwd, git branch, project name.
  writeProject('priv', 'history.jsonl', [
    {
      uuid: 'u',
      timestamp: '2026-05-07T10:05:00Z',
      role: 'user',
      cwd: '/Users/secret/projects/acme-merger',
      gitBranch: 'feature/secret-launch',
      message: {
        id: 'm-user',
        role: 'user',
        content: 'PROMPT: please refactor the salary spreadsheet at /Users/secret/payroll.xlsx',
      },
    },
    {
      uuid: 'v',
      timestamp: '2026-05-07T10:06:00Z',
      toolUseResult: { stdout: 'CONFIDENTIAL build output', file: { path: '/etc/passwd' } },
      message: {
        id: 'm-assistant',
        role: 'assistant',
        model: 'claude-opus-4',
        content: 'RESPONSE: here is the secret plan ...',
        usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 20 },
      },
    },
  ]);

  const claude = require('../src/parsers/claude.js');
  const buckets = await claude.parse();
  assert.equal(buckets.length, 1);

  const serialized = JSON.stringify(buckets);
  for (const leak of [
    'PROMPT',
    'RESPONSE',
    'CONFIDENTIAL',
    'payroll',
    'acme-merger',
    'feature/secret-launch',
    'passwd',
    '/Users/secret',
    'content',
    'cwd',
  ]) {
    assert.ok(!serialized.includes(leak), `bucket payload must not contain "${leak}"`);
  }
  for (const b of buckets) {
    for (const k of Object.keys(b)) {
      assert.ok(ALLOWED_BUCKET_KEYS.has(k), `unexpected bucket field "${k}" — only token counts/timestamps allowed`);
    }
  }
});

test('claude parser is incremental across runs', async () => {
  reset();
  writeProject('p2', 'history.jsonl', [
    {
      uuid: 'a',
      timestamp: '2026-05-07T10:05:00Z',
      message: { model: 'm', usage: { input_tokens: 10, output_tokens: 5 } },
    },
  ]);

  const claude = require('../src/parsers/claude.js');
  const first = await claude.parse();
  assert.equal(first.length, 1);
  const second = await claude.parse();
  assert.equal(second.length, 0, 'no new buckets on second run');

  // Append more and re-parse.
  fs.appendFileSync(
    path.join(TEST_HOME, '.claude', 'projects', 'p2', 'history.jsonl'),
    JSON.stringify({
      uuid: 'b',
      timestamp: '2026-05-07T10:35:00Z',
      message: { model: 'm', usage: { input_tokens: 7, output_tokens: 3 } },
    }) + '\n',
  );
  const third = await claude.parse();
  assert.equal(third.length, 1);
  assert.equal(third[0].input_tokens, 7);
});

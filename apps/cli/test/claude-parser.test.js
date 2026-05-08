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

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TEST_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'tokenboard-codex-home-'));
const TEST_TRACKER_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'tokenboard-codex-tracker-'));
process.env.HOME = TEST_HOME;
process.env.TOKENBOARD_HOME = TEST_TRACKER_HOME;

function clearCache() {
  for (const k of Object.keys(require.cache)) {
    if (k.includes('/src/')) delete require.cache[k];
  }
}

function writeRollout(lines) {
  const dir = path.join(TEST_HOME, '.codex', 'sessions', '2026', '05', '12');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'rollout-2026-05-12T10-00-00.jsonl');
  fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return file;
}

function reset() {
  fs.rmSync(TEST_TRACKER_HOME, { recursive: true, force: true });
  fs.mkdirSync(TEST_TRACKER_HOME, { recursive: true });
  fs.rmSync(path.join(TEST_HOME, '.codex'), { recursive: true, force: true });
  clearCache();
}

test('codex cumulative-total fallback emits per-step deltas, not the running total', async () => {
  reset();
  // Two cumulative `total_token_usage` readings in one session. The second is
  // the running total (300/120), not a delta. The parser must emit the delta
  // (200/80) for the second step — the bug was emitting the full 300/120.
  writeRollout([
    { type: 'session_meta', model: 'gpt-5-codex' },
    { timestamp: '2026-05-12T10:05:00Z', total_token_usage: { input_tokens: 100, output_tokens: 40 } },
    { timestamp: '2026-05-12T10:06:00Z', total_token_usage: { input_tokens: 300, output_tokens: 120 } },
  ]);

  const codex = require('../src/parsers/codex.js');
  const buckets = await codex.parse();
  // Both events fall in the same half-hour → one aggregated bucket.
  assert.equal(buckets.length, 1);
  const b = buckets[0];
  // Step 1 delta (100/40) + step 2 delta (200/80) = 300/120 cumulative — which
  // is correct because aggregation within the hour sums the deltas. The bug
  // would have produced 100/40 + 300/120 = 400/160 (over-count).
  assert.equal(b.input_tokens, 300, 'input is sum of deltas, not double-counted');
  assert.equal(b.output_tokens, 120, 'output is sum of deltas, not double-counted');
});

test('codex parser captures only token counts (privacy invariant)', async () => {
  reset();
  const ALLOWED = new Set([
    'hour_start', 'source', 'model', 'input_tokens', 'cached_input_tokens',
    'cache_creation_input_tokens', 'output_tokens', 'reasoning_output_tokens',
    'total_tokens', 'conversation_count',
  ]);
  writeRollout([
    { type: 'session_meta', model: 'gpt-5-codex', cwd: '/Users/secret/acme' },
    { timestamp: '2026-05-12T10:05:00Z', text: 'SECRET prompt content', total_token_usage: { input_tokens: 10, output_tokens: 5 } },
  ]);
  const codex = require('../src/parsers/codex.js');
  const buckets = await codex.parse();
  assert.ok(!JSON.stringify(buckets).includes('SECRET'));
  assert.ok(!JSON.stringify(buckets).includes('/Users/secret'));
  for (const b of buckets) {
    for (const k of Object.keys(b)) assert.ok(ALLOWED.has(k), `unexpected field ${k}`);
  }
});

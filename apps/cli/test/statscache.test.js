'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isHalfHourBoundary } = require('../src/lib/buckets');

const scPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tb-sc-')), 'stats-cache.json');
process.env.CLAUDE_STATS_CACHE = scPath;
fs.writeFileSync(
  scPath,
  JSON.stringify({
    dailyModelTokens: [
      { date: '2026-07-01', tokensByModel: { 'claude-opus-4-8': 1000, 'claude-sonnet-5': 0 } },
      { date: '2026-07-02', tokensByModel: { 'claude-opus-4-8': 500 } },
    ],
  }),
);

const { readClaudeDaily, claudeUploadBuckets } = require('../src/lib/statscache');

test('readClaudeDaily: per-model records, skips zeros, tracks maxDate', () => {
  const { records, maxDate } = readClaudeDaily();
  assert.equal(records.length, 2); // sonnet-5:0 dropped
  assert.equal(maxDate, '2026-07-02');
  assert.deepEqual(records[0], { date: '2026-07-01', model: 'claude-opus-4-8', tokens: 1000 });
});

test('claudeUploadBuckets are valid ingest buckets on noon-UTC half-hour boundaries', () => {
  const buckets = claudeUploadBuckets();
  assert.equal(buckets.length, 2);
  const b = buckets[0];
  assert.equal(b.source, 'claude');
  assert.equal(b.hour_start, '2026-07-01T12:00:00.000Z');
  assert.ok(isHalfHourBoundary(b.hour_start));
  assert.equal(b.total_tokens, 1000);
  assert.equal(b.input_tokens, 0); // totals only
});

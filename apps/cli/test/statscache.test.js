'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isHalfHourBoundary } = require('../src/lib/buckets');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-sc-'));
const scPath = path.join(dir, 'stats-cache.json');
const projDir = path.join(dir, 'projects');
fs.mkdirSync(projDir, { recursive: true });
process.env.CLAUDE_STATS_CACHE = scPath;
process.env.CLAUDE_PROJECTS_DIR = projDir;

fs.writeFileSync(
  scPath,
  JSON.stringify({
    dailyModelTokens: [
      { date: '2026-07-01', tokensByModel: { 'claude-opus-4-8': 1000, 'claude-sonnet-5': 0 } },
      { date: '2026-07-02', tokensByModel: { 'claude-opus-4-8': 500 } },
    ],
  }),
);

const { readStatsCache, readClaudeDaily, claudeUploadBuckets } = require('../src/lib/statscache');

test('stats-cache: per-model records, skips zeros, tracks maxDate', () => {
  const sc = readStatsCache();
  assert.equal(sc.records.length, 2); // sonnet-5:0 dropped
  assert.equal(sc.maxDate, '2026-07-02');
});

test('claudeUploadBuckets are valid ingest buckets on noon-UTC half-hour boundaries', () => {
  const buckets = claudeUploadBuckets();
  const b = buckets.find((x) => x.hour_start === '2026-07-01T12:00:00.000Z');
  assert.ok(b);
  assert.ok(isHalfHourBoundary(b.hour_start));
  assert.equal(b.total_tokens, 1000);
  assert.equal(b.input_tokens, 0); // totals only
});

test('live logs fill days AFTER the stats-cache maxDate (uncached, main-chain only)', () => {
  const line = (obj) => JSON.stringify(obj);
  fs.writeFileSync(
    path.join(projDir, 's.jsonl'),
    [
      // day 07-05 (> maxDate 07-02): counted, uncached = input+output+cache_create = 40
      line({ type: 'assistant', isSidechain: false, timestamp: '2026-07-05T12:00:00.000Z', message: { id: 'm1', model: 'claude-opus-4-8', usage: { input_tokens: 30, output_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 99999 } } }),
      // sidechain: ignored
      line({ type: 'assistant', isSidechain: true, timestamp: '2026-07-05T12:00:00.000Z', message: { id: 'm2', model: 'claude-opus-4-8', usage: { input_tokens: 500, output_tokens: 500 } } }),
      // day 07-01 (<= maxDate): ignored (stats-cache owns it)
      line({ type: 'assistant', isSidechain: false, timestamp: '2026-07-01T12:00:00.000Z', message: { id: 'm3', model: 'claude-opus-4-8', usage: { input_tokens: 777, output_tokens: 0 } } }),
    ].join('\n'),
  );
  const { records } = readClaudeDaily();
  const jul5 = records.filter((r) => r.date === '2026-07-05');
  assert.equal(jul5.length, 1);
  assert.equal(jul5[0].tokens, 40); // cache_read excluded; sidechain excluded
  // stats-cache days still present, and 07-01 not double-counted from live
  assert.equal(records.filter((r) => r.date === '2026-07-01').length, 1);
});

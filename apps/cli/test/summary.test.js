'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Fixture home so readStatsCacheClaude() reads our test stats-cache.json.
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-sum-'));
process.env.TOKENBOARD_USER_HOME = home;
fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
fs.writeFileSync(
  path.join(home, '.claude', 'stats-cache.json'),
  JSON.stringify({
    dailyModelTokens: [
      { date: '2026-07-20', tokensByModel: { 'claude-opus-4-8': 1000 } },
      { date: '2026-01-01', tokensByModel: { 'claude-sonnet-4-6': 500 } }, // old: in total, not d7/d30
    ],
  }),
);

const { computeSummary } = require('../src/lib/summary');

const now = new Date(2026, 6, 20, 12, 0, 0); // 2026-07-20 local noon
const cursors = {
  buckets: {
    k1: { source: 'opencode', model: 'big-pickle', hour_start: '2026-07-20T12:00:00.000Z', totals: { total_tokens: 200 } },
    // a claude live bucket must be IGNORED (claude comes from stats-cache, not live)
    k2: { source: 'claude', model: 'x', hour_start: '2026-07-20T12:00:00.000Z', totals: { total_tokens: 999999 } },
  },
};

test('claude from stats-cache, other sources from live buckets, claude live ignored', () => {
  const s = computeSummary(cursors, now);
  assert.equal(s.totals.total, '1700'); // 1000 + 500 + 200; claude live 999999 ignored
  const bySource = Object.fromEntries(s.by_source.map((r) => [r.source, r.total_tokens]));
  assert.equal(bySource.claude, '1500');
  assert.equal(bySource.opencode, '200');
});

test('rolling 7/30-day windows exclude the January day', () => {
  const s = computeSummary(cursors, now);
  assert.equal(s.totals.d30, '1200'); // today only (claude 1000 + opencode 200)
  assert.equal(s.totals.d7, '1200');
});

test('by_model has percentages and is sorted desc', () => {
  const s = computeSummary(cursors, now);
  assert.equal(s.by_model[0].model, 'claude-opus-4-8');
  assert.ok(s.by_model[0].pct > s.by_model[s.by_model.length - 1].pct - 0.001);
});

test('daily series is zero-filled and includes the oldest activity day', () => {
  const s = computeSummary(cursors, now);
  const jan = s.daily.find((d) => d.date === '2026-01-01');
  assert.ok(jan, 'daily should reach back to the oldest data day');
  assert.equal(jan.total_tokens, '500');
  assert.equal(s.active_days_total, 2);
});

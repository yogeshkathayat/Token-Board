'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeSummary } = require('../src/lib/summary');

const now = new Date(2026, 6, 20, 12, 0, 0); // 2026-07-20 local noon
const cursors = {
  buckets: {
    a: { source: 'claude', model: 'claude-opus-4-8', hour_start: '2026-07-20T12:00:00.000Z', totals: { total_tokens: 1000 } },
    b: { source: 'claude', model: 'claude-opus-4-8', hour_start: '2026-01-01T12:00:00.000Z', totals: { total_tokens: 500 } }, // old
    c: { source: 'opencode', model: 'big-pickle', hour_start: '2026-07-20T13:00:00.000Z', totals: { total_tokens: 200 } },
  },
};

test('totals sum all live buckets (claude included)', () => {
  const s = computeSummary(cursors, now);
  assert.equal(s.totals.total, '1700');
  const bySource = Object.fromEntries(s.by_source.map((r) => [r.source, r.total_tokens]));
  assert.equal(bySource.claude, '1500');
  assert.equal(bySource.opencode, '200');
});

test('rolling 7/30-day windows exclude the January bucket', () => {
  const s = computeSummary(cursors, now);
  assert.equal(s.totals.d30, '1200');
  assert.equal(s.totals.d7, '1200');
});

test('by_model has percentages and is sorted desc', () => {
  const s = computeSummary(cursors, now);
  assert.equal(s.by_model[0].model, 'claude-opus-4-8');
  assert.ok(s.by_model.every((m) => typeof m.pct === 'number'));
});

test('daily series is zero-filled back to the oldest bucket day', () => {
  const s = computeSummary(cursors, now);
  const jan = s.daily.find((d) => d.date === '2026-01-01');
  assert.ok(jan);
  assert.equal(jan.total_tokens, '500');
  assert.equal(s.active_days_total, 2);
});

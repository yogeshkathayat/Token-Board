'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeSummary } = require('../src/lib/summary');

function bucket(source, hourStart, total) {
  return { source, model: 'm', hour_start: hourStart, totals: { total_tokens: total }, conversation_count: 0 };
}

const cursors = {
  buckets: {
    a: bucket('claude', '2026-07-18T09:00:00.000Z', 1000),
    b: bucket('codex', '2026-07-18T09:30:00.000Z', 500),
    c: bucket('claude', '2020-01-01T00:00:00.000Z', 99), // old: in total, not this month/week
  },
};
const now = new Date('2026-07-18T12:00:00.000Z'); // a Saturday

test('total sums every bucket', () => {
  const s = computeSummary(cursors, now);
  assert.equal(s.totals.total, '1599');
});

test('month/week exclude buckets before the window', () => {
  const s = computeSummary(cursors, now);
  assert.equal(s.totals.month, '1500'); // excludes the 2020 bucket
  assert.equal(s.totals.week, '1500');
});

test('periods are monotonic (today <= week <= month <= total)', () => {
  const s = computeSummary(cursors, now);
  const t = BigInt(s.totals.today);
  const w = BigInt(s.totals.week);
  const m = BigInt(s.totals.month);
  const tot = BigInt(s.totals.total);
  assert.ok(t <= w && w <= m && m <= tot);
});

test('by_source aggregates and is sorted desc, values are strings', () => {
  const s = computeSummary(cursors, now);
  assert.deepEqual(
    s.by_source,
    [
      { source: 'claude', total_tokens: '1099' },
      { source: 'codex', total_tokens: '500' },
    ],
  );
});

test('empty cursors yield zeros, not a crash', () => {
  const s = computeSummary({}, now);
  assert.equal(s.totals.total, '0');
  assert.deepEqual(s.by_source, []);
});

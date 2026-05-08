import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-secret-32-bytes-long-aaaaaaaaaaaa';
process.env.DATABASE_URL = 'postgres://test/test';

const { periodWindow } = await import('../../src/services/leaderboard.js');

test('week window is Sunday-aligned in UTC', () => {
  // 2026-05-07 is a Thursday in UTC. Sunday before is 2026-05-03; Saturday after is 2026-05-09.
  const now = new Date('2026-05-07T12:00:00Z');
  const w = periodWindow('week', now);
  assert.equal(w.from, '2026-05-03');
  assert.equal(w.to, '2026-05-09');
});

test('month window covers the calendar month', () => {
  const w = periodWindow('month', new Date('2026-05-15T00:00:00Z'));
  assert.equal(w.from, '2026-05-01');
  assert.equal(w.to, '2026-05-31');
});

test('total window is unbounded', () => {
  const w = periodWindow('total', new Date('2026-05-07T12:00:00Z'));
  assert.equal(w.from, '1970-01-01');
  assert.equal(w.to, '9999-12-31');
});

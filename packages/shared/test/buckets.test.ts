import test from 'node:test';
import assert from 'node:assert/strict';

import { halfHourFloor, isHalfHourBoundary } from '../src/buckets.js';

test('halfHourFloor matches the CLI implementation', () => {
  assert.equal(halfHourFloor('2026-05-07T14:37:42Z'), '2026-05-07T14:30:00.000Z');
  assert.equal(halfHourFloor('2026-05-07T14:00:00Z'), '2026-05-07T14:00:00.000Z');
  assert.equal(halfHourFloor('2026-05-07T14:29:59.999Z'), '2026-05-07T14:00:00.000Z');
  assert.equal(halfHourFloor(new Date('2026-05-07T23:59:59Z')), '2026-05-07T23:30:00.000Z');
});

test('halfHourFloor throws on bad input', () => {
  assert.throws(() => halfHourFloor('not a date'), RangeError);
});

test('isHalfHourBoundary identifies aligned timestamps', () => {
  assert.equal(isHalfHourBoundary('2026-05-07T14:00:00.000Z'), true);
  assert.equal(isHalfHourBoundary('2026-05-07T14:30:00.000Z'), true);
  assert.equal(isHalfHourBoundary('2026-05-07T14:00:00Z'), true);
  assert.equal(isHalfHourBoundary('2026-05-07T14:30:01.000Z'), false);
  assert.equal(isHalfHourBoundary('2026-05-07T14:15:00.000Z'), false);
  assert.equal(isHalfHourBoundary('not a date'), false);
});

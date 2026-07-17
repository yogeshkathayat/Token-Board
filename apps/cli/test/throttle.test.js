'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const {
  decideAutoUpload,
  recordUploadSuccess,
  recordUploadFailure,
  parseRetryAfterMs,
  normalizeState,
} = require('../src/lib/upload-throttle');

test('decideAutoUpload blocks when nothing is pending', () => {
  const d = decideAutoUpload({ nowMs: 1000, pendingBytes: 0, state: null });
  assert.strictEqual(d.allowed, false);
  assert.strictEqual(d.reason, 'no-pending');
});

test('decideAutoUpload allows when pending and not throttled', () => {
  const d = decideAutoUpload({ nowMs: 1000, pendingBytes: 500, state: null });
  assert.strictEqual(d.allowed, true);
  assert.ok(d.maxBatches >= 1);
});

test('decideAutoUpload blocks while within backoff window', () => {
  const state = normalizeState({ nextAllowedAtMs: 5000 });
  const d = decideAutoUpload({ nowMs: 1000, pendingBytes: 500, state });
  assert.strictEqual(d.allowed, false);
  assert.strictEqual(d.reason, 'throttled');
  assert.strictEqual(d.blockedUntilMs, 5000);
});

test('recordUploadSuccess sets nextAllowed and clears backoff', () => {
  const prev = recordUploadFailure({ nowMs: 1000, state: null, error: { status: 500 } });
  const next = recordUploadSuccess({ nowMs: 2000, state: prev, randInt: () => 0 });
  assert.strictEqual(next.lastSuccessMs, 2000);
  assert.strictEqual(next.backoffUntilMs, 0);
  assert.strictEqual(next.backoffStep, 0);
  assert.ok(next.nextAllowedAtMs > 2000);
});

test('recordUploadFailure grows backoff step and respects Retry-After', () => {
  const first = recordUploadFailure({ nowMs: 1000, state: null, error: { status: 500 } });
  assert.ok(first.backoffUntilMs > 1000);
  assert.strictEqual(first.backoffStep, 1);

  const second = recordUploadFailure({ nowMs: 2000, state: first, error: { status: 500 } });
  assert.strictEqual(second.backoffStep, 2);

  const withRetry = recordUploadFailure({
    nowMs: 1000,
    state: null,
    error: { status: 429, retryAfterMs: 10 * 60_000 },
  });
  assert.strictEqual(withRetry.backoffUntilMs, 1000 + 10 * 60_000);
});

test('parseRetryAfterMs handles seconds, dates, and junk', () => {
  assert.strictEqual(parseRetryAfterMs('30'), 30_000);
  assert.strictEqual(parseRetryAfterMs(''), null);
  assert.strictEqual(parseRetryAfterMs('garbage'), null);
  const future = new Date(Date.now() + 60_000).toUTCString();
  const ms = parseRetryAfterMs(future);
  assert.ok(ms > 0 && ms <= 60_000);
});

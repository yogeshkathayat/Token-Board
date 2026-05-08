'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function freshHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tokenboard-test-'));
  process.env.TOKENBOARD_HOME = dir;
  for (const k of Object.keys(require.cache)) {
    if (k.includes('/src/lib/')) delete require.cache[k];
  }
  return dir;
}

test('throttle: success resets backoff and pushes nextAllowedAt out', () => {
  freshHome();
  const throttle = require('../src/lib/throttle.js');
  throttle.recordSuccess();
  const s = throttle.loadState();
  assert.ok(s.lastSuccessMs > 0);
  assert.ok(s.nextAllowedAtMs > Date.now());
  assert.equal(s.backoffStep, 0);
});

test('throttle: failure increments backoff step', () => {
  freshHome();
  const throttle = require('../src/lib/throttle.js');
  throttle.recordFailure('boom');
  let s = throttle.loadState();
  assert.equal(s.backoffStep, 1);
  assert.equal(s.lastError, 'boom');
  throttle.recordFailure('boom2');
  s = throttle.loadState();
  assert.equal(s.backoffStep, 2);
});

test('throttle: shouldAutoSync false when nextAllowedAt is in the future', () => {
  freshHome();
  const throttle = require('../src/lib/throttle.js');
  throttle.recordSuccess();
  assert.equal(throttle.shouldAutoSync(), false);
});

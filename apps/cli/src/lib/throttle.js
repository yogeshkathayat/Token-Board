'use strict';

const { paths } = require('./paths.js');
const { readJsonOrDefault, writeJsonAtomic } = require('./fs-util.js');

const DEFAULTS = {
  intervalMs: 10 * 60_000, // 10 min between auto syncs
  jitterMaxMs: 60_000,
  initialBackoffMs: 60_000,
  maxBackoffMs: 30 * 60_000,
};

function loadState() {
  return Object.assign(
    {
      lastSuccessMs: 0,
      nextAllowedAtMs: 0,
      backoffStep: 0,
      lastError: null,
    },
    readJsonOrDefault(paths().throttle, {}),
  );
}

function saveState(state) {
  writeJsonAtomic(paths().throttle, state);
}

function shouldAutoSync(now = Date.now()) {
  const s = loadState();
  return now >= (s.nextAllowedAtMs || 0);
}

function recordSuccess() {
  const now = Date.now();
  const jitter = Math.floor(Math.random() * DEFAULTS.jitterMaxMs);
  saveState({
    lastSuccessMs: now,
    nextAllowedAtMs: now + DEFAULTS.intervalMs + jitter,
    backoffStep: 0,
    lastError: null,
  });
}

function recordFailure(message) {
  const cur = loadState();
  const step = (cur.backoffStep || 0) + 1;
  const backoff = Math.min(DEFAULTS.initialBackoffMs * 2 ** (step - 1), DEFAULTS.maxBackoffMs);
  saveState({
    lastSuccessMs: cur.lastSuccessMs || 0,
    nextAllowedAtMs: Date.now() + backoff,
    backoffStep: step,
    lastError: typeof message === 'string' ? message.slice(0, 500) : null,
  });
}

module.exports = { shouldAutoSync, recordSuccess, recordFailure, loadState };

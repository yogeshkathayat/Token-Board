'use strict';

const fs = require('fs');
const path = require('path');

const { ensureDir } = require('./fs-util.js');

const STALE_MS = 5 * 60_000; // a lock older than this is assumed orphaned

/**
 * Best-effort single-instance lock. Returns a release() function on success, or
 * null if another live holder owns the lock. Prevents a manual `tokenboard
 * sync` and the background daemon from racing the queue offset / compaction.
 */
function acquire(lockPath) {
  ensureDir(path.dirname(lockPath));
  const payload = JSON.stringify({ pid: process.pid, at: Date.now() });

  const tryCreate = () => {
    try {
      const fd = fs.openSync(lockPath, 'wx'); // O_CREAT | O_EXCL
      fs.writeSync(fd, payload);
      fs.closeSync(fd);
      return true;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      return false;
    }
  };

  if (tryCreate()) return makeRelease(lockPath);

  // Lock exists — take it over only if it's stale or its holder is dead.
  let info = null;
  try {
    info = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  } catch {
    /* unreadable/corrupt lock — treat as stale */
  }
  const stale =
    !info ||
    typeof info.at !== 'number' ||
    Date.now() - info.at > STALE_MS ||
    (typeof info.pid === 'number' && !isAlive(info.pid));

  if (!stale) return null;

  try {
    fs.rmSync(lockPath, { force: true });
  } catch {
    /* ignore */
  }
  return tryCreate() ? makeRelease(lockPath) : null;
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // ESRCH = no such process; EPERM = exists but not ours (alive).
    return err.code === 'EPERM';
  }
}

function makeRelease(lockPath) {
  let released = false;
  return function release() {
    if (released) return;
    released = true;
    try {
      fs.rmSync(lockPath, { force: true });
    } catch {
      /* ignore */
    }
  };
}

module.exports = { acquire };

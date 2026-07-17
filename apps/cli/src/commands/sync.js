'use strict';

const fs = require('node:fs');
const { paths } = require('../lib/tracker-paths');
const { readConfig, isPaired } = require('../lib/config');
const { loadCursors, saveCursors } = require('../lib/cursors');
const { appendBucket, pendingBytes } = require('../lib/queue');
const { runAll } = require('../parsers');
const { drainQueueToCloud } = require('../lib/uploader');

const LOCK_STALE_MS = 15 * 60_000;

function acquireLock() {
  const { root, lockPath } = paths();
  fs.mkdirSync(root, { recursive: true });
  try {
    fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
    return true;
  } catch (e) {
    if (!e || e.code !== 'EEXIST') throw e;
  }
  // Steal a stale lock.
  try {
    const st = fs.statSync(lockPath);
    if (Date.now() - st.mtimeMs > LOCK_STALE_MS) {
      fs.writeFileSync(lockPath, String(process.pid));
      return true;
    }
  } catch {
    /* raced away — treat as held */
  }
  return false;
}

function releaseLock() {
  const { lockPath } = paths();
  try {
    fs.unlinkSync(lockPath);
  } catch {
    /* ignore */
  }
}

function parseArgs(argv) {
  const out = { drain: false, force: false };
  for (const a of argv) {
    if (a === '--drain') out.drain = true;
    else if (a === '--force') out.force = true;
  }
  return out;
}

async function run(argv) {
  const args = parseArgs(argv);
  const out = process.stdout;
  const config = readConfig();

  if (!acquireLock()) {
    out.write('Another sync is in progress; skipping.\n');
    return 0;
  }

  try {
    if (!args.drain) {
      const cursors = loadCursors();
      const result = await runAll({
        cursors,
        config,
        enqueue: (row) => appendBucket(row),
      });
      saveCursors(cursors);
      out.write(`Parsed ${result.parsersRun} tool(s); queued ${result.bucketsQueued} bucket(s).\n`);
    }

    if (!isPaired(config)) {
      out.write('Not paired — run `tokenboard init --link-code <CODE>` to upload.\n');
      out.write(`Pending queue: ${pendingBytes()} bytes.\n`);
      return 0;
    }

    const drainResult = await drainQueueToCloud({ config, force: args.force || args.drain });
    if (drainResult.reason === 'ok') {
      out.write(`Uploaded ${drainResult.uploaded} bucket(s).\n`);
    } else if (drainResult.reason === 'throttled') {
      out.write('Upload throttled; will retry later. Use --force to override.\n');
    } else if (drainResult.reason === 'no-pending') {
      out.write('Nothing to upload.\n');
    } else if (drainResult.reason === 'error') {
      out.write(`Upload failed: ${drainResult.error}\n`);
      return 1;
    } else {
      out.write(`Upload skipped (${drainResult.reason}).\n`);
    }
    return 0;
  } finally {
    releaseLock();
  }
}

module.exports = { run };

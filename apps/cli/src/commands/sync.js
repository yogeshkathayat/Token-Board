'use strict';

const { loadConfig } = require('../lib/config.js');
const { request } = require('../lib/http.js');
const queue = require('../lib/queue.js');
const throttle = require('../lib/throttle.js');
const lock = require('../lib/lock.js');
const { paths } = require('../lib/paths.js');
const { runAll } = require('../parsers/index.js');

const MAX_BATCHES = 4;

function hasFlag(argv, name) {
  return argv.includes(name);
}

async function run(argv) {
  const cfg = loadConfig();
  const quiet = hasFlag(argv, '--quiet');
  const force = hasFlag(argv, '--force') || hasFlag(argv, '--drain');

  const log = quiet ? () => {} : (msg) => process.stdout.write(msg + '\n');

  if (!cfg.device_token || !cfg.base_url) {
    log('No device token. Run `tokenboard init` first.');
    process.exit(2);
  }

  if (!force && !throttle.shouldAutoSync()) {
    log('Throttled — next sync allowed later. Pass --force to override.');
    return;
  }

  // Single-instance lock: a manual sync and the background daemon must not run
  // concurrently or they'd race the queue offset and compaction.
  const release = lock.acquire(paths().syncLock);
  if (!release) {
    log('Another sync is already running; skipping.');
    return;
  }
  let exitCode = 0;
  try {
    await drain(cfg, log);
  } catch (err) {
    exitCode = err && err.__exitCode ? err.__exitCode : 1;
    if (!(err && err.__exitCode)) log(`Sync error: ${err.message}`);
  } finally {
    release(); // always release the lock, even on the upload-failure exit path
  }
  if (exitCode) process.exit(exitCode);
}

async function drain(cfg, log) {
  // 1) Parse all sources (runAll appends each parser's buckets to the queue).
  const { summary } = await runAll();
  if (process.env.TOKENBOARD_DEBUG) {
    process.stderr.write(`[parse] ${JSON.stringify(summary)}\n`);
  }

  // 2) Drain queue to backend, in batches.
  let totalInserted = 0;
  let totalSkipped = 0;
  let drained = true;
  for (let i = 0; i < MAX_BATCHES; i += 1) {
    const startOffset = queue.loadQueueState().offset;
    const { rows, nextOffset, rawCount } = queue.nextBatch();
    // Nothing consumed from the queue → fully drained, stop.
    if (nextOffset === startOffset && rawCount === 0) break;
    // Offset advanced but no uploadable rows: either an all-duplicate window or
    // an oversized/corrupt line that nextBatch skipped. Commit the advance so
    // the queue can't wedge on it, then continue.
    if (rows.length === 0) {
      queue.commitOffset(nextOffset);
      continue;
    }
    try {
      const resp = await request({
        baseUrl: cfg.base_url,
        path: '/api/v1/ingest',
        method: 'POST',
        token: cfg.device_token,
        body: { hourly: rows },
      });
      totalInserted += resp?.inserted ?? 0;
      totalSkipped += resp?.skipped ?? 0;
      queue.commitOffset(nextOffset);
    } catch (err) {
      throttle.recordFailure(err.message);
      log(`Upload failed: ${err.message}`);
      // Propagate so run() can release the single-instance lock before exiting.
      throw Object.assign(new Error('sync upload failed'), { __exitCode: 1 });
    }
  }

  // If we exhausted MAX_BATCHES but the queue still has more, we didn't fully
  // drain — schedule a sooner retry instead of waiting the full interval.
  const { rawCount: remaining } = queue.nextBatch();
  drained = remaining === 0;

  throttle.recordSuccess(drained);
  // Reclaim the consumed prefix of the append-only queue once fully drained.
  if (drained) queue.compact();

  // 3) Sync ping (heartbeat) so the server can distinguish "no usage" from
  // "not synced".
  try {
    await request({
      baseUrl: cfg.base_url,
      path: '/api/v1/sync-ping',
      method: 'POST',
      token: cfg.device_token,
    });
  } catch {
    /* non-fatal */
  }

  log(`✓ Sync complete. Inserted ${totalInserted}, skipped ${totalSkipped}.`);
}

module.exports = { run };

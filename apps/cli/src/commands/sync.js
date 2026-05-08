'use strict';

const { loadConfig } = require('../lib/config.js');
const { request } = require('../lib/http.js');
const queue = require('../lib/queue.js');
const throttle = require('../lib/throttle.js');
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

  // 1) Parse all sources, append to queue.
  const { buckets, summary } = await runAll();
  if (buckets.length > 0) queue.appendBuckets(buckets);
  if (process.env.TOKENBOARD_DEBUG) {
    process.stderr.write(`[parse] ${JSON.stringify(summary)}\n`);
  }

  // 2) Drain queue to backend, in batches.
  let totalInserted = 0;
  let totalSkipped = 0;
  for (let i = 0; i < MAX_BATCHES; i += 1) {
    const { rows, nextOffset, rawCount } = queue.nextBatch();
    if (rawCount === 0) break;
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
      process.exit(1);
    }
  }

  throttle.recordSuccess();

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

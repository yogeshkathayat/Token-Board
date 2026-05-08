'use strict';

const fs = require('fs');

const { loadConfig } = require('../lib/config.js');
const { paths } = require('../lib/paths.js');
const { loadQueueState } = require('../lib/queue.js');
const throttle = require('../lib/throttle.js');
const hooks = require('../lib/hooks.js');

async function run() {
  const cfg = loadConfig();
  const t = throttle.loadState();
  const qs = loadQueueState();
  let queueSize = 0;
  try {
    queueSize = fs.statSync(paths().queue).size - (qs.offset || 0);
  } catch {
    /* no queue yet */
  }

  console.log('tokenboard status');
  console.log('───────────────────');
  console.log(`backend     : ${cfg.base_url || '(not set)'}`);
  console.log(`device      : ${cfg.device_id ?? '(not linked)'}`);
  console.log(`queue bytes : ${queueSize} (offset=${qs.offset ?? 0})`);
  console.log(`last success: ${t.lastSuccessMs ? new Date(t.lastSuccessMs).toISOString() : '(none)'}`);
  console.log(`next allowed: ${t.nextAllowedAtMs ? new Date(t.nextAllowedAtMs).toISOString() : '(now)'}`);
  console.log(`backoff step: ${t.backoffStep ?? 0}`);
  if (t.lastError) console.log(`last error  : ${t.lastError}`);

  const detected = hooks.detectInstalledTools();
  console.log('');
  console.log('detected tools:');
  for (const [k, v] of Object.entries(detected)) {
    console.log(`  ${k.padEnd(10)} ${v ? '✓' : '·'}`);
  }
}

module.exports = { run };

'use strict';

const { loadConfig } = require('../lib/config.js');
const { request } = require('../lib/http.js');

async function check(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.log(`  ✗ ${name} — ${err.message}`);
  }
}

async function run() {
  const cfg = loadConfig();
  console.log('tokenboard doctor');
  console.log('───────────────────');

  await check('config has base_url', () => {
    if (!cfg.base_url) throw new Error('not configured (run `tokenboard init`)');
  });

  await check('backend reachable', async () => {
    if (!cfg.base_url) throw new Error('skipped');
    await request({ baseUrl: cfg.base_url, path: '/api/v1/healthz' });
  });

  await check('device token valid', async () => {
    if (!cfg.device_token) throw new Error('not linked');
    await request({
      baseUrl: cfg.base_url,
      path: '/api/v1/sync-ping',
      method: 'POST',
      token: cfg.device_token,
    });
  });
}

module.exports = { run };

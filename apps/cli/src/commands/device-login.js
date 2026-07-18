'use strict';

const os = require('node:os');
const { readConfig, updateConfig } = require('../lib/config');
const { getOrCreateMachineId } = require('../lib/machine-id');

// Exchange a dashboard-minted link code for a long-lived device token.
// Public, idempotent endpoint. Returns { token, deviceId, userId }.
async function exchangeLinkCode({ baseUrl, code, machineId }) {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/link-code/exchange`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code,
        device_name: os.hostname(),
        platform: process.platform,
        machine_id: machineId,
      }),
    });
  } catch (e) {
    throw new Error(`could not reach ${url}: ${e && e.message}`);
  }
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {
      /* ignore */
    }
    throw new Error(`link-code exchange failed: HTTP ${res.status}${detail ? ` — ${detail}` : ''}`);
  }
  const data = await res.json();
  const token = data.token || data.device_token;
  const deviceId = data.device_id || data.deviceId;
  const userId = data.user_id || data.userId || null;
  if (!token) throw new Error('server did not return a device token');
  if (!deviceId) throw new Error('server did not return a device id');
  return { token, deviceId, userId };
}

async function pairWithLinkCode({ baseUrl, code, out = process.stdout }) {
  const machineId = getOrCreateMachineId();
  out.write(`Pairing with ${baseUrl} ...\n`);
  const { token, deviceId, userId } = await exchangeLinkCode({ baseUrl, code, machineId });
  updateConfig({ baseUrl, deviceToken: token, deviceId, userId, machineId });
  out.write(`Paired. device_id=${deviceId}\n`);
  return { deviceId, userId };
}

function parseArgs(argv) {
  const out = { baseUrl: null, code: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base-url') out.baseUrl = argv[++i] || null;
    else if (a === '--link-code' || a === '--code') out.code = argv[++i] || null;
    else if (!a.startsWith('-') && !out.code) out.code = a;
  }
  return out;
}

async function run(argv) {
  const args = parseArgs(argv);
  const config = readConfig();
  const baseUrl = args.baseUrl || config.baseUrl;
  if (!args.code) {
    process.stderr.write('usage: tokenboard device-login --link-code <CODE> [--base-url <url>]\n');
    return 2;
  }
  await pairWithLinkCode({ baseUrl, code: args.code });
  return 0;
}

module.exports = { exchangeLinkCode, pairWithLinkCode, run };

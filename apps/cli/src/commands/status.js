'use strict';

const { readConfig, isPaired } = require('../lib/config');
const { readFrom, readOffset, pendingBytes } = require('../lib/queue');
const throttle = require('../lib/upload-throttle');

async function run() {
  const out = process.stdout;
  const config = readConfig();
  const state = throttle.loadState();
  const { rows } = readFrom(readOffset());

  out.write('TokenBoard status\n');
  out.write(`  backend:    ${config.baseUrl || '(unset)'}\n`);
  out.write(`  paired:     ${isPaired(config) ? 'yes' : 'no'}\n`);
  out.write(`  device_id:  ${config.deviceId || '(none)'}\n`);
  out.write(`  machine_id: ${config.machineId || '(none)'}\n`);
  out.write(`  pending:    ${rows.length} bucket(s), ${pendingBytes()} bytes\n`);
  out.write(`  last sync:  ${state.lastSuccessMs ? new Date(state.lastSuccessMs).toISOString() : 'never'}\n`);
  if (state.lastError) out.write(`  last error: ${state.lastError} (${state.lastErrorAt})\n`);
  return 0;
}

module.exports = { run };

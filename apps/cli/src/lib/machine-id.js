'use strict';

const crypto = require('node:crypto');
const { readConfig, updateConfig } = require('./config');

function isValidMachineId(v) {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(v);
}

// Stable per-machine id persisted in config.json (0600). One machine = one
// cloud device row, so its cumulative hourly upserts land on a single row.
function getOrCreateMachineId() {
  const config = readConfig();
  if (isValidMachineId(config.machineId)) return config.machineId;

  let generated;
  try {
    generated = crypto.randomUUID();
  } catch {
    generated = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  updateConfig({ machineId: generated });
  return generated;
}

module.exports = { getOrCreateMachineId, isValidMachineId };

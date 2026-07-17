'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { paths } = require('./tracker-paths');

const CONFIG_KEYS = ['baseUrl', 'deviceToken', 'userId', 'deviceId', 'machineId'];

const DEFAULTS = {
  baseUrl: 'http://localhost:3000',
  deviceToken: null,
  userId: null,
  deviceId: null,
  machineId: null,
};

function readConfig() {
  const { configPath } = paths();
  let raw = null;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch (e) {
    if (e && e.code === 'ENOENT') return { ...DEFAULTS };
    throw e;
  }
  let parsed = {};
  try {
    parsed = JSON.parse(raw) || {};
  } catch {
    parsed = {};
  }
  return { ...DEFAULTS, ...parsed };
}

function writeConfig(config) {
  const { root, configPath } = paths();
  fs.mkdirSync(root, { recursive: true });
  const next = {};
  for (const k of CONFIG_KEYS) {
    if (config[k] !== undefined) next[k] = config[k];
  }
  // mode on create avoids a world-readable window; chmod re-tightens an existing file.
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
  try {
    fs.chmodSync(configPath, 0o600);
  } catch {
    /* best effort */
  }
  return next;
}

function updateConfig(patch) {
  const merged = { ...readConfig(), ...patch };
  return writeConfig(merged);
}

function isPaired(config) {
  const c = config || readConfig();
  return typeof c.deviceToken === 'string' && c.deviceToken.length > 0;
}

module.exports = { CONFIG_KEYS, DEFAULTS, readConfig, writeConfig, updateConfig, isPaired };

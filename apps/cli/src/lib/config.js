'use strict';

const { paths } = require('./paths.js');
const { readJsonOrDefault, writeJsonAtomic } = require('./fs-util.js');

/**
 * Persistent CLI config. Stored in plaintext — device tokens are still
 * useful even if exfiltrated only because the server logs an access pattern,
 * but treat this file as sensitive (mode 0600).
 */
function loadConfig() {
  const def = {
    base_url: process.env.TOKENBOARD_BASE_URL || '',
    device_id: null,
    device_token: null,
    user: null,
    auto_sync: true,
  };
  return Object.assign(def, readJsonOrDefault(paths().config, {}));
}

function saveConfig(cfg) {
  writeJsonAtomic(paths().config, cfg);
}

function updateConfig(patch) {
  const cur = loadConfig();
  const next = Object.assign({}, cur, patch);
  saveConfig(next);
  return next;
}

module.exports = { loadConfig, saveConfig, updateConfig };

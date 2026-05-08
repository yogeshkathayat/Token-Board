'use strict';

const { paths } = require('./paths.js');
const { readJsonOrDefault, writeJsonAtomic } = require('./fs-util.js');

/**
 * Per-source incremental parse state. Each parser stores whatever it needs
 * here (file inode, byte offset, last seen rowid, etc.). Keeping it in one
 * file makes `tokenboard doctor` and `uninstall` simple.
 *
 * Shape:
 *   {
 *     claude: { files: { [path]: { inode, offset, hash } } },
 *     codex: { files: { ... } },
 *     gemini: { files: { ... } },
 *     opencode: { lastRowId },
 *     kiro: { lastRowId, files: { ... } },
 *     cursor: { lastRowDate },
 *     copilot: { files: { ... } },
 *   }
 */
function load() {
  return readJsonOrDefault(paths().cursors, {});
}

function save(state) {
  writeJsonAtomic(paths().cursors, state);
}

function get(source) {
  const all = load();
  return all[source] || {};
}

function set(source, data) {
  const all = load();
  all[source] = data;
  save(all);
}

module.exports = { load, save, get, set };

'use strict';

const fs = require('node:fs');
const { paths } = require('./tracker-paths');

function emptyCursors() {
  return { version: 1, files: {}, buckets: {}, claudeHashes: [], updatedAt: null };
}

function loadCursors() {
  const { cursorsPath } = paths();
  let raw = null;
  try {
    raw = fs.readFileSync(cursorsPath, 'utf8');
  } catch (e) {
    if (e && e.code === 'ENOENT') return emptyCursors();
    throw e;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyCursors();
  }
  const base = emptyCursors();
  return {
    ...base,
    ...parsed,
    files: parsed && typeof parsed.files === 'object' && parsed.files ? parsed.files : {},
    buckets: parsed && typeof parsed.buckets === 'object' && parsed.buckets ? parsed.buckets : {},
    claudeHashes: Array.isArray(parsed && parsed.claudeHashes) ? parsed.claudeHashes : [],
  };
}

function saveCursors(cursors) {
  const { root, cursorsPath } = paths();
  fs.mkdirSync(root, { recursive: true });
  cursors.updatedAt = new Date().toISOString();
  fs.writeFileSync(cursorsPath, JSON.stringify(cursors, null, 2) + '\n');
}

module.exports = { emptyCursors, loadCursors, saveCursors };

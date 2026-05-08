'use strict';

const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true, mode: 0o700 });
}

function readJsonOrDefault(file, fallback) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Atomic JSON write — writes to a tmp file in the same directory and renames.
 * Prevents readers from observing a half-written file even on power loss.
 */
function writeJsonAtomic(file, data) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function appendJsonl(file, rows) {
  if (!rows || rows.length === 0) return;
  ensureDir(path.dirname(file));
  const lines = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
  fs.appendFileSync(file, lines, { mode: 0o600 });
}

function readJsonlSlice(file, fromByte, maxBytes) {
  if (!fs.existsSync(file)) return { rows: [], nextOffset: fromByte };
  const stat = fs.statSync(file);
  if (fromByte >= stat.size) return { rows: [], nextOffset: fromByte };
  const fd = fs.openSync(file, 'r');
  try {
    const len = Math.min(maxBytes, stat.size - fromByte);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, fromByte);
    const text = buf.toString('utf8');
    const lastNl = text.lastIndexOf('\n');
    const usable = lastNl >= 0 ? text.slice(0, lastNl) : text;
    const consumed = lastNl >= 0 ? lastNl + 1 : 0;
    const rows = usable
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    return { rows, nextOffset: fromByte + consumed };
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = {
  ensureDir,
  readJsonOrDefault,
  writeJsonAtomic,
  appendJsonl,
  readJsonlSlice,
};

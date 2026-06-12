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

// Find the byte offset just past the next '\n' at or after `from`, scanning to
// `size`. Returns -1 if no newline is found before EOF.
function offsetAfterNextNewline(fd, from, size) {
  const CHUNK = 64 * 1024;
  let pos = from;
  const buf = Buffer.alloc(CHUNK);
  while (pos < size) {
    const want = Math.min(CHUNK, size - pos);
    const read = fs.readSync(fd, buf, 0, want, pos);
    if (read <= 0) break;
    const nl = buf.subarray(0, read).indexOf(0x0a);
    if (nl >= 0) return pos + nl + 1;
    pos += read;
  }
  return -1;
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

    if (lastNl < 0) {
      // No newline in the whole window. If we read to EOF, the line is still
      // being appended — wait for more. Otherwise it's a single line longer
      // than maxBytes (a poison pill): skip past it so the queue can't wedge.
      const reachedEof = fromByte + len >= stat.size;
      if (reachedEof) return { rows: [], nextOffset: fromByte };
      const skipTo = offsetAfterNextNewline(fd, fromByte + len, stat.size);
      // skipTo < 0 means the oversized line still has no terminator yet.
      return { rows: [], nextOffset: skipTo < 0 ? fromByte : skipTo };
    }

    const usable = text.slice(0, lastNl);
    const consumed = lastNl + 1;
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

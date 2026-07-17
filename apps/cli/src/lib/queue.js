'use strict';

const fs = require('node:fs');
const { paths } = require('./tracker-paths');
const { isHalfHourBoundary } = require('./buckets');

// The ONLY fields ever written to the queue. This is the structural privacy
// invariant: no prompt, response, filename, or any content field can appear in
// an uploaded bucket because the serializer picks exactly these keys and nothing
// else. Do not add a non-numeric/identity field here without a security review.
const NUMERIC_FIELDS = [
  'input_tokens',
  'cached_input_tokens',
  'cache_creation_input_tokens',
  'output_tokens',
  'reasoning_output_tokens',
  'total_tokens',
  'billable_total_tokens',
  'conversation_count',
];

function toSafeInt(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

// Produce a queue row containing ONLY the whitelisted columns. Any extra keys on
// the input are silently dropped.
function serializeBucket(row) {
  if (!row || typeof row !== 'object') {
    throw new Error('queue: bucket row must be an object');
  }
  const source = String(row.source || '').trim();
  const model = String(row.model || '').trim();
  const hourStart = String(row.hour_start || '').trim();
  if (!source) throw new Error('queue: bucket row missing source');
  if (!hourStart || !isHalfHourBoundary(hourStart)) {
    throw new Error(`queue: hour_start must be a UTC half-hour boundary, got ${hourStart}`);
  }
  const out = { source, model: model || 'unknown', hour_start: hourStart };
  for (const k of NUMERIC_FIELDS) out[k] = toSafeInt(row[k]);
  return out;
}

function appendBucket(row) {
  const { root, queuePath } = paths();
  fs.mkdirSync(root, { recursive: true });
  const line = JSON.stringify(serializeBucket(row)) + '\n';
  fs.appendFileSync(queuePath, line);
}

function readOffset() {
  const { queueStatePath } = paths();
  try {
    const parsed = JSON.parse(fs.readFileSync(queueStatePath, 'utf8'));
    const n = Number(parsed && parsed.offset);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function writeOffset(offset) {
  const { root, queueStatePath } = paths();
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(queueStatePath, JSON.stringify({ offset: Math.max(0, Math.floor(offset)) }) + '\n');
}

// Read all complete lines committed after `fromOffset`. Returns parsed rows plus
// the byte offset at the end of the last complete line (partial trailing writes
// are left for the next read).
function readFrom(fromOffset) {
  const { queuePath } = paths();
  let size = 0;
  try {
    size = fs.statSync(queuePath).size;
  } catch {
    return { rows: [], endOffset: 0 };
  }
  let start = Number.isFinite(fromOffset) && fromOffset >= 0 ? Math.floor(fromOffset) : 0;
  if (start > size) start = 0; // truncated/rotated
  if (start >= size) return { rows: [], endOffset: size };

  const fd = fs.openSync(queuePath, 'r');
  try {
    const len = size - start;
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, start);
    const lastNl = buf.lastIndexOf(0x0a);
    if (lastNl === -1) return { rows: [], endOffset: start };
    const consumed = lastNl + 1;
    const text = buf.slice(0, consumed).toString('utf8');
    const rows = [];
    for (const line of text.split('\n')) {
      if (!line) continue;
      try {
        rows.push(JSON.parse(line));
      } catch {
        /* skip corrupt line */
      }
    }
    return { rows, endOffset: start + consumed };
  } finally {
    fs.closeSync(fd);
  }
}

function pendingBytes() {
  const { queuePath } = paths();
  let size = 0;
  try {
    size = fs.statSync(queuePath).size;
  } catch {
    return 0;
  }
  return Math.max(0, size - readOffset());
}

// When the committed offset has caught up to EOF, the queue is fully uploaded — reclaim the
// file so it doesn't grow without bound over the life of the install. Only compacts when
// there's nothing pending (offset >= size), so no un-uploaded rows are ever dropped.
function compactIfDrained() {
  const { queuePath } = paths();
  let size = 0;
  try {
    size = fs.statSync(queuePath).size;
  } catch {
    return false;
  }
  if (size > 0 && readOffset() >= size) {
    fs.writeFileSync(queuePath, '');
    writeOffset(0);
    return true;
  }
  return false;
}

module.exports = {
  NUMERIC_FIELDS,
  serializeBucket,
  appendBucket,
  readOffset,
  writeOffset,
  readFrom,
  pendingBytes,
  compactIfDrained,
};

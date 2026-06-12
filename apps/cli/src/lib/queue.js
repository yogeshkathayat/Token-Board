'use strict';

const fs = require('fs');

const { paths } = require('./paths.js');
const { appendJsonl, readJsonlSlice, readJsonOrDefault, writeJsonAtomic } = require('./fs-util.js');

const DEFAULT_BATCH_BYTES = 256 * 1024;
const COMPACT_THRESHOLD_BYTES = 1024 * 1024; // compact once the consumed prefix exceeds 1MB

const MAX_MODEL_LEN = 200;

function appendBuckets(buckets) {
  if (!buckets || buckets.length === 0) return 0;
  // Clamp the only variable-length field so a pathological model identifier
  // can't produce a queue line larger than the batch window (the server caps
  // model length too; this keeps the local queue drainable).
  const safe = buckets.map((b) =>
    typeof b.model === 'string' && b.model.length > MAX_MODEL_LEN
      ? { ...b, model: b.model.slice(0, MAX_MODEL_LEN) }
      : b,
  );
  appendJsonl(paths().queue, safe);
  return safe.length;
}

function loadQueueState() {
  return readJsonOrDefault(paths().queueState, { offset: 0 });
}

function saveQueueState(state) {
  writeJsonAtomic(paths().queueState, state);
}

/**
 * Read the next batch of pending buckets from the queue, deduped by
 * (source|model|hour_start) — last write wins. Returns the rows plus the
 * byte offset the caller should commit if upload succeeds.
 */
function nextBatch(maxBytes = DEFAULT_BATCH_BYTES) {
  const state = loadQueueState();
  const { rows, nextOffset } = readJsonlSlice(paths().queue, state.offset, maxBytes);
  const dedup = new Map();
  for (const r of rows) {
    if (!r || !r.hour_start || !r.source) continue;
    const key = `${r.source}|${r.model || 'unknown'}|${r.hour_start}`;
    dedup.set(key, r);
  }
  return { rows: Array.from(dedup.values()), nextOffset, rawCount: rows.length };
}

function commitOffset(offset) {
  saveQueueState({ offset });
}

/**
 * Reclaim disk for the consumed prefix of the append-only queue. Drops the
 * already-uploaded bytes [0, offset) and keeps the unconsumed tail, resetting
 * the offset to 0. No-op until the consumed prefix is large enough to be worth
 * rewriting. Call only after a successful drain (no append happens between the
 * read and the rename within a single sync run).
 */
function compact() {
  const file = paths().queue;
  if (!fs.existsSync(file)) return;
  const { offset } = loadQueueState();
  if (!offset || offset < COMPACT_THRESHOLD_BYTES) return;
  const stat = fs.statSync(file);
  const tail = offset >= stat.size ? Buffer.alloc(0) : (() => {
    const fd = fs.openSync(file, 'r');
    try {
      const len = stat.size - offset;
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, offset);
      return buf;
    } finally {
      fs.closeSync(fd);
    }
  })();
  const tmp = `${file}.${process.pid}.${Date.now()}.compact`;
  fs.writeFileSync(tmp, tail, { mode: 0o600 });
  // Reset the offset to 0 BEFORE swapping the file. If we crash between these
  // two steps the offset is 0 against the still-full file, so the next run
  // re-reads from the start and re-uploads (idempotent under the server's
  // REPLACE upsert) — never the reverse, where a stale large offset against the
  // truncated tail would skip and lose the retained tail.
  saveQueueState({ offset: 0 });
  fs.renameSync(tmp, file);
}

module.exports = { appendBuckets, nextBatch, commitOffset, compact, loadQueueState };

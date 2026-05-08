'use strict';

const { paths } = require('./paths.js');
const { appendJsonl, readJsonlSlice, readJsonOrDefault, writeJsonAtomic } = require('./fs-util.js');

const DEFAULT_BATCH_BYTES = 256 * 1024;

function appendBuckets(buckets) {
  if (!buckets || buckets.length === 0) return 0;
  appendJsonl(paths().queue, buckets);
  return buckets.length;
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

module.exports = { appendBuckets, nextBatch, commitOffset, loadQueueState };

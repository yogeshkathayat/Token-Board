'use strict';

const { bucketKey } = require('./buckets');
const queue = require('./queue');
const throttle = require('./upload-throttle');

const MAX_BATCH = 500;

// Collapse rows to the latest per (source|model|hour_start). Buckets carry
// cumulative totals, so the last write for a key is authoritative; the backend
// upsert (keyed on the same tuple) then replaces the stored value.
function coalesce(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    map.set(bucketKey(row.source, row.model, row.hour_start), row);
  }
  return Array.from(map.values());
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function postBatch({ baseUrl, deviceToken, deviceId, buckets }) {
  const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/ingest`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${deviceToken}`,
    },
    body: JSON.stringify({ device_id: deviceId, buckets }),
  });
  if (res.status >= 200 && res.status < 300) return { ok: true };
  const retryAfterMs = throttle.parseRetryAfterMs(res.headers.get('retry-after'));
  const err = new Error(`ingest failed: HTTP ${res.status}`);
  err.status = res.status;
  if (retryAfterMs != null) err.retryAfterMs = retryAfterMs;
  return { ok: false, error: err };
}

// Drain committed queue rows to the backend. Honors the throttle/backoff state
// machine unless `force` is set. Advances + persists the queue offset only after
// every batch in the window succeeds (idempotent upsert makes a full re-send of
// a failed window safe).
async function drainQueueToCloud({ config, force = false, nowMs = Date.now() } = {}) {
  if (!config || !config.baseUrl) return { uploaded: 0, reason: 'no-base-url' };
  if (!config.deviceToken) return { uploaded: 0, reason: 'not-paired' };
  if (!config.deviceId) return { uploaded: 0, reason: 'no-device-id' };

  const state = throttle.loadState();
  const pending = queue.pendingBytes();
  if (!force) {
    const decision = throttle.decideAutoUpload({ nowMs, pendingBytes: pending, state, config: {} });
    if (!decision.allowed) return { uploaded: 0, reason: decision.reason, blockedUntilMs: decision.blockedUntilMs };
  }
  if (pending <= 0) return { uploaded: 0, reason: 'no-pending' };

  const fromOffset = queue.readOffset();
  const { rows, endOffset } = queue.readFrom(fromOffset);
  if (rows.length === 0) {
    if (endOffset > fromOffset) queue.writeOffset(endOffset);
    return { uploaded: 0, reason: 'no-rows' };
  }

  const batches = chunk(coalesce(rows), MAX_BATCH);
  let uploaded = 0;
  for (const batch of batches) {
    let result;
    try {
      result = await postBatch({
        baseUrl: config.baseUrl,
        deviceToken: config.deviceToken,
        deviceId: config.deviceId,
        buckets: batch,
      });
    } catch (e) {
      result = { ok: false, error: e };
    }
    if (!result.ok) {
      throttle.saveState(throttle.recordUploadFailure({ nowMs, state, error: result.error }));
      return { uploaded, reason: 'error', error: result.error.message };
    }
    uploaded += batch.length;
  }

  queue.writeOffset(endOffset);
  throttle.saveState(throttle.recordUploadSuccess({ nowMs, state }));
  return { uploaded, reason: 'ok' };
}

module.exports = { coalesce, drainQueueToCloud, MAX_BATCH };

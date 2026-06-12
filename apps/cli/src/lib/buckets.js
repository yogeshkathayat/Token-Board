'use strict';

/**
 * Half-hour UTC bucketing — must match the API's isHalfHourBoundary check.
 */
function halfHourFloor(input) {
  const dt = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(dt.getTime())) {
    throw new RangeError(`halfHourFloor: invalid date ${String(input)}`);
  }
  const minutes = dt.getUTCMinutes() >= 30 ? 30 : 0;
  return new Date(
    Date.UTC(
      dt.getUTCFullYear(),
      dt.getUTCMonth(),
      dt.getUTCDate(),
      dt.getUTCHours(),
      minutes,
      0,
      0,
    ),
  ).toISOString();
}

function emptyBucket(source, model, hourStart) {
  return {
    hour_start: hourStart,
    source,
    model: model || 'unknown',
    input_tokens: 0,
    cached_input_tokens: 0,
    cache_creation_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: 0,
    conversation_count: 0,
  };
}

function addToBucket(target, delta) {
  for (const k of [
    'input_tokens',
    'cached_input_tokens',
    'cache_creation_input_tokens',
    'output_tokens',
    'reasoning_output_tokens',
    'conversation_count',
  ]) {
    if (typeof delta[k] === 'number' && Number.isFinite(delta[k])) {
      target[k] = (target[k] || 0) + Math.max(0, Math.floor(delta[k]));
    }
  }
  // Recompute total each time so it stays consistent.
  target.total_tokens =
    (target.input_tokens || 0) +
    (target.cached_input_tokens || 0) +
    (target.cache_creation_input_tokens || 0) +
    (target.output_tokens || 0) +
    (target.reasoning_output_tokens || 0);
  return target;
}

function hydrateBucket(v) {
  const b = emptyBucket(String(v.source || ''), String(v.model || 'unknown'), String(v.hour_start || ''));
  for (const k of [
    'input_tokens',
    'cached_input_tokens',
    'cache_creation_input_tokens',
    'output_tokens',
    'reasoning_output_tokens',
    'total_tokens',
    'conversation_count',
  ]) {
    b[k] = Number(v[k]) || 0;
  }
  return b;
}

/**
 * Aggregates per-(source, model, hour) token counts.
 *
 * The API upserts buckets with REPLACE semantics, so a parser must emit the
 * FULL cumulative value of any bucket it touches — emitting only this-run
 * deltas would let a later sync of the same half-hour clobber earlier slices.
 * Seed the aggregator with the parser's persisted `hourly` state so deltas
 * accumulate across runs, emit cumulative totals for touched buckets via
 * values(), and persist the merged map via state().
 */
class BucketAggregator {
  constructor(priorState) {
    this.map = new Map(); // key: source|model|hour_start
    this.touched = new Set();
    if (priorState && typeof priorState === 'object') {
      for (const [k, v] of Object.entries(priorState)) {
        if (v && typeof v === 'object') this.map.set(k, hydrateBucket(v));
      }
    }
  }
  add(source, model, ts, delta) {
    const hourStart = halfHourFloor(ts);
    const key = `${source}|${model || 'unknown'}|${hourStart}`;
    let cur = this.map.get(key);
    if (!cur) {
      cur = emptyBucket(source, model, hourStart);
      this.map.set(key, cur);
    }
    addToBucket(cur, delta);
    this.touched.add(key);
  }
  /** Full cumulative buckets touched THIS run — safe to upload under REPLACE. */
  values() {
    const out = [];
    for (const key of this.touched) {
      const b = this.map.get(key);
      if (b && (b.total_tokens > 0 || b.conversation_count > 0)) out.push({ ...b });
    }
    return out;
  }
  /**
   * The full merged cumulative state to persist in the parser's cursor, pruned
   * to recent hours so it doesn't grow without bound. Old hours won't be
   * touched again under near-real-time syncing.
   */
  state(retainDays = 45) {
    const cutoffMs = Date.now() - retainDays * 86400_000;
    const obj = {};
    for (const [k, b] of this.map.entries()) {
      const t = Date.parse(b.hour_start);
      if (Number.isFinite(t) && t < cutoffMs) continue;
      obj[k] = b;
    }
    return obj;
  }
}

module.exports = { halfHourFloor, emptyBucket, addToBucket, BucketAggregator };

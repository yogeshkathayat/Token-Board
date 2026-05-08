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

class BucketAggregator {
  constructor() {
    this.map = new Map(); // key: source|model|hour_start
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
  }
  values() {
    return Array.from(this.map.values()).filter((b) => b.total_tokens > 0 || b.conversation_count > 0);
  }
}

module.exports = { halfHourFloor, emptyBucket, addToBucket, BucketAggregator };

'use strict';

/**
 * TokenBoard ingest contract (CLI side, CommonJS).
 *
 * Behavioural twin of apps/web/src/lib/contract.ts. packages/contract/test asserts the
 * two agree on a shared vector. Change a rule here -> change it there too.
 */

const SOURCES = ['claude', 'codex', 'cursor', 'kiro', 'gemini', 'opencode', 'other'];

const BUCKET_SEPARATOR = '|';

function isKnownSource(s) {
  return SOURCES.includes(s);
}

/** Zeroed token totals object. */
function initTotals() {
  return {
    input_tokens: 0,
    cached_input_tokens: 0,
    cache_creation_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: 0,
    billable_total_tokens: 0,
  };
}

/** Add src totals into dst (mutates dst). */
function addTotals(dst, src) {
  for (const k of Object.keys(dst)) {
    dst[k] += Number(src[k]) || 0;
  }
  return dst;
}

/**
 * Floor a timestamp to its UTC half-hour boundary and return an ISO string.
 * Minutes >= 30 -> :30, else :00; seconds and milliseconds zeroed.
 */
function halfHourFloor(input) {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`halfHourFloor: invalid timestamp ${String(input)}`);
  }
  const minutes = d.getUTCMinutes() >= 30 ? 30 : 0;
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      minutes,
      0,
      0,
    ),
  ).toISOString();
}

/** True iff `iso` is a valid UTC half-hour boundary. */
function isHalfHourBoundary(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  if (d.toISOString() !== iso) return false;
  const m = d.getUTCMinutes();
  return (m === 0 || m === 30) && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

function bucketKey(source, model, hourStart) {
  return `${source}${BUCKET_SEPARATOR}${model}${BUCKET_SEPARATOR}${hourStart}`;
}

module.exports = {
  SOURCES,
  BUCKET_SEPARATOR,
  isKnownSource,
  initTotals,
  addTotals,
  halfHourFloor,
  isHalfHourBoundary,
  bucketKey,
};

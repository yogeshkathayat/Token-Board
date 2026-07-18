'use strict';

const { halfHourFloor, bucketKey, initTotals, addTotals } = require('../lib/buckets');

const PARSERS = [
  require('./claude'),
  require('./codex'),
  require('./gemini'),
  require('./cursor'),
  require('./kiro'),
  require('./opencode'),
];

// billable excludes cheap cached-read input.
function billable(totals) {
  return (
    totals.input_tokens +
    totals.cache_creation_input_tokens +
    totals.output_tokens +
    totals.reasoning_output_tokens
  );
}

function toQueueRow(bucket) {
  const t = bucket.totals;
  return {
    source: bucket.source,
    model: bucket.model,
    hour_start: bucket.hour_start,
    input_tokens: t.input_tokens,
    cached_input_tokens: t.cached_input_tokens,
    cache_creation_input_tokens: t.cache_creation_input_tokens,
    output_tokens: t.output_tokens,
    reasoning_output_tokens: t.reasoning_output_tokens,
    total_tokens: t.total_tokens,
    billable_total_tokens: billable(t),
    conversation_count: bucket.conversation_count,
  };
}

// Run every detected parser. Parsers accumulate deltas via `aggregate`, which
// maintains persistent CUMULATIVE per-bucket totals on cursors.buckets. After
// all parsers run, each bucket touched this run is enqueued with its full
// cumulative total (the backend upsert replaces the stored value).
async function runAll({ cursors, enqueue, config }) {
  if (!cursors.buckets || typeof cursors.buckets !== 'object') cursors.buckets = {};
  const buckets = cursors.buckets;
  const touched = new Set();

  function aggregate(source, model, timestamp, delta, convDelta) {
    let hourStart;
    try {
      hourStart = halfHourFloor(timestamp);
    } catch {
      return; // skip an event carrying an unparseable timestamp
    }
    const key = bucketKey(source, model, hourStart);
    let b = buckets[key];
    if (!b || typeof b !== 'object') {
      b = { source, model, hour_start: hourStart, totals: initTotals(), conversation_count: 0 };
      buckets[key] = b;
    }
    if (!b.totals || typeof b.totals !== 'object') b.totals = initTotals();
    addTotals(b.totals, delta);
    b.conversation_count = (Number(b.conversation_count) || 0) + (Number(convDelta) || 0);
    touched.add(key);
  }

  let parsersRun = 0;
  for (const parser of PARSERS) {
    let detected = false;
    try {
      detected = await parser.detect({ config });
    } catch {
      detected = false;
    }
    if (!detected) continue;
    parsersRun += 1;
    try {
      await parser.parse({ cursors, config, aggregate });
    } catch (e) {
      process.stderr.write(`tokenboard: parser ${parser.source} failed: ${e && e.message}\n`);
    }
  }

  let bucketsQueued = 0;
  for (const key of touched) {
    const b = buckets[key];
    if (!b) continue;
    enqueue(toQueueRow(b));
    bucketsQueued += 1;
  }

  return { parsersRun, bucketsQueued };
}

module.exports = { PARSERS, runAll, toQueueRow };

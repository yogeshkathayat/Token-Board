'use strict';

const source = 'cursor';

// Cursor exposes usage only through its authenticated remote API
// (cursor.com/api/usage). That requires a Cursor session token we do not have in
// this CLI, so the parser is wired but inert: detect() always returns false and
// runAll skips it. Do not flip detect() on without first implementing Cursor
// auth + the remote poll — see TokenTracker's parseCursorApiIncremental.
function detect() {
  return false;
}

// TODO: poll cursor.com usage API with a stored Cursor token and aggregate the
// returned per-model token counts into half-hour buckets.
async function parse() {
  /* intentionally inert — see detect() */
}

module.exports = { source, detect, parse };

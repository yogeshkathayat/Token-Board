'use strict';

const fs = require('fs');
const path = require('path');

const cursors = require('../lib/cursors.js');
const { BucketAggregator } = require('../lib/buckets.js');
const { paths } = require('../lib/paths.js');
const { timeoutMs } = require('../lib/http.js');
const secrets = require('../lib/secrets.js');

const SOURCE = 'openrouter';
const ENDPOINT = 'https://openrouter.ai/api/v1/generation';
const MAX_PAGES = 5;
const PAGE_LIMIT = 100;

async function detect() {
  return secrets.hasOpenRouterKey();
}

async function fetchPage(key, before) {
  const url = new URL(ENDPOINT);
  url.searchParams.set('limit', String(PAGE_LIMIT));
  if (before) url.searchParams.set('before_id', before);
  // Node's global fetch has no default timeout — without this, a stalled
  // connection to openrouter.ai would hang the entire sync indefinitely.
  const ms = timeoutMs();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    signal: ms > 0 ? AbortSignal.timeout(ms) : undefined,
  });
  if (res.status === 401 || res.status === 403) {
    const err = new Error('OpenRouter key rejected');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`OpenRouter HTTP ${res.status}`);
    err.code = 'HTTP_ERROR';
    throw err;
  }
  const json = await res.json();
  const items = Array.isArray(json?.data) ? json.data : [];
  return items;
}

async function parse() {
  const key = await secrets.getOpenRouterKey();
  if (!key) return [];

  const state = readCursor();
  const knownLast = state.lastGenerationId || null;

  // The API only pages backward (before_id). When the backlog since knownLast
  // exceeds MAX_PAGES*PAGE_LIMIT, we can't reach knownLast in one run. Rather
  // than jump the cursor to the newest id (which would silently skip every
  // un-fetched older generation), we page backward across runs:
  //   - resumeBeforeId: where to continue paging (oldest processed so far)
  //   - pendingNewestId: the newest id seen at the start of this catch-up,
  //     committed as the new knownLast only once we've fully caught up.
  let cursor = state.resumeBeforeId || null;
  let pendingNewestId = state.pendingNewestId || null;

  const agg = new BucketAggregator(state.hourly);
  let pages = 0;
  let caughtUp = false;

  outer: while (pages < MAX_PAGES) {
    let items;
    try {
      items = await fetchPage(key, cursor);
    } catch (err) {
      // Don't delete the stored key on a transient 401/403 — a temporary auth
      // blip would silently log the user out. Stop this run; detect() keeps the
      // parser enabled so it retries, and the error surfaces via the sync summary.
      throw err;
    }
    if (items.length === 0) {
      caughtUp = true;
      break;
    }

    for (const row of items) {
      if (!row?.id) continue;
      if (row.id === knownLast) {
        caughtUp = true;
        break outer; // reached the previous high-water mark
      }
      // The very first id we ever see in a catch-up sequence is the newest.
      if (!pendingNewestId) pendingNewestId = row.id;
      const ts = row.created_at || row.generation_at;
      if (ts) {
        const model = String(row.model || 'unknown');
        agg.add(SOURCE, model, ts, {
          input_tokens: row.tokens_prompt || row.native_tokens_prompt || 0,
          output_tokens: row.tokens_completion || row.native_tokens_completion || 0,
          cached_input_tokens: row.cache_discount_tokens || 0,
          reasoning_output_tokens: row.tokens_reasoning || 0,
        });
      }
      cursor = row.id; // oldest processed so far
    }

    pages += 1;
    if (items.length < PAGE_LIMIT) {
      caughtUp = true;
      break;
    }
  }

  if (caughtUp) {
    // Fully reached the previous marker (or exhausted history): commit the
    // newest id and clear the backlog markers.
    if (pendingNewestId) state.lastGenerationId = pendingNewestId;
    state.lastSeenAt = new Date().toISOString();
    delete state.resumeBeforeId;
    delete state.pendingNewestId;
  } else {
    // Hit the page cap mid-backlog: remember where to continue next run so we
    // make backward progress instead of dropping the un-fetched older window.
    state.resumeBeforeId = cursor;
    state.pendingNewestId = pendingNewestId;
  }
  state.hourly = agg.state();
  writeCursor(state);

  return agg.values();
}

function readCursor() {
  try {
    return JSON.parse(fs.readFileSync(paths().openrouterCursor, 'utf8'));
  } catch {
    return {};
  }
}

function writeCursor(state) {
  const dir = path.dirname(paths().openrouterCursor);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(paths().openrouterCursor, JSON.stringify(state, null, 2), { mode: 0o600 });
}

module.exports = { source: SOURCE, detect, parse };

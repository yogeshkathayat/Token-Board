'use strict';

const fs = require('fs');
const path = require('path');

const cursors = require('../lib/cursors.js');
const { BucketAggregator } = require('../lib/buckets.js');
const { paths } = require('../lib/paths.js');
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
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
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

  const agg = new BucketAggregator();
  let pages = 0;
  let cursor = null;
  let newestId = knownLast;
  let earliestSeenInPage = null;

  outer: while (pages < MAX_PAGES) {
    let items;
    try {
      items = await fetchPage(key, cursor);
    } catch (err) {
      if (err.code === 'UNAUTHORIZED') {
        // Disable for this device until user re-runs `openrouter login`.
        await secrets.deleteOpenRouterKey().catch(() => {});
      }
      break;
    }
    if (items.length === 0) break;

    for (const row of items) {
      if (!row?.id) continue;
      if (row.id === knownLast) break outer; // caught up
      if (!earliestSeenInPage) earliestSeenInPage = row.id;
      if (!newestId || (typeof row.created_at === 'string' && row.created_at > (state.lastSeenAt || ''))) {
        newestId = row.id;
      }
      const ts = row.created_at || row.generation_at;
      if (!ts) continue;
      const model = String(row.model || 'unknown');
      agg.add(SOURCE, model, ts, {
        input_tokens: row.tokens_prompt || row.native_tokens_prompt || 0,
        output_tokens: row.tokens_completion || row.native_tokens_completion || 0,
        cached_input_tokens: row.cache_discount_tokens || 0,
        reasoning_output_tokens: row.tokens_reasoning || 0,
      });
      cursor = row.id;
    }

    pages += 1;
    if (items.length < PAGE_LIMIT) break;
  }

  if (newestId) {
    state.lastGenerationId = newestId;
    state.lastSeenAt = new Date().toISOString();
    writeCursor(state);
  }

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

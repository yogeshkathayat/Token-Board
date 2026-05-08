'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const cursors = require('../lib/cursors.js');
const { BucketAggregator } = require('../lib/buckets.js');

const SOURCE = 'kiro';

/**
 * Kiro stores conversations in `~/Library/Application Support/kiro-cli/data.sqlite3`
 * (macOS) or `~/.config/kiro-cli/data.sqlite3` (Linux). The schema is:
 *
 *   conversations_v2(key, conversation_id, value, created_at, updated_at)
 *
 * `value` is a JSON blob shaped roughly like:
 *   {
 *     conversation_id: ...,
 *     model_info: { model_id, context_window_tokens, ... },
 *     history: [
 *       {
 *         user: { ... },
 *         assistant: { Response: ... },
 *         request_metadata: {
 *           request_id, message_id,
 *           request_start_timestamp_ms,
 *           stream_end_timestamp_ms,
 *           user_prompt_length,   // characters, not tokens
 *           response_size,        // bytes/chars
 *           model_id,
 *           ...
 *         }
 *       },
 *       ...
 *     ]
 *   }
 *
 * Kiro doesn't expose absolute token counts in the local DB, so we estimate
 * tokens from character lengths at ~4 chars/token (industry-standard
 * approximation for English+code). Buckets use the per-turn
 * `request_start_timestamp_ms` rounded to half-hour UTC boundaries.
 *
 * Incremental: we track seen `request_id`s so re-runs only emit new turns.
 */

const CHARS_PER_TOKEN = 4;

function dbCandidates() {
  const home = os.homedir();
  return [
    path.join(home, 'Library', 'Application Support', 'kiro-cli', 'data.sqlite3'),
    path.join(home, '.config', 'kiro-cli', 'data.sqlite3'),
  ];
}

function findDb() {
  for (const p of dbCandidates()) {
    try {
      if (fs.statSync(p).isFile()) return p;
    } catch {
      /* continue */
    }
  }
  return null;
}

async function detect() {
  return findDb() != null;
}

let Database;
function loadSqlite() {
  if (Database === undefined) {
    try {
      Database = require('better-sqlite3');
    } catch {
      Database = null;
    }
  }
  return Database;
}

function tokensFromChars(chars) {
  if (typeof chars !== 'number' || !Number.isFinite(chars) || chars <= 0) return 0;
  return Math.max(1, Math.round(chars / CHARS_PER_TOKEN));
}

async function parse() {
  const sqlite = loadSqlite();
  if (!sqlite) {
    if (process.env.TOKENBOARD_DEBUG) {
      process.stderr.write('[kiro] better-sqlite3 not installed; skipping\n');
    }
    return [];
  }
  const file = findDb();
  if (!file) return [];

  const state = cursors.get(SOURCE);
  state.seenRequests = state.seenRequests || {};
  state.lastUpdatedAt = state.lastUpdatedAt || 0;

  const db = new sqlite(file, { readonly: true });
  let rows = [];
  try {
    rows = db
      .prepare(
        `select conversation_id, value, created_at, updated_at
         from conversations_v2
         where updated_at > ?
         order by updated_at asc
         limit 500`,
      )
      .all(state.lastUpdatedAt);
  } catch (err) {
    if (process.env.TOKENBOARD_DEBUG) {
      process.stderr.write(`[kiro] query failed: ${err.message}\n`);
    }
    db.close();
    return [];
  }
  db.close();

  const agg = new BucketAggregator();
  const seenRequests = new Set(Object.keys(state.seenRequests));
  let maxUpdatedAt = state.lastUpdatedAt;

  for (const row of rows) {
    if (typeof row.updated_at === 'number' && row.updated_at > maxUpdatedAt) {
      maxUpdatedAt = row.updated_at;
    }
    let conv;
    try {
      conv = JSON.parse(row.value);
    } catch {
      continue;
    }
    const history = Array.isArray(conv?.history) ? conv.history : [];
    const fallbackModel = (conv?.model_info?.model_id || 'kiro-auto').toString();

    for (const turn of history) {
      const meta = turn?.request_metadata;
      if (!meta) continue;
      const reqId = meta.request_id || meta.message_id;
      if (!reqId) continue;
      if (seenRequests.has(reqId)) continue;
      seenRequests.add(reqId);

      const ts = meta.request_start_timestamp_ms;
      if (typeof ts !== 'number' || !Number.isFinite(ts)) continue;
      const isoTs = new Date(ts).toISOString();

      const promptChars = Number(meta.user_prompt_length) || 0;
      const responseChars = Number(meta.response_size) || 0;
      const inputTokens = tokensFromChars(promptChars);
      const outputTokens = tokensFromChars(responseChars);
      if (inputTokens + outputTokens === 0) continue;

      const model = (meta.model_id && String(meta.model_id)) || fallbackModel;
      agg.add(SOURCE, model, isoTs, {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      });
    }
  }

  // Cap seenRequests via FIFO so the cursor file stays small.
  const reqArr = Array.from(seenRequests);
  state.seenRequests = {};
  for (const id of reqArr.slice(-5000)) state.seenRequests[id] = 1;
  state.lastUpdatedAt = maxUpdatedAt;
  cursors.set(SOURCE, state);

  return agg.values();
}

module.exports = { source: SOURCE, detect, parse };

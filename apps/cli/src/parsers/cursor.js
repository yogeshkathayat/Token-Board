'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const cursors = require('../lib/cursors.js');
const { BucketAggregator } = require('../lib/buckets.js');

const SOURCE = 'cursor';

/**
 * Cursor stores per-request token counts on its servers, NOT locally. The
 * Stripe membership type and access token live in macOS Keychain
 * (`Cursor Safe Storage`) — encrypted, can't be read without prompting.
 *
 * What IS readable locally (from the global state.vscdb):
 *   - `cursorDiskKV.composerData:<uuid>` — one row per chat session, with
 *     `createdAt`, `modelConfig.modelName`. The `usageData` field is empty
 *     on the free tier.
 *   - `ItemTable.aiCodeTrackingLines` — JSON array of every AI-generated
 *     line of code, each tagged with the `composerId` that produced it.
 *     Capped at ~10,000 entries (FIFO eviction).
 *
 * Strategy: count lines per composer, multiply by a heuristic tokens-per-line
 * to estimate output tokens, and assign a small input-token estimate per
 * session. Bucket by the composer's `createdAt`. Mark the model with an
 * `:est` suffix so the dashboard shows clearly that these are estimates.
 *
 * If the user upgrades to Cursor Pro and we ever wire up the dashboard.cursor.com
 * API, this parser is the place to swap to exact counts.
 */

const STATE_DB_CANDIDATES = () => {
  const home = os.homedir();
  return [
    path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
    path.join(home, '.config', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
  ];
};

// Per-line heuristic. Real average for code is ~5–10 tokens/line of source,
// plus output overhead. We use 25 as a conservative-but-not-tiny number.
const TOKENS_PER_LINE = 25;
const INPUT_TOKENS_PER_LINE = 5;

async function detect() {
  for (const p of STATE_DB_CANDIDATES()) {
    try {
      if (fs.statSync(p).isFile()) return true;
    } catch {
      /* continue */
    }
  }
  return false;
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

function findStateDb() {
  for (const p of STATE_DB_CANDIDATES()) {
    try {
      if (fs.statSync(p).isFile()) return p;
    } catch {
      /* continue */
    }
  }
  return null;
}

async function parse() {
  const sqlite = loadSqlite();
  if (!sqlite) {
    if (process.env.TOKENBOARD_DEBUG) {
      process.stderr.write('[cursor] better-sqlite3 not installed; skipping\n');
    }
    return [];
  }
  const dbPath = findStateDb();
  if (!dbPath) return [];

  const dbMtime = (() => {
    try { return fs.statSync(dbPath).mtime.getTime(); } catch { return Date.now(); }
  })();

  const state = cursors.get(SOURCE);
  state.seenComposers = state.seenComposers || {};
  state.seenOrphanLineCount = state.seenOrphanLineCount || 0;

  const db = new sqlite(dbPath, { readonly: true });
  let composers = [];
  let trackingLinesRaw = '[]';
  let trackingStart = null;
  try {
    composers = db
      .prepare(`select key, value from cursorDiskKV where key like 'composerData:%'`)
      .all();
    const linesRow = db
      .prepare(`select value from ItemTable where key = 'aiCodeTrackingLines'`)
      .get();
    if (linesRow && typeof linesRow.value === 'string') trackingLinesRaw = linesRow.value;
    const startRow = db
      .prepare(`select value from ItemTable where key = 'aiCodeTrackingStartTime'`)
      .get();
    if (startRow && typeof startRow.value === 'string') {
      try {
        trackingStart = JSON.parse(startRow.value).timestamp;
      } catch { /* ignore */ }
    }
  } catch (err) {
    if (process.env.TOKENBOARD_DEBUG) {
      process.stderr.write(`[cursor] read failed: ${err.message}\n`);
    }
    db.close();
    return [];
  }
  db.close();

  // Map composerId → number of AI-generated lines.
  const linesPerComposer = new Map();
  try {
    const arr = JSON.parse(trackingLinesRaw);
    if (Array.isArray(arr)) {
      for (const entry of arr) {
        const cid = entry?.metadata?.composerId;
        if (typeof cid === 'string') {
          linesPerComposer.set(cid, (linesPerComposer.get(cid) ?? 0) + 1);
        }
      }
    }
  } catch {
    /* malformed — treat as no line data */
  }

  // Index composerData by id so we can detect orphans (line-tracked ids not in composerData).
  const composerById = new Map();
  for (const row of composers) {
    try {
      const cd = JSON.parse(row.value);
      if (cd?.composerId) composerById.set(cd.composerId, cd);
    } catch { /* ignore */ }
  }

  if (process.env.TOKENBOARD_DEBUG) {
    const orphanCount = [...linesPerComposer.keys()].filter((id) => !composerById.has(id)).length;
    process.stderr.write(
      `[cursor] composerData=${composers.length} lines_keyed_to_composers=${linesPerComposer.size} orphans=${orphanCount}\n`,
    );
  }

  const seen = new Set(Object.keys(state.seenComposers));
  const agg = new BucketAggregator();

  // Pass 1: composers with full metadata (createdAt + model). Best signal.
  for (const [composerId, cd] of composerById) {
    if (seen.has(composerId)) continue;
    const ts = cd?.createdAt;
    if (typeof ts !== 'number' || !Number.isFinite(ts)) continue;
    seen.add(composerId);

    const lines = linesPerComposer.get(composerId) ?? 0;
    if (lines === 0) continue;

    const model = (cd?.modelConfig?.modelName || 'cursor-unknown').toString();
    agg.add(SOURCE, `${model}:est`, new Date(ts).toISOString(), {
      input_tokens: lines * INPUT_TOKENS_PER_LINE,
      output_tokens: lines * TOKENS_PER_LINE,
    });
  }

  // Pass 2: orphan composers — their lines exist in the tracking buffer but
  // their composerData has been evicted. We don't know the per-composer
  // timestamp, but the lines did happen since `aiCodeTrackingStartTime`.
  // Best-effort: bucket all orphan lines as a single estimate at the DB's
  // mtime (rounded to half-hour), with model `cursor-historical`. The user
  // sees their historical Cursor activity, clearly labelled estimate.
  let orphanLines = 0;
  for (const [cid, lines] of linesPerComposer) {
    if (composerById.has(cid)) continue;
    if (seen.has(cid)) continue;
    seen.add(cid);
    orphanLines += lines;
  }
  // Subtract previously-attributed orphan lines so re-runs don't double-count.
  const newOrphanLines = Math.max(0, orphanLines - state.seenOrphanLineCount);
  if (newOrphanLines > 0) {
    agg.add(SOURCE, 'cursor-historical:est', new Date(dbMtime).toISOString(), {
      input_tokens: newOrphanLines * INPUT_TOKENS_PER_LINE,
      output_tokens: newOrphanLines * TOKENS_PER_LINE,
    });
    state.seenOrphanLineCount = orphanLines;
    if (process.env.TOKENBOARD_DEBUG) {
      process.stderr.write(`[cursor] emitted ${newOrphanLines} orphan lines @ ${new Date(dbMtime).toISOString()}\n`);
    }
  }

  void trackingStart; // reserved for future use

  // Cap seenComposers at 5000 most-recent UUIDs.
  const idArr = Array.from(seen);
  state.seenComposers = {};
  for (const id of idArr.slice(-5000)) state.seenComposers[id] = 1;
  cursors.set(SOURCE, state);

  return agg.values();
}

module.exports = { source: SOURCE, detect, parse };

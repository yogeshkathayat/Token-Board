'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const cursors = require('../lib/cursors.js');
const secrets = require('../lib/secrets.js');
const { BucketAggregator } = require('../lib/buckets.js');
const { timeoutMs } = require('../lib/http.js');

const SOURCE = 'cursor';

/**
 * Cursor exposes per-event usage at a private dashboard endpoint:
 *   https://cursor.com/api/dashboard/export-usage-events-csv?strategy=tokens
 *
 * The request needs a `WorkosCursorSessionToken` cookie. Recent Cursor
 * versions store the underlying JWT in macOS Keychain ("Cursor Safe
 * Storage") — encrypted, can't be read without prompting — so the CLI
 * doesn't try to extract it automatically. Instead the user runs
 * `tokenboard cursor login` once, pastes the cookie value (visible in
 * any browser that's signed in to cursor.com), and the parser uses it
 * for all future syncs.
 *
 * If no cookie is set, the parser falls back to the old line-count
 * estimate from local SQLite (very rough, sees only the last ~10K
 * lines of AI-generated code).
 */

const STATE_DB_CANDIDATES = () => {
  const home = os.homedir();
  return [
    path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
    path.join(home, '.config', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
  ];
};

const CSV_URL = 'https://cursor.com/api/dashboard/export-usage-events-csv?strategy=tokens';

// Heuristic for the no-cookie fallback path.
const TOKENS_PER_LINE_OUT = 25;
const TOKENS_PER_LINE_IN = 5;

async function detect() {
  if (await secrets.hasCursorCookie()) return true;
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

/**
 * Parse a CSV line accounting for quoted fields. Cursor's CSV is well-formed
 * and doesn't include embedded newlines inside quoted fields.
 */
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (inQuote) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (c === '"') {
        inQuote = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuote = true;
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function buildCookieHeader(stored) {
  // Accept either a bare value (`user_X%3A%3AeyJ…`) or a full
  // `WorkosCursorSessionToken=…` string. Normalise to a single
  // `Cookie:` header value.
  const v = stored.trim();
  if (v.startsWith('WorkosCursorSessionToken=')) return v;
  return `WorkosCursorSessionToken=${v}`;
}

async function fetchCursorCsv(cookie) {
  // Bound the request — Node's global fetch has no default timeout, so a
  // stalled connection to cursor.com would otherwise hang the whole sync.
  const ms = timeoutMs();
  const res = await fetch(CSV_URL, {
    headers: {
      Cookie: cookie,
      Accept: 'text/csv,*/*',
      Referer: 'https://www.cursor.com/settings',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    },
    redirect: 'follow',
    signal: ms > 0 ? AbortSignal.timeout(ms) : undefined,
  });
  if (res.status === 401 || res.status === 403) {
    const err = new Error('Cursor session expired — re-run `tokenboard cursor login`');
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`Cursor CSV HTTP ${res.status}`);
    err.code = 'HTTP_ERROR';
    throw err;
  }
  return res.text();
}

/**
 * Extract per-event buckets from Cursor's dashboard CSV. Schema (the
 * column names Cursor publishes — case-insensitive match):
 *   Date, User, Kind, Model, Max Mode, Tokens, Cost, ...
 * Plus richer columns when ?strategy=tokens, including per-bucket counts:
 *   Input (w/ Cache Write), Input (w/o Cache Write), Cache Read, Output
 */
function parseCursorCsv(csv, since) {
  const lines = csv.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]).map((s) => s.trim().toLowerCase());

  const idx = (...names) => {
    for (const n of names) {
      const i = header.indexOf(n.toLowerCase());
      if (i >= 0) return i;
    }
    return -1;
  };

  const iDate = idx('date', 'timestamp', 'created at', 'created_at');
  const iModel = idx('model');
  const iKind = idx('kind', 'event kind', 'event_kind');
  const iInput = idx('input (w/ cache write)', 'input', 'input tokens', 'input_tokens');
  const iInputNoCache = idx('input (w/o cache write)', 'input no cache write', 'input_no_cache_write');
  const iCacheRead = idx('cache read', 'cache_read', 'cache read tokens', 'cache_read_tokens');
  const iCacheWrite = idx('cache write', 'cache_write', 'cache write tokens', 'cache_write_tokens');
  const iOutput = idx('output', 'output tokens', 'output_tokens');
  const iTotal = idx('tokens', 'total tokens', 'total_tokens');

  if (iDate < 0 || iModel < 0) return [];

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 2) continue;

    const dateStr = cols[iDate]?.trim();
    if (!dateStr) continue;
    const ts = Date.parse(dateStr);
    if (!Number.isFinite(ts)) continue;
    if (since != null && ts <= since) continue;

    const kind = iKind >= 0 ? (cols[iKind] || '').trim().toLowerCase() : '';
    // Skip "Errored, Not Charged" and aborted events that have no real usage.
    if (kind.includes('errored') || kind.includes('aborted') || kind.includes('cancelled')) continue;

    const model = (cols[iModel] || 'cursor-unknown').trim() || 'cursor-unknown';

    const num = (i) => {
      if (i < 0) return 0;
      const raw = (cols[i] || '').replace(/[, "]/g, '');
      const n = Number.parseInt(raw, 10);
      return Number.isFinite(n) ? n : 0;
    };

    // Prefer the explicit per-bucket columns when present. The "Input
    // (w/ Cache Write)" column on Cursor's CSV includes cache-write
    // tokens; if it's there alongside a separate cache-write column,
    // subtract to get a cache-write-free input count.
    let input = num(iInputNoCache);
    if (input === 0 && iInput >= 0) {
      const inputWithCache = num(iInput);
      const cacheWrite = num(iCacheWrite);
      input = Math.max(0, inputWithCache - cacheWrite);
    }
    const output = num(iOutput);
    const cacheRead = num(iCacheRead);
    const cacheWrite = num(iCacheWrite);
    const total = num(iTotal);

    if (input + output + cacheRead + cacheWrite === 0 && total > 0) {
      // Fall back to the aggregated total when per-bucket columns are 0.
      // Treat the whole thing as output (worst case) so we don't
      // accidentally inflate cache reads.
      rows.push({ ts, model, input: 0, output: total, cacheRead: 0, cacheWrite: 0 });
    } else {
      rows.push({ ts, model, input, output, cacheRead, cacheWrite });
    }
  }
  return rows;
}

async function parseFromCsv() {
  const stored = await secrets.getCursorCookie();
  if (!stored) return null;

  const cookie = buildCookieHeader(stored);
  const state = cursors.get(SOURCE);
  state.lastCsvTs = state.lastCsvTs || 0;

  let csv;
  try {
    csv = await fetchCursorCsv(cookie);
  } catch (err) {
    if (err.code === 'UNAUTHORIZED') {
      // Bad cookie. Drop it so we don't keep hammering with the same value.
      await secrets.deleteCursorCookie().catch(() => {});
    }
    if (process.env.TOKENBOARD_DEBUG) {
      process.stderr.write(`[cursor] CSV fetch failed: ${err.message}\n`);
    }
    return null;
  }

  const rows = parseCursorCsv(csv, state.lastCsvTs);
  if (process.env.TOKENBOARD_DEBUG) {
    process.stderr.write(`[cursor] CSV: ${rows.length} new events since ${new Date(state.lastCsvTs).toISOString()}\n`);
  }

  const agg = new BucketAggregator(state.hourly);
  let maxTs = state.lastCsvTs;
  for (const r of rows) {
    if (r.ts > maxTs) maxTs = r.ts;
    agg.add(SOURCE, r.model, new Date(r.ts).toISOString(), {
      input_tokens: r.input,
      output_tokens: r.output,
      cached_input_tokens: r.cacheRead,
      cache_creation_input_tokens: r.cacheWrite,
    });
  }
  state.lastCsvTs = maxTs;
  state.hourly = agg.state();
  cursors.set(SOURCE, state);

  return agg.values();
}

async function parseFromLocalEstimate() {
  const sqlite = loadSqlite();
  if (!sqlite) {
    if (process.env.TOKENBOARD_DEBUG) {
      process.stderr.write('[cursor] better-sqlite3 not installed and no cookie set; skipping\n');
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
  let composerRows = [];
  let trackingLinesRaw = '[]';
  try {
    composerRows = db
      .prepare(`select key, value from cursorDiskKV where key like 'composerData:%'`)
      .all();
    const linesRow = db
      .prepare(`select value from ItemTable where key = 'aiCodeTrackingLines'`)
      .get();
    if (linesRow && typeof linesRow.value === 'string') trackingLinesRaw = linesRow.value;
  } catch (err) {
    if (process.env.TOKENBOARD_DEBUG) {
      process.stderr.write(`[cursor] estimate read failed: ${err.message}\n`);
    }
    db.close();
    return [];
  }
  db.close();

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
    /* malformed */
  }

  const composerById = new Map();
  for (const row of composerRows) {
    try {
      const cd = JSON.parse(row.value);
      if (cd?.composerId) composerById.set(cd.composerId, cd);
    } catch { /* ignore */ }
  }

  const seen = new Set(Object.keys(state.seenComposers));
  const agg = new BucketAggregator(state.hourly);

  for (const [composerId, cd] of composerById) {
    if (seen.has(composerId)) continue;
    const ts = cd?.createdAt;
    if (typeof ts !== 'number' || !Number.isFinite(ts)) continue;
    seen.add(composerId);
    const lines = linesPerComposer.get(composerId) ?? 0;
    if (lines === 0) continue;
    const model = (cd?.modelConfig?.modelName || 'cursor-unknown').toString();
    agg.add(SOURCE, `${model}:est`, new Date(ts).toISOString(), {
      input_tokens: lines * TOKENS_PER_LINE_IN,
      output_tokens: lines * TOKENS_PER_LINE_OUT,
    });
  }

  let orphanLines = 0;
  for (const [cid, lines] of linesPerComposer) {
    if (composerById.has(cid)) continue;
    if (seen.has(cid)) continue;
    seen.add(cid);
    orphanLines += lines;
  }
  const newOrphanLines = Math.max(0, orphanLines - state.seenOrphanLineCount);
  if (newOrphanLines > 0) {
    agg.add(SOURCE, 'cursor-historical:est', new Date(dbMtime).toISOString(), {
      input_tokens: newOrphanLines * TOKENS_PER_LINE_IN,
      output_tokens: newOrphanLines * TOKENS_PER_LINE_OUT,
    });
    state.seenOrphanLineCount = orphanLines;
  }

  const idArr = Array.from(seen);
  state.seenComposers = {};
  for (const id of idArr.slice(-5000)) state.seenComposers[id] = 1;
  state.hourly = agg.state();
  cursors.set(SOURCE, state);

  return agg.values();
}

async function parse() {
  // Preferred path: real per-event token counts from Cursor's CSV API.
  const csvBuckets = await parseFromCsv();
  if (csvBuckets !== null) return csvBuckets;

  // Fallback: rough estimates from local SQLite when no cookie is configured.
  return parseFromLocalEstimate();
}

module.exports = { source: SOURCE, detect, parse };

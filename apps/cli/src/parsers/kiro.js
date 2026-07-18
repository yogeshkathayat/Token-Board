'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const source = 'kiro';
const DEFAULT_MODEL = 'unknown';

// Kiro CLI records character lengths (user_prompt_length / response_size), NOT token counts,
// so token usage is ESTIMATED at ~4 chars/token (same heuristic the upstream tracker uses).
const CHARS_PER_TOKEN = 4;

// better-sqlite3 is an optional peer dep. If it can't be loaded, this parser is
// skipped entirely (detect() returns false) rather than crashing.
function loadSqlite() {
  try {
    return require('better-sqlite3');
  } catch {
    return null;
  }
}

// Kiro IDE (Continue-based) usage ledger.
function ideDbPath() {
  return path.join(
    os.homedir(),
    'Library',
    'Application Support',
    'Kiro',
    'User',
    'globalStorage',
    'kiro.kiroagent',
    'dev_data',
    'devdata.sqlite',
  );
}

// Kiro CLI conversation store (table conversations_v2).
function cliDbPath() {
  if (process.env.KIRO_CLI_DB_PATH) return process.env.KIRO_CLI_DB_PATH;
  return path.join(os.homedir(), 'Library', 'Application Support', 'kiro-cli', 'data.sqlite3');
}

function fileExists(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function detect() {
  if (!loadSqlite()) return false;
  return fileExists(ideDbPath()) || fileExists(cliDbPath());
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

// Estimate a Kiro-CLI turn's tokens from its request_metadata char lengths.
function estimateTurn(md) {
  return {
    input: Math.floor(toInt(md && md.user_prompt_length) / CHARS_PER_TOKEN),
    output: Math.floor(toInt(md && md.response_size) / CHARS_PER_TOKEN),
  };
}

function turnTimestampIso(md, turn, updatedAt) {
  const ms = Number(md && md.request_start_timestamp_ms);
  if (Number.isFinite(ms) && ms > 0) return new Date(ms).toISOString();
  const ut = turn && turn.user && turn.user.timestamp;
  if (ut != null) {
    const d = new Date(ut);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const u = Number(updatedAt);
  if (Number.isFinite(u) && u > 0) return new Date(u).toISOString();
  return null;
}

function makeDelta(input, output) {
  return {
    input_tokens: input,
    cached_input_tokens: 0,
    cache_creation_input_tokens: 0,
    output_tokens: output,
    reasoning_output_tokens: 0,
    total_tokens: input + output,
  };
}

// Kiro IDE: reads the tokens_generated table (real token counts) if present.
function parseIde(Database, cursors, aggregate) {
  if (!fileExists(ideDbPath())) return;
  const kiro = cursors.kiro && typeof cursors.kiro === 'object' ? cursors.kiro : {};
  const sinceId = toInt(kiro.lastId);
  let db;
  try {
    db = new Database(ideDbPath(), { readonly: true, fileMustExist: true });
  } catch {
    return;
  }
  try {
    const rows = db
      .prepare(
        'SELECT id, model, tokens_prompt, tokens_generated, timestamp FROM tokens_generated WHERE id > ? ORDER BY id ASC',
      )
      .all(sinceId);
    let maxId = sinceId;
    for (const row of rows) {
      const id = toInt(row.id);
      if (id > maxId) maxId = id;
      const input = toInt(row.tokens_prompt);
      const output = toInt(row.tokens_generated);
      if (input === 0 && output === 0) continue;
      const ts = row.timestamp ? new Date(row.timestamp).toISOString() : new Date().toISOString();
      aggregate(
        source,
        (typeof row.model === 'string' && row.model) || DEFAULT_MODEL,
        ts,
        makeDelta(input, output),
        1,
      );
    }
    cursors.kiro = { ...kiro, lastId: maxId };
  } catch {
    /* schema drift or locked DB */
  } finally {
    try {
      db.close();
    } catch {
      /* ignore */
    }
  }
}

// Kiro CLI: reads conversations_v2, estimating tokens per turn. Incremental via a
// per-conversation turn-count cursor (conversations only append turns).
function parseCli(Database, cursors, aggregate) {
  if (!fileExists(cliDbPath())) return;
  let db;
  try {
    db = new Database(cliDbPath(), { readonly: true, fileMustExist: true });
  } catch {
    return;
  }
  const state = cursors.kiroCli && typeof cursors.kiroCli === 'object' ? cursors.kiroCli : {};
  const convs = state.convs && typeof state.convs === 'object' ? { ...state.convs } : {};
  try {
    const rows = db.prepare('SELECT conversation_id, value, updated_at FROM conversations_v2').all();
    for (const row of rows) {
      let parsed;
      try {
        parsed = JSON.parse(row.value);
      } catch {
        continue;
      }
      const history = parsed && Array.isArray(parsed.history) ? parsed.history : [];
      const done = toInt(convs[row.conversation_id]);
      for (let i = done; i < history.length; i++) {
        const turn = history[i];
        const md = turn && turn.request_metadata;
        if (!md) continue;
        const { input, output } = estimateTurn(md);
        if (input === 0 && output === 0) continue;
        const ts = turnTimestampIso(md, turn, row.updated_at);
        if (!ts) continue;
        const model = (typeof md.model_id === 'string' && md.model_id) || DEFAULT_MODEL;
        aggregate(source, model, ts, makeDelta(input, output), 1);
      }
      convs[row.conversation_id] = history.length;
    }
    cursors.kiroCli = { convs };
  } catch {
    /* schema drift or locked DB */
  } finally {
    try {
      db.close();
    } catch {
      /* ignore */
    }
  }
}

async function parse({ cursors, aggregate }) {
  const Database = loadSqlite();
  if (!Database) return;
  parseIde(Database, cursors, aggregate);
  parseCli(Database, cursors, aggregate);
}

module.exports = { source, detect, parse, estimateTurn, turnTimestampIso };

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { userHome } = require('../lib/tracker-paths');

const source = 'opencode';
const DEFAULT_MODEL = 'unknown';

function loadSqlite() {
  try {
    return require('better-sqlite3');
  } catch {
    return null;
  }
}

function dataDir() {
  if (process.env.OPENCODE_HOME) return process.env.OPENCODE_HOME;
  if (process.env.XDG_DATA_HOME) return path.join(process.env.XDG_DATA_HOME, 'opencode');
  return path.join(userHome(), '.local', 'share', 'opencode');
}

function isOpencodeDbFilename(name) {
  if (!name.endsWith('.db')) return false;
  const stem = name.slice(0, -3);
  if (stem === 'opencode') return true;
  if (!stem.startsWith('opencode-')) return false;
  const channel = stem.slice('opencode-'.length);
  return channel.length > 0 && /^[A-Za-z0-9._-]+$/.test(channel);
}

function findDbPath() {
  if (process.env.OPENCODE_DB) {
    try {
      if (fs.statSync(process.env.OPENCODE_DB).isFile()) return process.env.OPENCODE_DB;
    } catch {
      return null;
    }
  }
  const dir = dataDir();
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  const match = entries.find((e) => e.isFile() && isOpencodeDbFilename(e.name));
  return match ? path.join(dir, match.name) : null;
}

function detect() {
  if (!loadSqlite()) return false;
  return Boolean(findDbPath());
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

async function parse({ cursors, aggregate }) {
  const Database = loadSqlite();
  if (!Database) return;
  const file = findDbPath();
  if (!file) return;

  const state = cursors.opencode && typeof cursors.opencode === 'object' ? cursors.opencode : {};
  const sinceTime = toInt(state.lastTimeUpdated);
  let db;
  try {
    db = new Database(file, { readonly: true, fileMustExist: true });
  } catch {
    return;
  }

  try {
    const rows = db
      .prepare(
        "SELECT id, time_updated, data FROM message WHERE json_extract(data, '$.role') = 'assistant' AND time_updated > ? ORDER BY time_updated ASC",
      )
      .all(sinceTime);
    let maxTime = sinceTime;
    for (const row of rows) {
      const t = toInt(row.time_updated);
      if (t > maxTime) maxTime = t;
      let data;
      try {
        data = JSON.parse(row.data);
      } catch {
        continue;
      }
      const tokens = data && data.tokens;
      if (!tokens || typeof tokens !== 'object') continue;
      const input = toInt(tokens.input);
      const output = toInt(tokens.output);
      const reasoning = toInt(tokens.reasoning);
      const cacheRead = toInt(tokens.cache && tokens.cache.read);
      const cacheWrite = toInt(tokens.cache && tokens.cache.write);
      if (input + output + reasoning + cacheRead + cacheWrite === 0) continue;
      const tsMs = t > 0 ? (t < 1e12 ? t * 1000 : t) : Date.now();
      const ts = new Date(tsMs).toISOString();
      const delta = {
        input_tokens: input,
        cached_input_tokens: cacheRead,
        cache_creation_input_tokens: cacheWrite,
        output_tokens: output,
        reasoning_output_tokens: reasoning,
        total_tokens: input + output + reasoning + cacheRead + cacheWrite,
      };
      const model =
        (typeof data.modelID === 'string' && data.modelID) ||
        (typeof data.model === 'string' && data.model) ||
        DEFAULT_MODEL;
      aggregate(source, model, ts, delta, 1);
    }
    cursors.opencode = { ...state, lastTimeUpdated: maxTime };
  } catch {
    /* best effort */
  } finally {
    try {
      db.close();
    } catch {
      /* ignore */
    }
  }
}

module.exports = { source, detect, parse };

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const cursors = require('../lib/cursors.js');
const { BucketAggregator } = require('../lib/buckets.js');

const SOURCE = 'opencode';

/**
 * OpenCode persists usage in a SQLite database. We read incrementally by
 * `id > lastRowId`. better-sqlite3 is an optional dep; if it's not present,
 * we silently skip OpenCode rather than failing the whole sync.
 */

function dbPath() {
  return path.join(os.homedir(), '.config', 'opencode', 'opencode.db');
}

async function detect() {
  try {
    return fs.statSync(dbPath()).isFile();
  } catch {
    return false;
  }
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

async function parse() {
  const sqlite = loadSqlite();
  if (!sqlite) {
    if (process.env.TOKENBOARD_DEBUG) {
      process.stderr.write('[opencode] better-sqlite3 not installed; skipping\n');
    }
    return [];
  }

  const state = cursors.get(SOURCE);
  state.lastRowId = state.lastRowId || 0;

  const db = new sqlite(dbPath(), { readonly: true, fileMustExist: true });
  let rows = [];
  try {
    rows = db
      .prepare(
        `select id, created_at, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens
         from usage where id > ? order by id asc limit 5000`,
      )
      .all(state.lastRowId);
  } catch {
    db.close();
    return [];
  }
  db.close();

  const agg = new BucketAggregator();
  let maxId = state.lastRowId;
  for (const r of rows) {
    if (r.id > maxId) maxId = r.id;
    if (!r.created_at) continue;
    agg.add(SOURCE, r.model || 'unknown', r.created_at, {
      input_tokens: r.input_tokens || 0,
      output_tokens: r.output_tokens || 0,
      cached_input_tokens: r.cache_read_tokens || 0,
      cache_creation_input_tokens: r.cache_write_tokens || 0,
    });
  }
  state.lastRowId = maxId;
  cursors.set(SOURCE, state);
  return agg.values();
}

module.exports = { source: SOURCE, detect, parse };

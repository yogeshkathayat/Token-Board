'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const source = 'kiro';
const DEFAULT_MODEL = 'unknown';

// better-sqlite3 is an optional peer dep. If it can't be loaded, this parser is
// skipped entirely (detect() returns false) rather than crashing.
function loadSqlite() {
  try {
    return require('better-sqlite3');
  } catch {
    return null;
  }
}

function dbPath() {
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

function detect() {
  if (!loadSqlite()) return false;
  try {
    return fs.statSync(dbPath()).isFile();
  } catch {
    return false;
  }
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

async function parse({ cursors, aggregate }) {
  const Database = loadSqlite();
  if (!Database) return;

  const kiro = cursors.kiro && typeof cursors.kiro === 'object' ? cursors.kiro : {};
  const sinceId = toInt(kiro.lastId);
  let db;
  try {
    db = new Database(dbPath(), { readonly: true, fileMustExist: true });
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
      const delta = {
        input_tokens: input,
        cached_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: output,
        reasoning_output_tokens: 0,
        total_tokens: input + output,
      };
      aggregate(source, (typeof row.model === 'string' && row.model) || DEFAULT_MODEL, ts, delta, 1);
    }
    cursors.kiro = { ...kiro, lastId: maxId };
  } catch {
    /* best effort — schema drift or locked DB */
  } finally {
    try {
      db.close();
    } catch {
      /* ignore */
    }
  }
}

module.exports = { source, detect, parse };

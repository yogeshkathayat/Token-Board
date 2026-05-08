'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const cursors = require('../lib/cursors.js');
const { BucketAggregator } = require('../lib/buckets.js');

const SOURCE = 'cursor';

/**
 * Cursor stores its login session in a local SQLite database. We read the
 * session token from there and call Cursor's usage CSV endpoint.
 *
 * This parser is best-effort: if we can't authenticate (paid account
 * required) or the schema changes, we silently skip.
 */

function authDbCandidates() {
  const home = os.homedir();
  return [
    path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
    path.join(home, '.config', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
  ];
}

async function detect() {
  return authDbCandidates().some((p) => {
    try {
      return fs.statSync(p).isFile();
    } catch {
      return false;
    }
  });
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

function readCursorAuth() {
  const sqlite = loadSqlite();
  if (!sqlite) return null;
  for (const file of authDbCandidates()) {
    try {
      if (!fs.statSync(file).isFile()) continue;
    } catch {
      continue;
    }
    const db = new sqlite(file, { readonly: true });
    try {
      const row = db.prepare("select value from ItemTable where key = 'cursorAuth/accessToken'").get();
      if (row && typeof row.value === 'string') return JSON.parse(row.value);
    } catch {
      /* schema drift */
    } finally {
      db.close();
    }
  }
  return null;
}

async function parse() {
  const auth = readCursorAuth();
  if (!auth) return [];

  // Cursor's per-day usage CSV endpoint requires a paid plan. The CLI
  // makes one HTTP request and parses the result. Errors are swallowed.
  const state = cursors.get(SOURCE);
  const lastDate = state.lastDate || '1970-01-01';

  let res;
  try {
    res = await fetch('https://www.cursor.com/api/usage', {
      headers: { Authorization: `Bearer ${auth}`, Accept: 'application/json' },
    });
    if (!res.ok) return [];
  } catch {
    return [];
  }
  let json;
  try {
    json = await res.json();
  } catch {
    return [];
  }

  const agg = new BucketAggregator();
  let newest = lastDate;
  for (const row of Array.isArray(json?.usage) ? json.usage : []) {
    if (!row?.date) continue;
    if (row.date < lastDate) continue;
    if (row.date > newest) newest = row.date;
    const ts = `${row.date}T12:00:00Z`;
    agg.add(SOURCE, row.model || 'cursor', ts, {
      input_tokens: row.input_tokens || 0,
      output_tokens: row.output_tokens || 0,
    });
  }
  state.lastDate = newest;
  cursors.set(SOURCE, state);
  return agg.values();
}

module.exports = { source: SOURCE, detect, parse };

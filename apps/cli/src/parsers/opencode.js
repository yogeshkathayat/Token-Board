'use strict';

// OpenCode stores each message as a JSON file under
// <data>/storage/message/<session>/<message>.json (it no longer uses SQLite).
// Assistant messages carry real token counts in `tokens`, so no better-sqlite3 needed.

const fs = require('node:fs');
const path = require('node:path');
const { userHome } = require('../lib/tracker-paths');

const source = 'opencode';
const DEFAULT_MODEL = 'unknown';

function dataDir() {
  if (process.env.OPENCODE_HOME) return process.env.OPENCODE_HOME;
  if (process.env.XDG_DATA_HOME) return path.join(process.env.XDG_DATA_HOME, 'opencode');
  return path.join(userHome(), '.local', 'share', 'opencode');
}

function messageDir() {
  return path.join(dataDir(), 'storage', 'message');
}

function detect() {
  try {
    return fs.statSync(messageDir()).isDirectory();
  } catch {
    return false;
  }
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

async function parse({ cursors, aggregate }) {
  const dir = messageDir();
  let sessions;
  try {
    sessions = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  const state = cursors.opencode && typeof cursors.opencode === 'object' ? cursors.opencode : {};
  const lastCompleted = toInt(state.lastCompleted);
  let maxCompleted = lastCompleted;

  for (const ses of sessions) {
    if (!ses.isDirectory()) continue;
    const sdir = path.join(dir, ses.name);
    let files;
    try {
      files = fs.readdirSync(sdir);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      let data;
      try {
        data = JSON.parse(fs.readFileSync(path.join(sdir, f), 'utf8'));
      } catch {
        continue;
      }
      if (!data || data.role !== 'assistant') continue;
      const completed = toInt(data.time && data.time.completed);
      if (completed === 0) continue; // message still streaming — count it once finished
      if (completed <= lastCompleted) continue; // already counted on a previous run
      if (completed > maxCompleted) maxCompleted = completed;

      const tokens = data.tokens;
      if (!tokens || typeof tokens !== 'object') continue;
      const input = toInt(tokens.input);
      const output = toInt(tokens.output);
      const reasoning = toInt(tokens.reasoning);
      const cacheRead = toInt(tokens.cache && tokens.cache.read);
      const cacheWrite = toInt(tokens.cache && tokens.cache.write);
      const total = input + output + reasoning + cacheRead + cacheWrite;
      if (total === 0) continue;

      const model = (typeof data.modelID === 'string' && data.modelID) || DEFAULT_MODEL;
      aggregate(
        source,
        model,
        new Date(completed).toISOString(),
        {
          input_tokens: input,
          cached_input_tokens: cacheRead,
          cache_creation_input_tokens: cacheWrite,
          output_tokens: output,
          reasoning_output_tokens: reasoning,
          total_tokens: total,
        },
        1,
      );
    }
  }

  cursors.opencode = { ...state, lastCompleted: maxCompleted };
}

module.exports = { source, detect, parse };

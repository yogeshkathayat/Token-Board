'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const cursors = require('../lib/cursors.js');
const { BucketAggregator } = require('../lib/buckets.js');

const SOURCE = 'gemini';

/**
 * Gemini CLI writes JSON (not JSONL) session files to
 * ~/.gemini/tmp/<id>/chats/session-<uuid>.json. Each session contains a
 * `messages` array; the trailing message has cumulative token counts.
 */

function tmpDir() {
  return path.join(os.homedir(), '.gemini', 'tmp');
}

async function detect() {
  try {
    return fs.statSync(tmpDir()).isDirectory();
  } catch {
    return false;
  }
}

function* walkSessions(rootDir) {
  let entries;
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const chats = path.join(rootDir, e.name, 'chats');
    let chatEntries;
    try {
      chatEntries = fs.readdirSync(chats, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const c of chatEntries) {
      if (c.isFile() && c.name.startsWith('session-') && c.name.endsWith('.json')) {
        yield path.join(chats, c.name);
      }
    }
  }
}

async function parse() {
  const state = cursors.get(SOURCE);
  state.files = state.files || {};
  const agg = new BucketAggregator(state.hourly);

  for (const file of walkSessions(tmpDir())) {
    let stat;
    try {
      stat = fs.statSync(file);
    } catch {
      continue;
    }
    const prev = state.files[file];
    if (prev && prev.mtime === stat.mtimeMs && prev.size === stat.size) continue;

    let raw;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      continue;
    }

    const model = json?.model || 'gemini-unknown';
    const ts = json?.updated_at || json?.created_at || stat.mtime.toISOString();
    const total = json?.total_token_usage || json?.totals;
    if (!total) {
      state.files[file] = { mtime: stat.mtimeMs, size: stat.size, last: 0 };
      continue;
    }
    const newTotal = (total.input_tokens || 0) + (total.output_tokens || 0);
    const last = prev?.last || 0;
    const diff = newTotal - last;
    if (diff > 0) {
      const delta = {
        input_tokens: Math.max(0, (total.input_tokens || 0) - (prev?.input || 0)),
        output_tokens: Math.max(0, (total.output_tokens || 0) - (prev?.output || 0)),
        cached_input_tokens: Math.max(0, (total.cached_input_tokens || 0) - (prev?.cached || 0)),
        reasoning_output_tokens: 0,
      };
      agg.add(SOURCE, model, ts, delta);
    }
    state.files[file] = {
      mtime: stat.mtimeMs,
      size: stat.size,
      last: newTotal,
      input: total.input_tokens || 0,
      output: total.output_tokens || 0,
      cached: total.cached_input_tokens || 0,
    };
  }

  state.hourly = agg.state();
  cursors.set(SOURCE, state);
  return agg.values();
}

module.exports = { source: SOURCE, detect, parse };

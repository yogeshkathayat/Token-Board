'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const cursors = require('../lib/cursors.js');
const { BucketAggregator } = require('../lib/buckets.js');

const SOURCE = 'claude';

/**
 * Claude Code stores per-project history under ~/.claude/projects/.../*.jsonl.
 * Each line is a JSON event; events with `usage` carry token counts. We
 * dedupe by event uuid across files (Claude's history can be split across
 * multiple files for the same conversation).
 */

function projectsDir() {
  return path.join(os.homedir(), '.claude', 'projects');
}

async function detect() {
  try {
    return fs.statSync(projectsDir()).isDirectory();
  } catch {
    return false;
  }
}

function* walkJsonl(rootDir) {
  const stack = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        yield full;
      }
    }
  }
}

function pickModel(event) {
  return (
    event?.message?.model ||
    event?.model ||
    event?.usage?.model ||
    'unknown'
  );
}

function pickTimestamp(event) {
  return (
    event?.timestamp ||
    event?.message?.timestamp ||
    event?.created_at ||
    null
  );
}

function pickUsage(event) {
  const u = event?.message?.usage || event?.usage;
  if (!u) return null;
  return {
    input_tokens: u.input_tokens || 0,
    output_tokens: u.output_tokens || 0,
    cached_input_tokens: u.cache_read_input_tokens || u.cached_input_tokens || 0,
    cache_creation_input_tokens: u.cache_creation_input_tokens || 0,
    reasoning_output_tokens: u.reasoning_output_tokens || 0,
  };
}

async function parse() {
  const dir = projectsDir();
  const state = cursors.get(SOURCE);
  state.files = state.files || {};
  state.seenIds = state.seenIds || {}; // recent uuid -> 1 (capped)

  const agg = new BucketAggregator();
  let convCount = 0;
  const seenIds = new Set(Object.keys(state.seenIds));

  for (const file of walkJsonl(dir)) {
    let stat;
    try {
      stat = fs.statSync(file);
    } catch {
      continue;
    }

    let prev = state.files[file];
    if (!prev || prev.inode !== stat.ino || prev.size > stat.size) {
      // New file or rotated/truncated — start at offset 0.
      prev = { inode: stat.ino, offset: 0, size: 0 };
    }
    if (stat.size <= prev.offset) {
      state.files[file] = prev;
      continue;
    }

    const fd = fs.openSync(file, 'r');
    try {
      const len = stat.size - prev.offset;
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, prev.offset);
      const text = buf.toString('utf8');
      const lastNl = text.lastIndexOf('\n');
      const usable = lastNl >= 0 ? text.slice(0, lastNl) : text;
      const consumed = lastNl >= 0 ? lastNl + 1 : 0;

      for (const line of usable.split('\n')) {
        if (!line) continue;
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }
        const uuid = event?.uuid || event?.id || event?.message?.id;
        if (uuid && seenIds.has(uuid)) continue;
        if (uuid) seenIds.add(uuid);

        // Count user-typed turns regardless of whether the event carries
        // usage — user messages typically don't (the assistant's reply does).
        if (event?.role === 'user' || event?.message?.role === 'user') {
          convCount += 1;
        }

        const ts = pickTimestamp(event);
        const usage = pickUsage(event);
        if (!ts || !usage) continue;

        agg.add(SOURCE, pickModel(event), ts, usage);
      }

      state.files[file] = {
        inode: stat.ino,
        offset: prev.offset + consumed,
        size: stat.size,
      };
    } finally {
      fs.closeSync(fd);
    }
  }

  // Cap seenIds to ~5000 most recent to bound state size.
  const idArr = Array.from(seenIds);
  state.seenIds = {};
  for (const id of idArr.slice(-5000)) state.seenIds[id] = 1;
  cursors.set(SOURCE, state);

  const out = agg.values();
  if (out.length > 0 && convCount > 0) {
    // Distribute conversations to the latest bucket of each model.
    out.sort((a, b) => (a.hour_start < b.hour_start ? -1 : 1));
    out[out.length - 1].conversation_count = convCount;
  }
  return out;
}

module.exports = { source: SOURCE, detect, parse };

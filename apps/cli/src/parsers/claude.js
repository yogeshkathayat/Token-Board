'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const cursors = require('../lib/cursors.js');
const { halfHourFloor, emptyBucket, addToBucket } = require('../lib/buckets.js');

const SOURCE = 'claude';

/**
 * Claude Code stores per-project history under ~/.claude/projects/.../*.jsonl.
 * Each line is a JSON event; events with `usage` carry token counts.
 *
 * Dedup key: `message.id + ":" + requestId`. This identifies a single billed
 * Anthropic API call. The same call is logged into multiple jsonl files
 * (sidechain, /subagents/, resumed sessions) with the *same* message.id and
 * requestId but different per-event `uuid` values, so deduping by `uuid`
 * undercounts duplicates and inflates totals. We fall back to `uuid` only
 * when those fields are absent (legacy logs).
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

const SEEN_HASH_CAP = 100_000;

// Why cumulative state? The API upserts buckets with REPLACE semantics
// (excluded.input_tokens overwrites the existing row). If we only emit
// the delta from this parse run, an incremental sync clobbers the
// previously-uploaded full-hour bucket with just the new slice. So we
// persist the running totals per (model, hour_start) in cursor state,
// mutate them as new events arrive, and emit the full cumulative value
// of any bucket touched this run — matching TokenTracker's design.

function bucketKey(model, hourStart) {
  return `${model || 'unknown'}|${hourStart}`;
}

function loadHourlyState(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw)) {
    if (!v || typeof v !== 'object') continue;
    out[k] = {
      hour_start: String(v.hour_start || ''),
      source: SOURCE,
      model: String(v.model || 'unknown'),
      input_tokens: Number(v.input_tokens || 0),
      cached_input_tokens: Number(v.cached_input_tokens || 0),
      cache_creation_input_tokens: Number(v.cache_creation_input_tokens || 0),
      output_tokens: Number(v.output_tokens || 0),
      reasoning_output_tokens: Number(v.reasoning_output_tokens || 0),
      total_tokens: Number(v.total_tokens || 0),
      conversation_count: Number(v.conversation_count || 0),
    };
  }
  return out;
}

async function parse() {
  const dir = projectsDir();
  const state = cursors.get(SOURCE);
  state.files = state.files || {};
  state.seenHashes = state.seenHashes || {};
  const hourly = loadHourlyState(state.hourly);
  const touched = new Set();
  let convCount = 0;
  const seenHashes = new Set(Object.keys(state.seenHashes));

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

        // Count user-typed turns regardless of whether the event carries
        // usage — user messages typically don't (the assistant's reply does).
        if (event?.role === 'user' || event?.message?.role === 'user') {
          convCount += 1;
        }

        const ts = pickTimestamp(event);
        const usage = pickUsage(event);
        if (!ts || !usage) continue;

        // Skip all-zero usage events (Claude logs them on user/tool_result turns).
        if (
          usage.input_tokens === 0 &&
          usage.cached_input_tokens === 0 &&
          usage.cache_creation_input_tokens === 0 &&
          usage.output_tokens === 0 &&
          usage.reasoning_output_tokens === 0
        ) {
          continue;
        }

        // The billable identity of an assistant message: message.id + requestId.
        // Claude logs the same call into multiple jsonl files (sidechain,
        // /subagents/, resumed sessions) — same msg.id + requestId, different
        // per-event uuid. Falling back to uuid keeps legacy events working.
        const msgId = event?.message?.id;
        const reqId = event?.requestId;
        const hash =
          msgId && reqId
            ? `${msgId}:${reqId}`
            : event?.uuid || event?.id || event?.message?.id || null;
        if (hash) {
          if (seenHashes.has(hash)) continue;
          seenHashes.add(hash);
        }

        const model = pickModel(event);
        const hourStart = halfHourFloor(ts);
        const key = bucketKey(model, hourStart);
        if (!hourly[key]) hourly[key] = emptyBucket(SOURCE, model, hourStart);
        addToBucket(hourly[key], usage);
        touched.add(key);
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

  // Persist dedup hashes across runs. Cap to bound state size; new entries
  // are appended to the end of seenHashes during this run, so slicing the
  // tail keeps the most-recently-observed messages.
  const hashArr = Array.from(seenHashes);
  state.seenHashes = {};
  for (const h of hashArr.slice(-SEEN_HASH_CAP)) state.seenHashes[h] = 1;
  // Clear the legacy field so we don't carry a stale 5k-entry uuid set.
  if (state.seenIds) delete state.seenIds;

  // Emit only buckets touched this run, with their FULL cumulative value.
  const out = [];
  const touchedKeys = Array.from(touched).sort((a, b) =>
    hourly[a].hour_start < hourly[b].hour_start ? -1 : 1,
  );
  for (const k of touchedKeys) {
    const b = hourly[k];
    if (b.total_tokens > 0 || b.conversation_count > 0) out.push({ ...b });
  }
  if (out.length > 0 && convCount > 0) {
    // Attribute this run's conversations to the latest touched bucket. ADD to
    // the persisted cumulative (don't overwrite) and emit the cumulative value,
    // so the API's REPLACE upsert doesn't clobber earlier runs' counts.
    const lastKey = touchedKeys[touchedKeys.length - 1];
    hourly[lastKey].conversation_count = (hourly[lastKey].conversation_count || 0) + convCount;
    out[out.length - 1].conversation_count = hourly[lastKey].conversation_count;
  }

  state.hourly = hourly;
  cursors.set(SOURCE, state);
  return out;
}

module.exports = { source: SOURCE, detect, parse };

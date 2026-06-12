'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const cursors = require('../lib/cursors.js');
const { BucketAggregator } = require('../lib/buckets.js');

const SOURCE = 'codex';

/**
 * Codex CLI writes rollout JSONL files to ~/.codex/sessions/YYYY/MM/DD/.
 * Each line is an event; tokens-count lines carry `total_token_usage` and
 * `last_token_usage`. We dedupe by total counter (skip lines that didn't
 * advance the totals).
 */

function sessionsDir() {
  return path.join(os.homedir(), '.codex', 'sessions');
}

async function detect() {
  try {
    return fs.statSync(sessionsDir()).isDirectory();
  } catch {
    return false;
  }
}

function* walk(rootDir) {
  const stack = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && e.name.startsWith('rollout-') && e.name.endsWith('.jsonl')) yield full;
    }
  }
}

function asNum(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

async function parse() {
  const state = cursors.get(SOURCE);
  state.files = state.files || {};
  const agg = new BucketAggregator(state.hourly);

  for (const file of walk(sessionsDir())) {
    let stat;
    try {
      stat = fs.statSync(file);
    } catch {
      continue;
    }
    let prev = state.files[file];
    if (!prev || prev.inode !== stat.ino || prev.size > stat.size) {
      prev = {
        inode: stat.ino,
        offset: 0,
        size: 0,
        lastTotal: 0,
        lastModel: null,
        lastInput: 0,
        lastOutput: 0,
        lastCached: 0,
        lastReasoning: 0,
      };
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

      let lastTotal = prev.lastTotal || 0;
      let lastModel = prev.lastModel || null;
      let lastInput = prev.lastInput || 0;
      let lastOutput = prev.lastOutput || 0;
      let lastCached = prev.lastCached || 0;
      let lastReasoning = prev.lastReasoning || 0;

      for (const line of usable.split('\n')) {
        if (!line) continue;
        let ev;
        try {
          ev = JSON.parse(line);
        } catch {
          continue;
        }
        if (ev?.type === 'session_meta' || ev?.type === 'session_start') {
          if (typeof ev.model === 'string') lastModel = ev.model;
        }
        const u = ev?.total_token_usage || ev?.usage?.total || ev?.total_usage;
        const last = ev?.last_token_usage || ev?.usage?.last || ev?.last_usage;
        const ts = ev?.timestamp || ev?.time || ev?.created_at;
        if (!ts) continue;

        let delta = null;
        if (last && typeof last === 'object') {
          delta = {
            input_tokens: asNum(last.input_tokens),
            cached_input_tokens: asNum(last.cached_input_tokens),
            output_tokens: asNum(last.output_tokens),
            reasoning_output_tokens: asNum(last.reasoning_output_tokens),
          };
        } else if (u && typeof u === 'object') {
          // `total_token_usage` is cumulative per session/file. Emit the delta
          // against the last cumulative reading we persisted for THIS file, not
          // the raw total — otherwise every line re-emits the full running sum.
          const curInput = asNum(u.input_tokens);
          const curOutput = asNum(u.output_tokens);
          const curCached = asNum(u.cached_input_tokens);
          const curReasoning = asNum(u.reasoning_output_tokens);
          const total = curInput + curOutput;
          if (total <= lastTotal) continue;
          delta = {
            input_tokens: Math.max(0, curInput - lastInput),
            cached_input_tokens: Math.max(0, curCached - lastCached),
            output_tokens: Math.max(0, curOutput - lastOutput),
            reasoning_output_tokens: Math.max(0, curReasoning - lastReasoning),
          };
          lastTotal = total;
          lastInput = curInput;
          lastOutput = curOutput;
          lastCached = curCached;
          lastReasoning = curReasoning;
        }
        if (!delta) continue;
        const dtotal =
          delta.input_tokens + delta.output_tokens + delta.reasoning_output_tokens + delta.cached_input_tokens;
        if (dtotal <= 0) continue;
        agg.add(SOURCE, lastModel || 'unknown', ts, delta);
      }

      state.files[file] = {
        inode: stat.ino,
        offset: prev.offset + consumed,
        size: stat.size,
        lastTotal,
        lastModel,
        lastInput,
        lastOutput,
        lastCached,
        lastReasoning,
      };
    } finally {
      fs.closeSync(fd);
    }
  }

  state.hourly = agg.state();
  cursors.set(SOURCE, state);
  return agg.values();
}

module.exports = { source: SOURCE, detect, parse };

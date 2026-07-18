'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { userHome } = require('../lib/tracker-paths');
const { readNewLines } = require('../lib/filetail');

const source = 'codex';
const DEFAULT_MODEL = 'unknown';

const USAGE_KEYS = [
  'input_tokens',
  'cached_input_tokens',
  'cache_creation_input_tokens',
  'output_tokens',
  'reasoning_output_tokens',
  'total_tokens',
];

function sessionsDir() {
  return path.join(process.env.CODEX_HOME || path.join(userHome(), '.codex'), 'sessions');
}

function detect() {
  try {
    return fs.statSync(sessionsDir()).isDirectory();
  } catch {
    return false;
  }
}

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.jsonl')) out.push(full);
  }
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function extractTokenCount(obj) {
  const payload = obj && obj.payload;
  if (!payload) return null;
  if (payload.type === 'token_count') return { info: payload.info, timestamp: obj.timestamp || null };
  const msg = payload.msg;
  if (msg && msg.type === 'token_count') return { info: msg.info, timestamp: obj.timestamp || null };
  return null;
}

function isNonEmptyObject(v) {
  return Boolean(v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0);
}

function isAllZero(u) {
  for (const k of USAGE_KEYS) if (toInt(u[k]) !== 0) return false;
  return true;
}

// Codex reports input_tokens as the TOTAL prompt with cached_input_tokens as the
// cached subset. Our schema stores input_tokens as pure non-cached input, so we
// subtract the cached slice (mirrors the reference; prevents ~6-7x cost
// inflation on cache-heavy sessions).
function normalizeUsage(u) {
  const out = {};
  for (const k of USAGE_KEYS) out[k] = toInt(u[k]);
  out.input_tokens = Math.max(0, out.input_tokens - out.cached_input_tokens);
  return out;
}

// Cumulative token usage: prefer the running total delta against the previous
// snapshot; fall back to the per-turn last_token_usage.
function pickDelta(lastUsage, totalUsage, prevTotals) {
  const hasLast = isNonEmptyObject(lastUsage);
  const hasTotal = isNonEmptyObject(totalUsage);
  const hasPrev = isNonEmptyObject(prevTotals);

  if (hasTotal && hasPrev) {
    const reset = toInt(totalUsage.total_tokens) < toInt(prevTotals.total_tokens);
    if (reset) {
      const n = normalizeUsage(hasLast ? lastUsage : totalUsage);
      return isAllZero(n) ? null : n;
    }
    const delta = {};
    for (const k of USAGE_KEYS) delta[k] = Math.max(0, toInt(totalUsage[k]) - toInt(prevTotals[k]));
    const n = normalizeUsage(delta);
    return isAllZero(n) ? null : n;
  }
  if (hasTotal) {
    const n = normalizeUsage(totalUsage);
    return isAllZero(n) ? null : n;
  }
  if (hasLast) {
    const n = normalizeUsage(lastUsage);
    return isAllZero(n) ? null : n;
  }
  return null;
}

async function parse({ cursors, aggregate }) {
  const files = [];
  walk(sessionsDir(), files);
  files.sort();
  if (!cursors.files || typeof cursors.files !== 'object') cursors.files = {};

  for (const filePath of files) {
    const prev = cursors.files[filePath] || null;
    const result = readNewLines(filePath, prev);
    if (!result) continue;

    let model = prev && typeof prev.lastModel === 'string' ? prev.lastModel : null;
    let totals = prev && prev.lastTotals && typeof prev.lastTotals === 'object' ? prev.lastTotals : null;

    for (const line of result.lines) {
      const maybeToken = line.includes('"token_count"');
      const maybeCtx =
        !maybeToken &&
        (line.includes('"turn_context"') || line.includes('"session_meta"')) &&
        line.includes('"model"');
      if (!maybeToken && !maybeCtx) continue;

      let obj;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }

      if ((obj.type === 'turn_context' || obj.type === 'session_meta') && isNonEmptyObject(obj.payload)) {
        if (typeof obj.payload.model === 'string' && obj.payload.model.trim()) model = obj.payload.model;
        continue;
      }

      const token = extractTokenCount(obj);
      if (!token || !isNonEmptyObject(token.info)) continue;
      const ts = typeof token.timestamp === 'string' ? token.timestamp : null;
      if (!ts) continue;

      const delta = pickDelta(token.info.last_token_usage, token.info.total_token_usage, totals);
      if (isNonEmptyObject(token.info.total_token_usage)) totals = token.info.total_token_usage;
      if (!delta) continue;

      aggregate(source, model || DEFAULT_MODEL, ts, delta, 1);
    }

    cursors.files[filePath] = {
      inode: result.cursor.inode,
      offset: result.cursor.offset,
      lastModel: model,
      lastTotals: totals,
    };
  }
}

module.exports = { source, detect, parse };

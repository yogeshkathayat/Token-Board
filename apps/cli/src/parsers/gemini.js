'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { userHome } = require('../lib/tracker-paths');

const source = 'gemini';
const DEFAULT_MODEL = 'unknown';

function tmpDir() {
  return path.join(process.env.GEMINI_HOME || path.join(userHome(), '.gemini'), 'tmp');
}

function detect() {
  try {
    return fs.statSync(tmpDir()).isDirectory();
  } catch {
    return false;
  }
}

// Gemini session files: ~/.gemini/tmp/<hash>/chats/session-*.json
function listSessions() {
  const out = [];
  let roots;
  try {
    roots = fs.readdirSync(tmpDir(), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const root of roots) {
    if (!root.isDirectory()) continue;
    const chatsDir = path.join(tmpDir(), root.name, 'chats');
    let chats;
    try {
      chats = fs.readdirSync(chatsDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of chats) {
      if (entry.isFile() && entry.name.startsWith('session-') && entry.name.endsWith('.json')) {
        out.push(path.join(chatsDir, entry.name));
      }
    }
  }
  out.sort();
  return out;
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

// Gemini reports cumulative totals per message. Convert to our schema.
function normalizeTokens(tokens) {
  if (!tokens || typeof tokens !== 'object') return null;
  const input = toInt(tokens.input);
  const cached = toInt(tokens.cached);
  const output = toInt(tokens.output);
  const tool = toInt(tokens.tool);
  const thoughts = toInt(tokens.thoughts);
  const computed = input + cached + output + tool + thoughts;
  return {
    input_tokens: input,
    cached_input_tokens: cached,
    cache_creation_input_tokens: 0,
    output_tokens: output + tool,
    reasoning_output_tokens: thoughts,
    total_tokens: Math.max(toInt(tokens.total), computed),
  };
}

function same(a, b) {
  return (
    a.input_tokens === b.input_tokens &&
    a.cached_input_tokens === b.cached_input_tokens &&
    a.output_tokens === b.output_tokens &&
    a.reasoning_output_tokens === b.reasoning_output_tokens &&
    a.total_tokens === b.total_tokens
  );
}

function diff(current, previous) {
  if (!previous) return current;
  if (same(current, previous)) return null;
  if (current.total_tokens < previous.total_tokens) return current; // reset
  const d = {
    input_tokens: Math.max(0, current.input_tokens - previous.input_tokens),
    cached_input_tokens: Math.max(0, current.cached_input_tokens - previous.cached_input_tokens),
    cache_creation_input_tokens: 0,
    output_tokens: Math.max(0, current.output_tokens - previous.output_tokens),
    reasoning_output_tokens: Math.max(0, current.reasoning_output_tokens - previous.reasoning_output_tokens),
    total_tokens: Math.max(0, current.total_tokens - previous.total_tokens),
  };
  if (d.input_tokens + d.cached_input_tokens + d.output_tokens + d.reasoning_output_tokens === 0) return null;
  return d;
}

async function parse({ cursors, aggregate }) {
  const files = listSessions();
  if (!cursors.files || typeof cursors.files !== 'object') cursors.files = {};

  for (const filePath of files) {
    let st;
    try {
      st = fs.statSync(filePath);
    } catch {
      continue;
    }
    const inode = st.ino || 0;
    const prev = cursors.files[filePath] || null;
    const sameInode = prev && prev.inode === inode;
    let lastIndex = sameInode && Number.isFinite(prev.lastIndex) ? prev.lastIndex : -1;
    let lastTotals = sameInode && prev.lastTotals ? prev.lastTotals : null;
    let model = sameInode && typeof prev.lastModel === 'string' ? prev.lastModel : null;

    let session;
    try {
      session = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      continue;
    }
    const messages = Array.isArray(session && session.messages) ? session.messages : [];
    if (lastIndex >= messages.length) {
      lastIndex = -1;
      lastTotals = null;
    }

    for (let i = lastIndex + 1; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg || typeof msg !== 'object') continue;
      if (typeof msg.model === 'string' && msg.model.trim()) model = msg.model;
      const ts = typeof msg.timestamp === 'string' ? msg.timestamp : null;
      const current = normalizeTokens(msg.tokens);
      if (!ts || !current) continue;
      const delta = diff(current, lastTotals);
      lastTotals = current;
      if (!delta) continue;
      aggregate(source, model || DEFAULT_MODEL, ts, delta, 1);
    }

    cursors.files[filePath] = {
      inode,
      lastIndex: messages.length - 1,
      lastTotals,
      lastModel: model,
    };
  }
}

module.exports = { source, detect, parse };

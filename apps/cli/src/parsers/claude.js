'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { userHome } = require('../lib/tracker-paths');
const { readNewLines } = require('../lib/filetail');

const source = 'claude';
const DEFAULT_MODEL = 'unknown';
const MAX_HASHES = 100_000;

function projectsDir() {
  return path.join(userHome(), '.claude', 'projects');
}

function detect() {
  try {
    return fs.statSync(projectsDir()).isDirectory();
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

// Claude reports per-message usage (not cumulative), so each message's usage is
// added directly. cache_read is treated as cached input; input_tokens stays the
// non-cached prompt count.
function normalizeUsage(u) {
  const input = toInt(u.input_tokens);
  const output = toInt(u.output_tokens);
  const cacheCreation = toInt(u.cache_creation_input_tokens);
  const cacheRead = toInt(u.cache_read_input_tokens);
  return {
    input_tokens: input,
    cached_input_tokens: cacheRead,
    cache_creation_input_tokens: cacheCreation,
    output_tokens: output,
    reasoning_output_tokens: 0,
    total_tokens: input + output + cacheCreation + cacheRead,
  };
}

function isAllZero(d) {
  return (
    d.input_tokens === 0 &&
    d.cached_input_tokens === 0 &&
    d.cache_creation_input_tokens === 0 &&
    d.output_tokens === 0
  );
}

// Anthropic guarantees message.id is globally unique per response — a valid
// dedup key on its own. Prevents double counting the same message across a
// re-scan or across main/subagent files.
function dedupKey(obj) {
  const msgId = obj && obj.message && typeof obj.message.id === 'string' ? obj.message.id : null;
  if (!msgId) return null;
  const reqId = typeof obj.requestId === 'string' && obj.requestId ? obj.requestId : null;
  return reqId ? `${msgId}:${reqId}` : msgId;
}

async function parse({ cursors, aggregate }) {
  const files = [];
  walk(projectsDir(), files);
  files.sort();

  if (!cursors.files || typeof cursors.files !== 'object') cursors.files = {};
  const seen = new Set(Array.isArray(cursors.claudeHashes) ? cursors.claudeHashes : []);

  for (const filePath of files) {
    const prev = cursors.files[filePath] || null;
    const result = readNewLines(filePath, prev);
    if (!result) continue;
    const isMain = !filePath.includes(`${path.sep}subagents${path.sep}`);

    for (const line of result.lines) {
      if (!line.includes('"usage"') && !(isMain && line.includes('"type":"user"'))) continue;
      let obj;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }

      if (isMain && obj && obj.type === 'user') {
        const content = obj.message && obj.message.content;
        const hasText =
          typeof content === 'string' ||
          (Array.isArray(content) && content.some((b) => b && b.type === 'text'));
        const ts = typeof obj.timestamp === 'string' ? obj.timestamp : null;
        if (hasText && ts) {
          aggregate(source, DEFAULT_MODEL, ts, normalizeUsage({}), 1);
        }
      }

      const usage = (obj && obj.message && obj.message.usage) || (obj && obj.usage);
      if (!usage || typeof usage !== 'object') continue;
      const ts = typeof obj.timestamp === 'string' ? obj.timestamp : null;
      if (!ts) continue;

      const key = dedupKey(obj);
      if (key && seen.has(key)) continue;

      const delta = normalizeUsage(usage);
      if (isAllZero(delta)) continue;
      if (key) seen.add(key);

      const model =
        (obj.message && typeof obj.message.model === 'string' && obj.message.model) ||
        (typeof obj.model === 'string' && obj.model) ||
        DEFAULT_MODEL;
      aggregate(source, model, ts, delta, 0);
    }

    cursors.files[filePath] = { inode: result.cursor.inode, offset: result.cursor.offset };
  }

  const all = Array.from(seen);
  cursors.claudeHashes = all.length > MAX_HASHES ? all.slice(all.length - MAX_HASHES) : all;
}

module.exports = { source, detect, parse };

'use strict';

const claude = require('./claude.js');
const codex = require('./codex.js');
const gemini = require('./gemini.js');
const opencode = require('./opencode.js');
const kiro = require('./kiro.js');
const cursor = require('./cursor.js');
const copilot = require('./copilot.js');
const openrouter = require('./openrouter.js');
const queue = require('../lib/queue.js');

const ALL = [claude, codex, gemini, opencode, kiro, cursor, copilot, openrouter];

/**
 * Run every parser whose source files are present on this machine and append
 * the buckets they emit to the durable queue. Each parser is responsible for
 * its own cursor management and is a no-op when its source isn't installed.
 *
 * Each parser's buckets are appended to the queue immediately after that parser
 * returns, before the next parser runs. This bounds the crash window: a parser
 * advancing its cursor in parse() can only lose data in the microseconds before
 * its own append — a later parser crashing can no longer drop an earlier
 * parser's already-queued buckets.
 *
 * Returns: { buckets: [...all emitted...], summary: { source: { added, error } } }
 */
async function runAll() {
  const buckets = [];
  const summary = {};
  for (const p of ALL) {
    try {
      if (typeof p.detect === 'function' && !(await p.detect())) {
        summary[p.source] = { added: 0, skipped: true };
        continue;
      }
      const out = await p.parse();
      const parsed = Array.isArray(out) ? out : [];
      if (parsed.length > 0) {
        queue.appendBuckets(parsed);
        buckets.push(...parsed);
      }
      summary[p.source] = { added: parsed.length };
    } catch (err) {
      summary[p.source] = { added: 0, error: err.message };
    }
  }
  return { buckets, summary };
}

module.exports = { runAll, parsers: ALL };

'use strict';

const claude = require('./claude.js');
const codex = require('./codex.js');
const gemini = require('./gemini.js');
const opencode = require('./opencode.js');
const kiro = require('./kiro.js');
const cursor = require('./cursor.js');
const copilot = require('./copilot.js');
const openrouter = require('./openrouter.js');

const ALL = [claude, codex, gemini, opencode, kiro, cursor, copilot, openrouter];

/**
 * Run every parser whose source files are present on this machine and
 * collect the buckets they emit. Each parser is responsible for its own
 * cursor management and is a no-op when its source isn't installed.
 *
 * Returns: { source: { added, error }, buckets: [] }
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
      if (Array.isArray(out) && out.length > 0) buckets.push(...out);
      summary[p.source] = { added: out?.length ?? 0 };
    } catch (err) {
      summary[p.source] = { added: 0, error: err.message };
    }
  }
  return { buckets, summary };
}

module.exports = { runAll, parsers: ALL };

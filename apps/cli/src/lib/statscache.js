'use strict';

// Shared reader for Claude Code's persistent per-day/per-model aggregate
// (~/.claude/stats-cache.json). This is the authoritative Claude usage source for
// TokenBoard (matches Claude's own Stats numbers, full history, survives log pruning).

const fs = require('node:fs');
const path = require('node:path');
const { userHome } = require('./tracker-paths');

function statsCachePath() {
  if (process.env.CLAUDE_STATS_CACHE) return process.env.CLAUDE_STATS_CACHE;
  return path.join(userHome(), '.claude', 'stats-cache.json');
}

// Returns { records: [{date, model, tokens}], mtimeMs }.
function readClaudeDaily() {
  const p = statsCachePath();
  let raw;
  let mtimeMs = 0;
  try {
    mtimeMs = fs.statSync(p).mtimeMs;
    raw = fs.readFileSync(p, 'utf8');
  } catch {
    return { records: [], mtimeMs: 0 };
  }
  let j;
  try {
    j = JSON.parse(raw);
  } catch {
    return { records: [], mtimeMs };
  }
  const records = [];
  const dmt = Array.isArray(j.dailyModelTokens) ? j.dailyModelTokens : [];
  for (const row of dmt) {
    const date = row && typeof row.date === 'string' ? row.date : null;
    if (!date) continue;
    const byModel = (row && row.tokensByModel) || {};
    for (const model of Object.keys(byModel)) {
      const tokens = Math.max(0, Math.floor(Number(byModel[model]) || 0));
      if (tokens > 0) records.push({ date, model, tokens });
    }
  }
  return { records, mtimeMs };
}

// Convert the daily aggregate to upload buckets: one per (day, model), placed at a
// noon-UTC half-hour boundary so the day lands correctly across timezones. Only total
// tokens are known (stats-cache has no input/output/cache split).
function claudeUploadBuckets() {
  return readClaudeDaily().records.map(({ date, model, tokens }) => ({
    source: 'claude',
    model,
    hour_start: `${date}T12:00:00.000Z`,
    input_tokens: 0,
    cached_input_tokens: 0,
    cache_creation_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: tokens,
    billable_total_tokens: tokens,
    conversation_count: 0,
  }));
}

module.exports = { statsCachePath, readClaudeDaily, claudeUploadBuckets };

'use strict';

// Rich local usage summary the menu-bar app reads directly (no server, no auth).
// Claude comes from ~/.claude/stats-cache.json (Claude Code's persistent per-day/per-model
// aggregate — full history, survives log pruning, matches Claude's own Stats numbers).
// All other tools come from the CLI's live buckets (cursors.buckets). Merged into one
// per-(day, model) view. All computed in the machine's LOCAL timezone.

const fs = require('node:fs');
const path = require('node:path');
const { paths, userHome } = require('./tracker-paths');
const { loadCursors } = require('./cursors');

// Rough blended $/1M-token rates for a cost estimate (best-effort, not billing-accurate).
const RATES = [
  ['opus', 12],
  ['sonnet', 3],
  ['haiku', 0.8],
  ['fable', 3],
  ['gpt-5', 5],
  ['gpt', 3],
  ['gemini', 2],
  ['big-pickle', 2],
];
function rateFor(model) {
  const m = String(model || '').toLowerCase();
  for (const [k, r] of RATES) if (m.includes(k)) return r;
  return 2;
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function localDayKey(ms) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function todayKey(now) {
  return localDayKey(now.getTime());
}

// day-string arithmetic helpers (YYYY-MM-DD in local wallclock)
function dayKeyMinus(now, days) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return localDayKey(d.getTime());
}

function readStatsCacheClaude() {
  const p = path.join(userHome(), '.claude', 'stats-cache.json');
  let raw;
  try {
    raw = fs.readFileSync(p, 'utf8');
  } catch {
    return [];
  }
  let j;
  try {
    j = JSON.parse(raw);
  } catch {
    return [];
  }
  const out = [];
  const dmt = Array.isArray(j.dailyModelTokens) ? j.dailyModelTokens : [];
  for (const row of dmt) {
    const date = row && typeof row.date === 'string' ? row.date : null;
    if (!date) continue;
    const byModel = (row && row.tokensByModel) || {};
    for (const model of Object.keys(byModel)) {
      out.push({ date, source: 'claude', model, tokens: toInt(byModel[model]) });
    }
  }
  return out;
}

function readLiveNonClaude(cursors) {
  const buckets =
    cursors && cursors.buckets && typeof cursors.buckets === 'object' ? cursors.buckets : {};
  const out = [];
  for (const key of Object.keys(buckets)) {
    const b = buckets[key];
    if (!b || !b.totals || b.source === 'claude') continue; // claude comes from stats-cache
    const ms = Date.parse(b.hour_start);
    if (Number.isNaN(ms)) continue;
    out.push({
      date: localDayKey(ms),
      source: b.source,
      model: b.model || 'unknown',
      tokens: toInt(b.totals.total_tokens),
    });
  }
  return out;
}

function computeSummary(cursors, now = new Date()) {
  const records = [...readStatsCacheClaude(), ...readLiveNonClaude(cursors)];

  const perDay = new Map(); // dayKey -> tokens
  const perModel = new Map(); // model -> tokens
  const perSource = new Map(); // source -> tokens
  const costByModel = new Map(); // model -> usd
  let minDay = null;
  let total = 0;

  for (const r of records) {
    if (r.tokens <= 0) continue;
    perDay.set(r.date, (perDay.get(r.date) || 0) + r.tokens);
    perModel.set(r.model, (perModel.get(r.model) || 0) + r.tokens);
    perSource.set(r.source, (perSource.get(r.source) || 0) + r.tokens);
    costByModel.set(r.model, (costByModel.get(r.model) || 0) + (r.tokens / 1e6) * rateFor(r.model));
    total += r.tokens;
    if (!minDay || r.date < minDay) minDay = r.date;
  }

  const today = todayKey(now);
  const d7Start = dayKeyMinus(now, 6); // inclusive 7-day window
  const d30Start = dayKeyMinus(now, 29);

  let d7 = 0;
  let d30 = 0;
  let activeDays7 = 0;
  let activeDays30 = 0;
  let activeDaysTotal = 0;
  for (const [day, tok] of perDay.entries()) {
    if (tok > 0) activeDaysTotal += 1;
    if (day >= d30Start) {
      d30 += tok;
      if (tok > 0) activeDays30 += 1;
    }
    if (day >= d7Start) {
      d7 += tok;
      if (tok > 0) activeDays7 += 1;
    }
  }
  const todayTok = perDay.get(today) || 0;

  // zero-filled daily series from first activity (or 180d ago) to today, ascending
  const startDay = minDay && minDay < dayKeyMinus(now, 180) ? minDay : dayKeyMinus(now, 180);
  const daily = [];
  {
    let cur = new Date(`${startDay}T00:00:00`);
    const end = new Date(`${today}T00:00:00`);
    while (cur <= end) {
      const key = localDayKey(cur.getTime());
      daily.push({ date: key, total_tokens: String(perDay.get(key) || 0) });
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    }
  }

  const by_model = [...perModel.entries()]
    .map(([model, tok]) => ({
      model,
      total_tokens: String(tok),
      pct: total > 0 ? Math.round((tok / total) * 1000) / 10 : 0,
    }))
    .sort((a, z) => Number(z.total_tokens) - Number(a.total_tokens));

  const by_source = [...perSource.entries()]
    .map(([source, tok]) => ({ source, total_tokens: String(tok) }))
    .sort((a, z) => Number(z.total_tokens) - Number(a.total_tokens));

  let totalCost = 0;
  for (const c of costByModel.values()) totalCost += c;
  const usd = (n) => Math.round(n * 100) / 100;
  // apportion today/d7/d30 cost by their token share of total (approx)
  const share = (tok) => (total > 0 ? usd((totalCost * tok) / total) : 0);

  return {
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    generated_at: now.toISOString(),
    totals: {
      today: String(todayTok),
      d7: String(d7),
      d30: String(d30),
      total: String(total),
      // kept for backward-compat with older readers
      week: String(d7),
      month: String(d30),
    },
    cost: { today: share(todayTok), d7: share(d7), d30: share(d30), total: usd(totalCost) },
    active_days_total: activeDaysTotal,
    active_days_7: activeDays7,
    avg_per_day_30: String(activeDays30 > 0 ? Math.floor(d30 / activeDays30) : 0),
    daily,
    by_model,
    by_source,
  };
}

function writeLocalSummary(now = new Date()) {
  const { root, summaryPath } = paths();
  fs.mkdirSync(root, { recursive: true });
  const summary = computeSummary(loadCursors(), now);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
  return summary;
}

module.exports = { computeSummary, writeLocalSummary, localDayKey };

'use strict';

// Local usage summary the menu-bar app reads directly (no server, no auth). Computed ONLY
// from the CLI's own live buckets (cursors.buckets) — the exact same data the rest of the
// pipeline uploads. Period boundaries use the machine's LOCAL timezone.

const fs = require('node:fs');
const { paths } = require('./tracker-paths');
const { loadCursors } = require('./cursors');

// Rough blended $/1M-token rates for a display-only cost estimate (not billing-accurate).
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

function dayKeyMinus(now, days) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return localDayKey(d.getTime());
}

function computeSummary(cursors, now = new Date()) {
  const buckets =
    cursors && cursors.buckets && typeof cursors.buckets === 'object' ? cursors.buckets : {};

  const perDay = new Map(); // dayKey -> tokens
  const perModel = new Map();
  const perSource = new Map();
  const costByModel = new Map();
  let minDay = null;
  let total = 0;

  for (const key of Object.keys(buckets)) {
    const b = buckets[key];
    if (!b || !b.totals) continue;
    const ms = Date.parse(b.hour_start);
    if (Number.isNaN(ms)) continue;
    const tok = toInt(b.totals.total_tokens);
    if (tok <= 0) continue;
    const day = localDayKey(ms);
    const model = b.model || 'unknown';
    const source = b.source || 'other';
    perDay.set(day, (perDay.get(day) || 0) + tok);
    perModel.set(model, (perModel.get(model) || 0) + tok);
    perSource.set(source, (perSource.get(source) || 0) + tok);
    costByModel.set(model, (costByModel.get(model) || 0) + (tok / 1e6) * rateFor(model));
    total += tok;
    if (!minDay || day < minDay) minDay = day;
  }

  const today = localDayKey(now.getTime());
  const d7Start = dayKeyMinus(now, 6);
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

  const startDay = minDay && minDay < dayKeyMinus(now, 180) ? minDay : dayKeyMinus(now, 180);
  const daily = [];
  {
    let cur = new Date(`${startDay}T00:00:00`);
    const end = new Date(`${today}T00:00:00`);
    while (cur <= end) {
      const k = localDayKey(cur.getTime());
      daily.push({ date: k, total_tokens: String(perDay.get(k) || 0) });
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
  const share = (tok) => (total > 0 ? usd((totalCost * tok) / total) : 0);

  return {
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    generated_at: now.toISOString(),
    totals: {
      today: String(todayTok),
      d7: String(d7),
      d30: String(d30),
      total: String(total),
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

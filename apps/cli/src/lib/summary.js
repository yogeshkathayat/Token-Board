'use strict';

// Local usage summary the menu-bar app reads directly (no server, no auth). Computed from
// the CLI's own aggregated buckets (cursors.buckets) so it works fully offline. Period
// boundaries use the machine's LOCAL timezone (the menu bar uses the same machine tz).

const fs = require('node:fs');
const { paths } = require('./tracker-paths');
const { loadCursors } = require('./cursors');

function localPeriodStarts(now) {
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = startToday.getDay(); // 0 = Sunday
  const diffToMonday = dow === 0 ? 6 : dow - 1;
  const startWeek = new Date(startToday);
  startWeek.setDate(startToday.getDate() - diffToMonday);
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return { today: startToday.getTime(), week: startWeek.getTime(), month: startMonth.getTime() };
}

// Returns { tz, generated_at, totals: {today,week,month,total}, by_source: [{source,total_tokens}] }
// with token values as strings (bigint-safe), matching the read-endpoint convention.
function computeSummary(cursors, now = new Date()) {
  const buckets =
    cursors && cursors.buckets && typeof cursors.buckets === 'object' ? cursors.buckets : {};
  const starts = localPeriodStarts(now);
  let today = 0n;
  let week = 0n;
  let month = 0n;
  let total = 0n;
  const bySource = new Map();

  for (const key of Object.keys(buckets)) {
    const b = buckets[key];
    if (!b || !b.totals) continue;
    const tt = BigInt(Math.max(0, Math.floor(Number(b.totals.total_tokens) || 0)));
    const ms = Date.parse(b.hour_start);
    if (Number.isNaN(ms)) continue;
    total += tt;
    if (ms >= starts.month) month += tt;
    if (ms >= starts.week) week += tt;
    if (ms >= starts.today) today += tt;
    bySource.set(b.source, (bySource.get(b.source) || 0n) + tt);
  }

  const by_source = [...bySource.entries()]
    .map(([source, v]) => ({ source, total_tokens: v.toString() }))
    .sort((a, z) => (BigInt(z.total_tokens) > BigInt(a.total_tokens) ? 1 : -1));

  return {
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    generated_at: now.toISOString(),
    totals: {
      today: today.toString(),
      week: week.toString(),
      month: month.toString(),
      total: total.toString(),
    },
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

module.exports = { computeSummary, writeLocalSummary };

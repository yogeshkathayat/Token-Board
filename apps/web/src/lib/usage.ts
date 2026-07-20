import 'server-only';

import { query } from '@/lib/db/client';

// Only these characters ever appear in IANA tz names; guards the inlined-into-SQL path.
const TZ_NAME = /^[A-Za-z0-9_+\-/]+$/;
let TZ_SET: Set<string> | null | undefined;

function isValidTz(tz: string): boolean {
  if (!TZ_NAME.test(tz)) return false;
  if (TZ_SET === undefined) {
    try {
      const supported = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
        .supportedValuesOf;
      TZ_SET = supported ? new Set(supported('timeZone')) : null;
    } catch {
      TZ_SET = null;
    }
  }
  if (TZ_SET) return TZ_SET.has(tz);
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Return a safe, SQL-inlinable IANA tz, falling back to UTC for anything unrecognized. */
function safeTz(tz?: string): string {
  if (!tz || tz === 'UTC') return 'UTC';
  return isValidTz(tz) ? tz : 'UTC';
}

/** SQL expression: start of the current `unit` in `tz`, as a timestamptz. tz MUST be pre-validated. */
function startExpr(tz: string, unit: 'day' | 'week' | 'month'): string {
  return `(date_trunc('${unit}', now() AT TIME ZONE '${tz}') AT TIME ZONE '${tz}')`;
}

interface UsageSummary {
  tz: string;
  totals: { today: string; week: string; month: string; total: string };
  by_source: Array<{ source: string; total_tokens: string }>;
  by_model: Array<{ model: string; total_tokens: string }>;
  last30: Array<{ day: string; total_tokens: string }>;
}

// Start of the day `days-1` days before today, in `tz` (rolling "last N days" incl. today).
function lastNDaysStartExpr(tz: string, days: number): string {
  const n = Math.max(1, Math.floor(days));
  return `(date_trunc('day', now() AT TIME ZONE '${tz}') - interval '${n - 1} days') AT TIME ZONE '${tz}'`;
}

async function sumSince(userId: string, sinceExpr: string): Promise<string> {
  const rows = await query<{ total_tokens: string }>(
    `SELECT COALESCE(sum(total_tokens), 0)::text AS total_tokens
       FROM tb_usage_buckets
      WHERE user_id = $1 AND hour_start >= ${sinceExpr}`,
    [userId],
  );
  return rows[0]?.total_tokens || '0';
}

export async function getUsageSummary(userId: string, tz?: string): Promise<UsageSummary> {
  const zone = safeTz(tz);

  const today = await sumSince(userId, startExpr(zone, 'day'));
  const week = await sumSince(userId, lastNDaysStartExpr(zone, 7)); // last 7 days (rolling)
  const month = await sumSince(userId, lastNDaysStartExpr(zone, 30)); // last 30 days (rolling)
  const totalRows = await query<{ total_tokens: string }>(
    `SELECT COALESCE(sum(total_tokens), 0)::text AS total_tokens
       FROM tb_usage_buckets WHERE user_id = $1`,
    [userId],
  );

  const by_source = await query<{ source: string; total_tokens: string }>(
    `SELECT source, sum(total_tokens)::text AS total_tokens
       FROM tb_usage_buckets WHERE user_id = $1
      GROUP BY source ORDER BY sum(total_tokens) DESC`,
    [userId],
  );

  const by_model = await query<{ model: string; total_tokens: string }>(
    `SELECT model, sum(total_tokens)::text AS total_tokens
       FROM tb_usage_buckets WHERE user_id = $1
      GROUP BY model ORDER BY sum(total_tokens) DESC LIMIT 10`,
    [userId],
  );

  // 30 local days, zero-filled, bucketed in the user's tz.
  const dayStart = `date_trunc('day', now() AT TIME ZONE '${zone}')`;
  const last30 = await query<{ day: string; total_tokens: string }>(
    `WITH days AS (
        SELECT generate_series(${dayStart} - interval '29 days', ${dayStart}, interval '1 day') AS d
     ), agg AS (
        SELECT date_trunc('day', hour_start AT TIME ZONE '${zone}') AS d, sum(total_tokens) AS t
          FROM tb_usage_buckets
         WHERE user_id = $1
           AND hour_start >= (${dayStart} - interval '29 days') AT TIME ZONE '${zone}'
         GROUP BY 1
     )
     SELECT to_char(days.d, 'YYYY-MM-DD') AS day, COALESCE(agg.t, 0)::text AS total_tokens
       FROM days LEFT JOIN agg ON agg.d = days.d
      ORDER BY days.d ASC`,
    [userId],
  );

  return {
    tz: zone,
    totals: { today, week, month, total: totalRows[0]?.total_tokens || '0' },
    by_source,
    by_model,
    last30,
  };
}

export interface UsageHeatmap {
  tz: string;
  days: Array<{ day: string; total_tokens: string }>;
}

/** Zero-filled per-day totals for the last `days` local days (for a calendar heatmap). */
export async function getUsageHeatmap(
  userId: string,
  tz?: string,
  days = 112,
): Promise<UsageHeatmap> {
  const zone = safeTz(tz);
  const n = Math.min(Math.max(Math.floor(days) || 0, 1), 400);
  const dayStart = `date_trunc('day', now() AT TIME ZONE '${zone}')`;
  const rows = await query<{ day: string; total_tokens: string }>(
    `WITH days AS (
        SELECT generate_series(${dayStart} - interval '${n - 1} days', ${dayStart}, interval '1 day') AS d
     ), agg AS (
        SELECT date_trunc('day', hour_start AT TIME ZONE '${zone}') AS d, sum(total_tokens) AS t
          FROM tb_usage_buckets
         WHERE user_id = $1
           AND hour_start >= (${dayStart} - interval '${n - 1} days') AT TIME ZONE '${zone}'
         GROUP BY 1
     )
     SELECT to_char(days.d, 'YYYY-MM-DD') AS day, COALESCE(agg.t, 0)::text AS total_tokens
       FROM days LEFT JOIN agg ON agg.d = days.d
      ORDER BY days.d ASC`,
    [userId],
  );
  return { tz: zone, days: rows };
}

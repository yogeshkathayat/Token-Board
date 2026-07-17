import 'server-only';

import { query } from '@/lib/db/client';

function parseTimezone(tz?: string): string {
  if (!tz || tz === 'UTC') return 'UTC';
  return tz;
}

function tzBoundary(tz: string, daysAgo: number): string {
  const now = new Date();
  const d = new Date(now.getTime() - daysAgo * 86400000);
  if (tz === 'UTC') {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
  }
  return `timezone('${tz}', date_trunc('day', now() - interval '${daysAgo} days'))`;
}

function tzStartOfDay(tz: string): string {
  if (tz === 'UTC') {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  }
  return `timezone('${tz}', date_trunc('day', now()))`;
}

function tzStartOfWeek(tz: string): string {
  if (tz === 'UTC') {
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dayOfWeek = todayUTC.getUTCDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    todayUTC.setUTCDate(todayUTC.getUTCDate() - diffToMonday);
    return todayUTC.toISOString();
  }
  return `timezone('${tz}', date_trunc('week', now()))`;
}

function tzStartOfMonth(tz: string): string {
  if (tz === 'UTC') {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  }
  return `timezone('${tz}', date_trunc('month', now()))`;
}

interface UsageSummary {
  tz: string;
  totals: {
    today: string;
    week: string;
    month: string;
    total: string;
  };
  by_source: Array<{ source: string; total_tokens: string }>;
  by_model: Array<{ model: string; total_tokens: string }>;
  last30: Array<{ day: string; total_tokens: string }>;
}

export async function getUsageSummary(userId: string, tz?: string): Promise<UsageSummary> {
  const timezone = parseTimezone(tz);

  const todayStart = tzStartOfDay(timezone);
  const weekStart = tzStartOfWeek(timezone);
  const monthStart = tzStartOfMonth(timezone);
  const totalStart = '1970-01-01T00:00:00.000Z';

  const todayRows = await query<{ total_tokens: string }>(
    `SELECT COALESCE(sum(total_tokens), 0)::text AS total_tokens
     FROM tb_usage_buckets
     WHERE user_id = $1 AND hour_start >= $2`,
    [userId, todayStart],
  );

  const weekRows = await query<{ total_tokens: string }>(
    `SELECT COALESCE(sum(total_tokens), 0)::text AS total_tokens
     FROM tb_usage_buckets
     WHERE user_id = $1 AND hour_start >= $2`,
    [userId, weekStart],
  );

  const monthRows = await query<{ total_tokens: string }>(
    `SELECT COALESCE(sum(total_tokens), 0)::text AS total_tokens
     FROM tb_usage_buckets
     WHERE user_id = $1 AND hour_start >= $2`,
    [userId, monthStart],
  );

  const totalRows = await query<{ total_tokens: string }>(
    `SELECT COALESCE(sum(total_tokens), 0)::text AS total_tokens
     FROM tb_usage_buckets
     WHERE user_id = $1 AND hour_start >= $2`,
    [userId, totalStart],
  );

  const bySource = await query<{ source: string; total_tokens: string }>(
    `SELECT source, sum(total_tokens)::text AS total_tokens
     FROM tb_usage_buckets
     WHERE user_id = $1
     GROUP BY source
     ORDER BY sum(total_tokens) DESC`,
    [userId],
  );

  const byModel = await query<{ model: string; total_tokens: string }>(
    `SELECT model, sum(total_tokens)::text AS total_tokens
     FROM tb_usage_buckets
     WHERE user_id = $1
     GROUP BY model
     ORDER BY sum(total_tokens) DESC
     LIMIT 10`,
    [userId],
  );

  const last30Start = new Date();
  last30Start.setUTCDate(last30Start.getUTCDate() - 30);
  const last30Rows = await query<{ day: string; total_tokens: string }>(
    `SELECT date_trunc('day', hour_start)::date::text AS day,
            sum(total_tokens)::text AS total_tokens
     FROM tb_usage_buckets
     WHERE user_id = $1 AND hour_start >= $2
     GROUP BY day
     ORDER BY day ASC`,
    [userId, last30Start.toISOString()],
  );

  return {
    tz: timezone,
    totals: {
      today: todayRows[0]?.total_tokens || '0',
      week: weekRows[0]?.total_tokens || '0',
      month: monthRows[0]?.total_tokens || '0',
      total: totalRows[0]?.total_tokens || '0',
    },
    by_source: bySource,
    by_model: byModel,
    last30: last30Rows,
  };
}

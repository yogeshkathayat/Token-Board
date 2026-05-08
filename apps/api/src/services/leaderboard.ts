import { sql } from 'kysely';

import { db } from '../db/index.js';

export type Period = 'week' | 'month' | 'total';

export interface PeriodWindow {
  period: Period;
  from: string; // YYYY-MM-DD
  to: string;
}

/**
 * Sources that get a dedicated column in tb_leaderboard_snapshots. Anything
 * else (future sources, malformed rows) is collected into `other_tokens`.
 */
export const KNOWN_SOURCES = [
  'claude',
  'codex',
  'gemini',
  'opencode',
  'kiro',
  'cursor',
  'copilot',
  'openrouter',
] as const;
export type KnownSource = (typeof KNOWN_SOURCES)[number];

export function periodWindow(period: Period, now = new Date()): PeriodWindow {
  if (period === 'total') return { period, from: '1970-01-01', to: '9999-12-31' };
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === 'month') {
    const from = new Date(Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth(), 1));
    const to = new Date(Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth() + 1, 0));
    return { period, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }
  // Week — Sunday-start in UTC.
  const dow = utc.getUTCDay();
  const from = new Date(utc.getTime() - dow * 86400_000);
  const to = new Date(from.getTime() + 6 * 86400_000);
  return { period, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

interface AggRow {
  user_id: string;
  source: string;
  total: string;
}

interface UserTotals {
  user_id: string;
  total: bigint;
  bySource: Record<string, bigint>;
}

export async function refreshSnapshot(period: Period): Promise<{ inserted: number; window: PeriodWindow }> {
  const window = periodWindow(period);
  const fromDate = new Date(`${window.from}T00:00:00Z`);
  const toDate = new Date(`${window.to}T23:59:59.999Z`);

  // Single query, group by (user_id, source). Then we pivot in JS — at the
  // user counts that fit on a self-hosted instance this is comfortably fast.
  const rows = (await db
    .selectFrom('tb_usage_buckets')
    .select([
      'user_id',
      'source',
      sql<string>`coalesce(sum(total_tokens), 0)::text`.as('total'),
    ])
    .where('source', '!=', 'canary')
    .where('hour_start', '>=', fromDate)
    .where('hour_start', '<=', toDate)
    .groupBy(['user_id', 'source'])
    .execute()) as AggRow[];

  const totals = new Map<string, UserTotals>();
  for (const r of rows) {
    let u = totals.get(r.user_id);
    if (!u) {
      u = { user_id: r.user_id, total: 0n, bySource: {} };
      totals.set(r.user_id, u);
    }
    const v = BigInt(r.total);
    u.bySource[r.source] = (u.bySource[r.source] ?? 0n) + v;
    u.total += v;
  }

  const sorted = Array.from(totals.values()).sort((a, b) => {
    if (a.total > b.total) return -1;
    if (a.total < b.total) return 1;
    return a.user_id.localeCompare(b.user_id);
  });

  const visibility = await db
    .selectFrom('tb_public_visibility')
    .select(['user_id', 'enabled', 'revoked_at'])
    .execute();
  const publicMap = new Map(visibility.map((v) => [v.user_id, v.enabled && !v.revoked_at]));

  return db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom('tb_leaderboard_snapshots')
      .where('period', '=', period)
      .where('period_from', '=', window.from as never)
      .execute();

    if (sorted.length === 0) return { inserted: 0, window };

    const known = new Set<string>(KNOWN_SOURCES);
    const values = sorted.map((u, i) => {
      const get = (src: string) => (u.bySource[src] ?? 0n).toString();
      let other = 0n;
      for (const [src, v] of Object.entries(u.bySource)) {
        if (!known.has(src)) other += v;
      }
      return {
        period,
        period_from: window.from,
        period_to: window.to,
        user_id: u.user_id,
        rank: i + 1,
        claude_tokens: get('claude'),
        codex_tokens: get('codex'),
        gemini_tokens: get('gemini'),
        opencode_tokens: get('opencode'),
        kiro_tokens: get('kiro'),
        cursor_tokens: get('cursor'),
        copilot_tokens: get('copilot'),
        openrouter_tokens: get('openrouter'),
        other_tokens: other.toString(),
        total_tokens: u.total.toString(),
        is_public: publicMap.get(u.user_id) ?? false,
        generated_at: new Date(),
      };
    });
    await trx.insertInto('tb_leaderboard_snapshots').values(values as never).execute();
    return { inserted: sorted.length, window };
  });
}

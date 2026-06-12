import { sql } from 'kysely';

import { db } from '../db/index.js';
import { config } from '../config.js';

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

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** The calendar Y/M/D and day-of-week (0=Sun) of `now` as seen in `tz`. */
function localParts(now: Date, tz: string): { y: number; m: number; d: number; dow: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day), dow: dowMap[parts.weekday ?? ''] ?? 0 };
}

/** Shift a calendar date by `delta` days (pure calendar arithmetic). */
function shiftYmd(y: number, m: number, d: number, delta: number): { y: number; m: number; d: number } {
  const t = new Date(Date.UTC(y, m - 1, d + delta));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** Offset (ms) of `tz` from UTC at the given instant. */
function tzOffsetMs(date: Date, tz: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  const hour = p.hour === '24' ? '00' : p.hour;
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(hour), Number(p.minute), Number(p.second));
  return asUtc - date.getTime();
}

/** UTC instant of local-midnight (start of day) for a YYYY-MM-DD date in `tz`. */
function zonedStartOfDayUtc(dateStr: string, tz: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const guess = Date.UTC(y!, m! - 1, d!, 0, 0, 0);
  const off = tzOffsetMs(new Date(guess), tz);
  return new Date(guess - off);
}

export function periodWindow(period: Period, now = new Date(), tz: string = config.leaderboardTz): PeriodWindow {
  if (period === 'total') return { period, from: '1970-01-01', to: '9999-12-31' };
  const { y, m, d, dow } = localParts(now, tz);
  if (period === 'month') {
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { period, from: ymd(y, m, 1), to: ymd(y, m, lastDay) };
  }
  // Week — Sunday-start, in the configured timezone.
  const start = shiftYmd(y, m, d, -dow);
  const end = shiftYmd(start.y, start.m, start.d, 6);
  return { period, from: ymd(start.y, start.m, start.d), to: ymd(end.y, end.m, end.d) };
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
  // Filter on instants aligned to the configured timezone's day boundaries, so
  // week/month windows match the org's wallclock rather than server UTC.
  const fromDate =
    period === 'total' ? new Date('1970-01-01T00:00:00Z') : zonedStartOfDayUtc(window.from, config.leaderboardTz);
  const toDate =
    period === 'total'
      ? new Date('9999-12-31T23:59:59.999Z')
      : new Date(zonedStartOfDayUtc(window.to, config.leaderboardTz).getTime() + 86_400_000 - 1);

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

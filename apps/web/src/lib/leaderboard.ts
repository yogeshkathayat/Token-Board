import 'server-only';

import { isCompanyEmail } from '@/lib/auth/company';
import { SOURCES } from '@/lib/contract';
import { pool } from '@/lib/db/client';

interface LeaderboardPeriod {
  period: 'week' | 'month' | 'total';
  fromDay: string;
  toDay: string;
}

function getPeriodWindows(): LeaderboardPeriod[] {
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const mondayThisWeek = new Date(todayUTC);
  const dayOfWeek = mondayThisWeek.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  mondayThisWeek.setUTCDate(mondayThisWeek.getUTCDate() - diffToMonday);

  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const epoch = new Date('1970-01-01T00:00:00.000Z');

  return [
    {
      period: 'week',
      fromDay: mondayThisWeek.toISOString().split('T')[0],
      toDay: todayUTC.toISOString().split('T')[0],
    },
    {
      period: 'month',
      fromDay: firstOfMonth.toISOString().split('T')[0],
      toDay: todayUTC.toISOString().split('T')[0],
    },
    {
      period: 'total',
      fromDay: epoch.toISOString().split('T')[0],
      toDay: todayUTC.toISOString().split('T')[0],
    },
  ];
}

function sourceColumn(source: string): string {
  if (SOURCES.includes(source as any)) return `${source}_tokens`;
  return 'other_tokens';
}

interface RefreshResult {
  week: number;
  month: number;
  total: number;
}

export async function refreshLeaderboard(): Promise<RefreshResult> {
  const windows = getPeriodWindows();
  const result: RefreshResult = { week: 0, month: 0, total: 0 };

  // Whole leaderboard swaps atomically: readers never see a half-deleted snapshot.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const { period, fromDay, toDay } of windows) {
      await client.query(
        `DELETE FROM tb_leaderboard_snapshots
         WHERE period = $1 AND from_day = $2 AND to_day = $3`,
        [period, fromDay, toDay],
      );

      const buckets = (
        await client.query<{
          user_id: string;
          source: string;
          total_tokens: string;
          total_cost_usd: string;
        }>(
          `SELECT user_id, source,
                  sum(total_tokens) AS total_tokens,
                  sum(total_cost_usd) AS total_cost_usd
           FROM tb_usage_buckets
           WHERE hour_start >= $1::date AND hour_start <= ($2::date + interval '1 day' - interval '1 second')
           GROUP BY user_id, source`,
          [fromDay, toDay],
        )
      ).rows;

      const profiles = (
        await client.query<{
          user_id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          leaderboard_public: boolean;
        }>(
          `SELECT user_id, email, display_name, avatar_url, leaderboard_public FROM tb_user_profiles`,
        )
      ).rows;

      const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

    const userMap = new Map<
      string,
      {
        user_id: string;
        claude_tokens: bigint;
        codex_tokens: bigint;
        cursor_tokens: bigint;
        kiro_tokens: bigint;
        gemini_tokens: bigint;
        opencode_tokens: bigint;
        other_tokens: bigint;
        total_tokens: bigint;
        estimated_cost_usd: number;
      }
    >();

    for (const row of buckets) {
      const prof = profileMap.get(row.user_id);
      if (!prof || !isCompanyEmail(prof.email)) continue;

      if (!userMap.has(row.user_id)) {
        userMap.set(row.user_id, {
          user_id: row.user_id,
          claude_tokens: 0n,
          codex_tokens: 0n,
          cursor_tokens: 0n,
          kiro_tokens: 0n,
          gemini_tokens: 0n,
          opencode_tokens: 0n,
          other_tokens: 0n,
          total_tokens: 0n,
          estimated_cost_usd: 0,
        });
      }

      const u = userMap.get(row.user_id)!;
      const col = sourceColumn(row.source) as keyof typeof u;
      if (col !== 'user_id' && col !== 'estimated_cost_usd') {
        (u[col] as bigint) += BigInt(row.total_tokens);
      }
      u.total_tokens += BigInt(row.total_tokens);
      u.estimated_cost_usd += parseFloat(row.total_cost_usd);
    }

    // Deterministic order: total desc, then user_id asc so equal totals rank stably.
    const sorted = Array.from(userMap.values()).sort((a, b) => {
      if (a.total_tokens !== b.total_tokens) return a.total_tokens > b.total_tokens ? -1 : 1;
      return a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0;
    });

    let rank = 0;
    for (const u of sorted) {
      rank++;
      const prof = profileMap.get(u.user_id)!;
      await client.query(
        `INSERT INTO tb_leaderboard_snapshots (
          user_id, period, from_day, to_day, rank,
          claude_tokens, codex_tokens, cursor_tokens, kiro_tokens, gemini_tokens, opencode_tokens, other_tokens,
          total_tokens, estimated_cost_usd, display_name, avatar_url, is_public, generated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, now())`,
        [
          u.user_id,
          period,
          fromDay,
          toDay,
          rank,
          u.claude_tokens.toString(),
          u.codex_tokens.toString(),
          u.cursor_tokens.toString(),
          u.kiro_tokens.toString(),
          u.gemini_tokens.toString(),
          u.opencode_tokens.toString(),
          u.other_tokens.toString(),
          u.total_tokens.toString(),
          u.estimated_cost_usd.toFixed(2),
          prof.display_name || prof.email.split('@')[0],
          prof.avatar_url,
          prof.leaderboard_public,
        ],
      );
    }

      result[period] = sorted.length;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return result;
}

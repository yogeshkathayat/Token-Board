import { NextRequest, NextResponse } from 'next/server';

import { getCompanyUser, userIdFor } from '@/lib/auth/company';
import { query } from '@/lib/db/client';

type Period = 'week' | 'month' | 'total';

function getPeriodWindow(period: Period): { fromDay: string; toDay: string } {
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  if (period === 'week') {
    const mondayThisWeek = new Date(todayUTC);
    const dayOfWeek = mondayThisWeek.getUTCDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    mondayThisWeek.setUTCDate(mondayThisWeek.getUTCDate() - diffToMonday);
    return {
      fromDay: mondayThisWeek.toISOString().split('T')[0],
      toDay: todayUTC.toISOString().split('T')[0],
    };
  }

  if (period === 'month') {
    const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return {
      fromDay: firstOfMonth.toISOString().split('T')[0],
      toDay: todayUTC.toISOString().split('T')[0],
    };
  }

  return {
    fromDay: '1970-01-01',
    toDay: todayUTC.toISOString().split('T')[0],
  };
}

export async function GET(req: NextRequest) {
  const user = await getCompanyUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const periodParam = searchParams.get('period') || 'week';

  if (!['week', 'month', 'total'].includes(periodParam)) {
    return NextResponse.json({ error: 'Invalid period' }, { status: 400 });
  }

  const period = periodParam as Period;
  const fallback = getPeriodWindow(period);
  const userId = userIdFor(user);

  // Read the most recently generated snapshot for this period, tolerating a day-boundary
  // skew between the read's computed window and the last cron refresh.
  const rows = await query<{
    user_id: string;
    rank: number;
    claude_tokens: string;
    codex_tokens: string;
    cursor_tokens: string;
    kiro_tokens: string;
    gemini_tokens: string;
    opencode_tokens: string;
    other_tokens: string;
    total_tokens: string;
    estimated_cost_usd: string;
    display_name: string | null;
    avatar_url: string | null;
    is_public: boolean;
    generated_at: string;
    from_day: string;
    to_day: string;
  }>(
    `SELECT user_id, rank, claude_tokens, codex_tokens, cursor_tokens, kiro_tokens, gemini_tokens, opencode_tokens, other_tokens,
            total_tokens, estimated_cost_usd, display_name, avatar_url, is_public, generated_at,
            from_day::text AS from_day, to_day::text AS to_day
     FROM tb_leaderboard_snapshots
     WHERE period = $1
       AND to_day = (SELECT max(to_day) FROM tb_leaderboard_snapshots WHERE period = $1)
       AND (is_public = true OR user_id = $2)
     ORDER BY rank ASC`,
    [period, userId],
  );

  const entries = rows.map((r) => ({
    rank: r.rank,
    user_id: r.user_id,
    display_name: r.display_name || 'Unknown',
    avatar_url: r.avatar_url,
    is_me: r.user_id === userId,
    claude_tokens: r.claude_tokens,
    codex_tokens: r.codex_tokens,
    cursor_tokens: r.cursor_tokens,
    kiro_tokens: r.kiro_tokens,
    gemini_tokens: r.gemini_tokens,
    opencode_tokens: r.opencode_tokens,
    other_tokens: r.other_tokens,
    total_tokens: r.total_tokens,
    estimated_cost_usd: r.estimated_cost_usd,
  }));

  const generatedAt = rows.length > 0 ? rows[0].generated_at : new Date().toISOString();

  return NextResponse.json({
    period,
    from_day: rows.length > 0 ? rows[0].from_day : fallback.fromDay,
    to_day: rows.length > 0 ? rows[0].to_day : fallback.toDay,
    generated_at: generatedAt,
    entries,
  });
}

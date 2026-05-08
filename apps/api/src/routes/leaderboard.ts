import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';

import {
  KNOWN_SOURCES,
  periodWindow,
  refreshSnapshot,
  type KnownSource,
  type Period,
} from '../services/leaderboard.js';

interface LeaderboardQuery {
  period?: Period;
  metric?: 'all' | 'other' | KnownSource;
  limit?: string;
  offset?: string;
}

const SOURCE_COLUMN = (s: KnownSource | 'other') => `${s}_tokens` as const;
const VALID_METRICS = new Set<string>(['all', 'other', ...KNOWN_SOURCES]);

const TOKEN_COLUMNS = [
  'claude_tokens',
  'codex_tokens',
  'gemini_tokens',
  'opencode_tokens',
  'kiro_tokens',
  'cursor_tokens',
  'copilot_tokens',
  'openrouter_tokens',
  'other_tokens',
  'total_tokens',
] as const;

type TokenColumn = (typeof TOKEN_COLUMNS)[number];

function tokenObject(r: Record<string, unknown>): Record<TokenColumn, string> {
  const out = {} as Record<TokenColumn, string>;
  for (const c of TOKEN_COLUMNS) out[c] = String(r[c] ?? '0');
  return out;
}

export async function leaderboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', { preHandler: app.optionalUser }, async (req, reply) => {
    const q = req.query as LeaderboardQuery;
    const period = (q.period ?? 'week') as Period;
    if (!['week', 'month', 'total'].includes(period)) {
      return reply.code(400).send({ error: 'BadRequest', message: 'period must be week|month|total' });
    }
    const metric = (q.metric ?? 'all') as NonNullable<LeaderboardQuery['metric']>;
    if (!VALID_METRICS.has(metric)) {
      return reply
        .code(400)
        .send({ error: 'BadRequest', message: `metric must be one of: all, ${KNOWN_SOURCES.join(', ')}, other` });
    }
    const limit = Math.max(1, Math.min(100, Number.parseInt(q.limit ?? '20', 10) || 20));
    const offset = Math.max(0, Math.min(10_000, Number.parseInt(q.offset ?? '0', 10) || 0));

    const window = periodWindow(period);
    const sortColumn: TokenColumn = metric === 'all' ? 'total_tokens' : SOURCE_COLUMN(metric);

    let rowsQ = app.db
      .selectFrom('tb_leaderboard_snapshots as s')
      .leftJoin('tb_users as u', 'u.id', 's.user_id')
      .leftJoin('tb_public_visibility as pv', 'pv.user_id', 's.user_id')
      .select([
        's.user_id',
        's.rank',
        ...TOKEN_COLUMNS.map((c) => `s.${c}` as never),
        's.is_public',
        sql<string>`coalesce(pv.display_name, u.display_name)`.as('display_name'),
        'u.avatar_url',
        sql<boolean>`coalesce(pv.anonymous, false)`.as('anonymous'),
      ])
      .where('s.period', '=', period)
      .where('s.period_from', '=', window.from as never)
      .orderBy(sortColumn, 'desc');

    if (metric !== 'all') {
      rowsQ = rowsQ.where(sortColumn, '>', '0' as never);
    }

    const total = await app.db
      .selectFrom('tb_leaderboard_snapshots')
      .select(({ fn }) => [fn.count<string>('user_id').as('count')])
      .where('period', '=', period)
      .where('period_from', '=', window.from as never)
      .$if(metric !== 'all', (qb) => qb.where(sortColumn, '>', '0' as never))
      .executeTakeFirstOrThrow();

    const rows = await rowsQ.limit(limit).offset(offset).execute();

    const meId = req.authUser?.sub ?? null;
    const entries = rows.map((r) => {
      const isMe = meId === r.user_id;
      const isPublic = Boolean(r.is_public);
      return {
        user_id: isPublic ? r.user_id : null,
        rank: r.rank,
        is_me: isMe,
        is_public: isPublic,
        display_name: r.anonymous ? 'Anonymous' : r.display_name ?? 'Anonymous',
        avatar_url: isPublic ? r.avatar_url : null,
        ...tokenObject(r as Record<string, unknown>),
      };
    });

    let me: unknown = null;
    if (meId) {
      const myRow = await app.db
        .selectFrom('tb_leaderboard_snapshots')
        .select(['rank', ...TOKEN_COLUMNS])
        .where('period', '=', period)
        .where('period_from', '=', window.from as never)
        .where('user_id', '=', meId)
        .executeTakeFirst();
      if (myRow) {
        me = { rank: myRow.rank, ...tokenObject(myRow as Record<string, unknown>) };
      } else {
        const zeros = {} as Record<TokenColumn, string>;
        for (const c of TOKEN_COLUMNS) zeros[c] = '0';
        me = { rank: null, ...zeros };
      }
    }

    const totalEntries = Number(total.count ?? 0);
    return {
      period,
      metric,
      from: window.from,
      to: window.to,
      generated_at: new Date().toISOString(),
      page: Math.floor(offset / limit) + 1,
      limit,
      offset,
      total_entries: totalEntries,
      total_pages: Math.max(1, Math.ceil(totalEntries / limit)),
      sources: KNOWN_SOURCES,
      entries,
      me,
    };
  });

  app.get('/profile', { preHandler: app.optionalUser }, async (req, reply) => {
    const q = req.query as { user_id?: string; period?: Period };
    if (!q.user_id) return reply.code(400).send({ error: 'BadRequest', message: 'user_id required' });
    const period = (q.period ?? 'week') as Period;
    const window = periodWindow(period);

    const isSelf = req.authUser?.sub === q.user_id;
    if (!isSelf) {
      const pv = await app.db
        .selectFrom('tb_public_visibility')
        .select(['enabled', 'revoked_at'])
        .where('user_id', '=', q.user_id)
        .executeTakeFirst();
      if (!pv || !pv.enabled || pv.revoked_at) {
        return reply.code(404).send({ error: 'NotFound', message: 'Profile not public' });
      }
    }

    const entry = await app.db
      .selectFrom('tb_leaderboard_snapshots as s')
      .leftJoin('tb_users as u', 'u.id', 's.user_id')
      .leftJoin('tb_public_visibility as pv', 'pv.user_id', 's.user_id')
      .select([
        's.user_id',
        's.rank',
        ...TOKEN_COLUMNS.map((c) => `s.${c}` as never),
        sql<string>`coalesce(pv.display_name, u.display_name)`.as('display_name'),
        'u.avatar_url',
      ])
      .where('s.period', '=', period)
      .where('s.period_from', '=', window.from as never)
      .where('s.user_id', '=', q.user_id)
      .executeTakeFirst();

    if (!entry) return reply.code(404).send({ error: 'NotFound', message: 'No snapshot' });
    return {
      period,
      from: window.from,
      to: window.to,
      generated_at: new Date().toISOString(),
      entry: {
        user_id: entry.user_id,
        rank: entry.rank,
        display_name: entry.display_name,
        avatar_url: entry.avatar_url,
        ...tokenObject(entry as Record<string, unknown>),
      },
    };
  });

  app.post('/refresh', { preHandler: app.requireAdmin }, async (req) => {
    const period = (req.query as { period?: Period }).period;
    const periods: Period[] = period ? [period] : ['week', 'month', 'total'];
    const results = [];
    for (const p of periods) {
      const r = await refreshSnapshot(p);
      results.push({ ...r.window, inserted: r.inserted });
    }
    return { success: true, generated_at: new Date().toISOString(), results };
  });
}

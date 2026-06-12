import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';

import {
  assertRangeWithinMax,
  daysAgoLocal,
  parseDate,
  parseTz,
  rangeDays,
  todayLocal,
} from '../services/dates.js';

interface UsageQuery {
  from?: string;
  to?: string;
  source?: string;
  model?: string;
  tz?: string;
  tz_offset_minutes?: string;
}

export async function usageRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireUser);

  // ----- /usage/summary -----
  app.get('/summary', async (req) => {
    const q = req.query as UsageQuery;
    const tz = parseTz(q);
    const to = parseDate(q.to, todayLocal(tz));
    const from = parseDate(q.from, daysAgoLocal(29, tz));
    assertRangeWithinMax(from, to);
    const userId = req.authUser!.sub;
    const dayCol = tz.iana
      ? sql<string>`to_char((hour_start at time zone ${tz.iana}), 'YYYY-MM-DD')`
      : sql<string>`to_char((hour_start + (${tz.offsetMinutes ?? 0} || ' minutes')::interval), 'YYYY-MM-DD')`;

    let qb = app.db
      .selectFrom('tb_usage_buckets')
      .select(({ fn }) => [
        fn.sum<string>('input_tokens').as('input_tokens'),
        fn.sum<string>('cached_input_tokens').as('cached_input_tokens'),
        fn.sum<string>('output_tokens').as('output_tokens'),
        fn.sum<string>('reasoning_output_tokens').as('reasoning_output_tokens'),
        fn.sum<string>('total_tokens').as('total_tokens'),
      ])
      .where('user_id', '=', userId)
      .where(dayCol, '>=', from)
      .where(dayCol, '<=', to);

    if (q.source) qb = qb.where('source', '=', q.source);
    if (q.model) qb = qb.where('model', '=', q.model);

    const row = await qb.executeTakeFirstOrThrow();
    return {
      from,
      to,
      days: rangeDays(from, to),
      totals: {
        input_tokens: row.input_tokens ?? '0',
        cached_input_tokens: row.cached_input_tokens ?? '0',
        output_tokens: row.output_tokens ?? '0',
        reasoning_output_tokens: row.reasoning_output_tokens ?? '0',
        total_tokens: row.total_tokens ?? '0',
      },
    };
  });

  // ----- /usage/daily -----
  app.get('/daily', async (req) => {
    const q = req.query as UsageQuery;
    const tz = parseTz(q);
    const to = parseDate(q.to, todayLocal(tz));
    const from = parseDate(q.from, daysAgoLocal(29, tz));
    assertRangeWithinMax(from, to);
    const userId = req.authUser!.sub;

    const dayCol = tz.iana
      ? sql<string>`to_char((hour_start at time zone ${tz.iana}), 'YYYY-MM-DD')`
      : sql<string>`to_char((hour_start + (${tz.offsetMinutes ?? 0} || ' minutes')::interval), 'YYYY-MM-DD')`;

    let qb = app.db
      .selectFrom('tb_usage_buckets')
      .select(({ fn }) => [
        dayCol.as('day'),
        fn.sum<string>('input_tokens').as('input_tokens'),
        fn.sum<string>('cached_input_tokens').as('cached_input_tokens'),
        fn.sum<string>('output_tokens').as('output_tokens'),
        fn.sum<string>('reasoning_output_tokens').as('reasoning_output_tokens'),
        fn.sum<string>('total_tokens').as('total_tokens'),
      ])
      .where('user_id', '=', userId)
      .where(dayCol, '>=', from)
      .where(dayCol, '<=', to)
      .groupBy('day')
      .orderBy('day', 'asc');

    if (q.source) qb = qb.where('source', '=', q.source);
    if (q.model) qb = qb.where('model', '=', q.model);

    const data = await qb.execute();
    return { from, to, data };
  });

  // ----- /usage/hourly -----
  app.get('/hourly', async (req) => {
    const q = req.query as { day?: string; source?: string; model?: string; tz?: string; tz_offset_minutes?: string };
    const tz = parseTz(q);
    const day = parseDate(q.day, todayLocal(tz));
    const userId = req.authUser!.sub;

    const tzOffset = tz.iana ? null : tz.offsetMinutes ?? 0;
    let qb = app.db
      .selectFrom('tb_usage_buckets')
      .select(({ fn }) => [
        sql<string>`to_char(hour_start, 'YYYY-MM-DD"T"HH24:MI:SS')`.as('hour'),
        fn.sum<string>('input_tokens').as('input_tokens'),
        fn.sum<string>('cached_input_tokens').as('cached_input_tokens'),
        fn.sum<string>('output_tokens').as('output_tokens'),
        fn.sum<string>('reasoning_output_tokens').as('reasoning_output_tokens'),
        fn.sum<string>('total_tokens').as('total_tokens'),
      ])
      .where('user_id', '=', userId)
      .where(
        tz.iana
          ? sql<string>`to_char((hour_start at time zone ${tz.iana}), 'YYYY-MM-DD')`
          : sql<string>`to_char((hour_start + (${tzOffset} || ' minutes')::interval), 'YYYY-MM-DD')`,
        '=',
        day,
      )
      .groupBy('hour_start')
      .orderBy('hour_start', 'asc');

    if (q.source) qb = qb.where('source', '=', q.source);
    if (q.model) qb = qb.where('model', '=', q.model);

    const data = await qb.execute();
    return { day, data };
  });

  // ----- /usage/monthly -----
  app.get('/monthly', async (req) => {
    const q = req.query as { months?: string; to?: string; source?: string; model?: string; tz?: string; tz_offset_minutes?: string };
    const tz = parseTz(q);
    const monthsBack = Math.max(1, Math.min(24, Number.parseInt(q.months ?? '24', 10) || 24));
    const userId = req.authUser!.sub;

    const monthExpr = tz.iana
      ? sql<string>`to_char((hour_start at time zone ${tz.iana}), 'YYYY-MM')`
      : sql<string>`to_char((hour_start + (${tz.offsetMinutes ?? 0} || ' minutes')::interval), 'YYYY-MM')`;

    const cutoff = new Date(Date.now() - monthsBack * 31 * 86400_000);

    let qb = app.db
      .selectFrom('tb_usage_buckets')
      .select(({ fn }) => [
        monthExpr.as('month'),
        fn.sum<string>('total_tokens').as('total_tokens'),
        fn.sum<string>('input_tokens').as('input_tokens'),
        fn.sum<string>('output_tokens').as('output_tokens'),
      ])
      .where('user_id', '=', userId)
      .where('hour_start', '>=', cutoff)
      .groupBy('month')
      .orderBy('month', 'asc');

    if (q.source) qb = qb.where('source', '=', q.source);
    if (q.model) qb = qb.where('model', '=', q.model);

    const data = await qb.execute();
    return { months: monthsBack, data };
  });

  // ----- /usage/heatmap -----
  app.get('/heatmap', async (req) => {
    const q = req.query as { weeks?: string; week_starts_on?: 'sun' | 'mon'; tz?: string; tz_offset_minutes?: string };
    const tz = parseTz(q);
    const weeks = Math.max(1, Math.min(104, Number.parseInt(q.weeks ?? '52', 10) || 52));
    const userId = req.authUser!.sub;
    const startsOn = q.week_starts_on === 'mon' ? 'mon' : 'sun';

    const dayExpr = tz.iana
      ? sql<string>`to_char((hour_start at time zone ${tz.iana}), 'YYYY-MM-DD')`
      : sql<string>`to_char((hour_start + (${tz.offsetMinutes ?? 0} || ' minutes')::interval), 'YYYY-MM-DD')`;

    const cutoff = new Date(Date.now() - weeks * 7 * 86400_000);

    const data = await app.db
      .selectFrom('tb_usage_buckets')
      .select(({ fn }) => [dayExpr.as('day'), fn.sum<string>('total_tokens').as('value')])
      .where('user_id', '=', userId)
      .where('hour_start', '>=', cutoff)
      .groupBy('day')
      .orderBy('day', 'asc')
      .execute();

    return { weeks, week_starts_on: startsOn, data };
  });

  // ----- /usage/model-breakdown -----
  app.get('/model-breakdown', async (req) => {
    const q = req.query as UsageQuery;
    const tz = parseTz(q);
    const to = parseDate(q.to, todayLocal(tz));
    const from = parseDate(q.from, daysAgoLocal(29, tz));
    assertRangeWithinMax(from, to);
    const userId = req.authUser!.sub;

    const dayCol = tz.iana
      ? sql<string>`to_char((hour_start at time zone ${tz.iana}), 'YYYY-MM-DD')`
      : sql<string>`to_char((hour_start + (${tz.offsetMinutes ?? 0} || ' minutes')::interval), 'YYYY-MM-DD')`;

    const rows = await app.db
      .selectFrom('tb_usage_buckets')
      .select(({ fn }) => [
        'source',
        'model',
        fn.sum<string>('total_tokens').as('total_tokens'),
        fn.sum<string>('input_tokens').as('input_tokens'),
        fn.sum<string>('output_tokens').as('output_tokens'),
        fn.sum<string>('cached_input_tokens').as('cached_input_tokens'),
        fn.sum<string>('reasoning_output_tokens').as('reasoning_output_tokens'),
      ])
      .where('user_id', '=', userId)
      .where(dayCol, '>=', from)
      .where(dayCol, '<=', to)
      .$if(Boolean(q.source), (qb) => qb.where('source', '=', q.source!))
      .groupBy(['source', 'model'])
      .orderBy('total_tokens', 'desc')
      .execute();

    const bySource = new Map<string, { source: string; totals: Record<string, string>; models: typeof rows }>();
    for (const r of rows) {
      let bucket = bySource.get(r.source);
      if (!bucket) {
        bucket = { source: r.source, totals: { total_tokens: '0', input_tokens: '0', output_tokens: '0', cached_input_tokens: '0', reasoning_output_tokens: '0' }, models: [] };
        bySource.set(r.source, bucket);
      }
      bucket.models.push(r);
      for (const k of Object.keys(bucket.totals)) {
        bucket.totals[k] = (BigInt(bucket.totals[k] ?? '0') + BigInt((r as Record<string, string>)[k] ?? '0')).toString();
      }
    }
    return { from, to, sources: Array.from(bySource.values()) };
  });

  // ----- /usage/limits -----
  app.get('/limits', async (req) => {
    const userId = req.authUser!.sub;
    const subs = await app.db
      .selectFrom('tb_device_subscriptions')
      .select(['tool', 'provider', 'product', 'plan_type', 'rate_limit_tier', 'observed_at'])
      .where('user_id', '=', userId)
      .orderBy('tool', 'asc')
      .execute();
    return { subscriptions: subs };
  });
}

import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';

import { isHalfHourBoundary, SOURCES } from '@tokenboard/shared';
import { config } from '../config.js';

const SOURCE_SET = new Set<string>(SOURCES);

interface IngestBucket {
  hour_start: string;
  source?: string;
  model?: string;
  input_tokens?: number;
  cached_input_tokens?: number;
  cache_creation_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
  total_tokens?: number;
  conversation_count?: number;
}

interface SubscriptionRow {
  tool: string;
  provider: string;
  product: string;
  plan_type?: string | null;
  rate_limit_tier?: string | null;
}

interface IngestBody {
  hourly?: IngestBucket[];
  // Backwards-compat: upstream tracker sends `{ data: { hourly: [...] } }`.
  data?: { hourly?: IngestBucket[] };
  device_subscriptions?: SubscriptionRow[];
}

const MAX_BUCKETS = 1000;
const MAX_TOKEN_VALUE = 1_000_000_000_000n; // 1T tokens — anything above is bogus

function clampInt(v: unknown): bigint {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return 0n;
  const n = BigInt(Math.floor(v));
  if (n > MAX_TOKEN_VALUE) return MAX_TOKEN_VALUE;
  return n;
}

export async function ingestRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/ingest',
    {
      preHandler: app.requireDevice,
      config: {
        rateLimit: { max: config.ingestRateMax, timeWindow: config.ingestRateWindowMs, keyGenerator: (req) => `device:${req.deviceContext?.device_id ?? req.ip}` },
      },
    },
    async (req, reply) => {
      const body = (req.body as IngestBody) ?? {};
      const buckets = body.hourly ?? body.data?.hourly ?? [];
      if (!Array.isArray(buckets)) {
        return reply.code(400).send({ error: 'BadRequest', message: 'hourly must be an array' });
      }
      if (buckets.length === 0) {
        return { success: true as const, inserted: 0, skipped: 0 };
      }
      if (buckets.length > MAX_BUCKETS) {
        return reply.code(413).send({ error: 'PayloadTooLarge', message: `max ${MAX_BUCKETS} buckets per request` });
      }

      const ctx = req.deviceContext!;
      const seen = new Set<string>();
      const rows: Array<Record<string, unknown>> = [];

      for (const b of buckets) {
        if (!b || typeof b !== 'object') continue;
        if (typeof b.hour_start !== 'string' || !isHalfHourBoundary(b.hour_start)) {
          return reply.code(400).send({
            error: 'BadRequest',
            message: `hour_start must be a UTC half-hour boundary; got ${b.hour_start}`,
          });
        }
        const source = (b.source ?? 'codex').toString();
        if (!SOURCE_SET.has(source)) {
          return reply.code(400).send({ error: 'BadRequest', message: `unknown source: ${source}` });
        }
        const model = (b.model && b.model.toString().trim()) || 'unknown';
        const dedupKey = `${source}|${model}|${b.hour_start}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        const input = clampInt(b.input_tokens);
        const cached = clampInt(b.cached_input_tokens);
        const cacheCreation = clampInt(b.cache_creation_input_tokens);
        const output = clampInt(b.output_tokens);
        const reasoning = clampInt(b.reasoning_output_tokens);
        const explicitTotal = clampInt(b.total_tokens);
        const computedTotal = input + cached + cacheCreation + output + reasoning;
        const total = explicitTotal > 0n ? explicitTotal : computedTotal;

        rows.push({
          user_id: ctx.user_id,
          device_id: ctx.device_id,
          source,
          model,
          hour_start: b.hour_start,
          input_tokens: input.toString(),
          cached_input_tokens: cached.toString(),
          cache_creation_input_tokens: cacheCreation.toString(),
          output_tokens: output.toString(),
          reasoning_output_tokens: reasoning.toString(),
          total_tokens: total.toString(),
          conversation_count: typeof b.conversation_count === 'number' ? Math.max(0, Math.floor(b.conversation_count)) : 0,
        });
      }

      // Ensure partitions exist for each unique month in the batch.
      const months = new Set<string>(rows.map((r) => (r.hour_start as string).slice(0, 7) + '-01'));
      for (const m of months) {
        await sql`select tb_ensure_usage_partition(${m}::date)`.execute(app.db);
      }

      // Note: we can't use the `xmax = 0` trick to detect inserts here —
      // partitioned tables don't expose system columns through partitions.
      // Instead, compare created_at vs updated_at on the returned rows.
      const result = await app.db
        .insertInto('tb_usage_buckets')
        .values(rows as never)
        .onConflict((oc) =>
          oc
            .columns(['user_id', 'device_id', 'source', 'model', 'hour_start'])
            .doUpdateSet({
              input_tokens: (eb) => eb.ref('excluded.input_tokens'),
              cached_input_tokens: (eb) => eb.ref('excluded.cached_input_tokens'),
              cache_creation_input_tokens: (eb) => eb.ref('excluded.cache_creation_input_tokens'),
              output_tokens: (eb) => eb.ref('excluded.output_tokens'),
              reasoning_output_tokens: (eb) => eb.ref('excluded.reasoning_output_tokens'),
              total_tokens: (eb) => eb.ref('excluded.total_tokens'),
              conversation_count: (eb) => eb.ref('excluded.conversation_count'),
              updated_at: new Date(),
            }),
        )
        .returning(['id', 'created_at', 'updated_at'])
        .execute();

      let inserted = 0;
      for (const r of result) {
        const c = new Date(r.created_at as unknown as string).getTime();
        const u = new Date(r.updated_at as unknown as string).getTime();
        // Allow a 1ms window — same INSERT sets both columns to the same NOW().
        if (Math.abs(c - u) < 2) inserted += 1;
      }
      const skipped = result.length - inserted;

      // Subscriptions
      if (Array.isArray(body.device_subscriptions) && body.device_subscriptions.length > 0) {
        const subs = body.device_subscriptions
          .filter((s) => s && typeof s === 'object' && s.tool && s.provider && s.product)
          .map((s) => ({
            user_id: ctx.user_id,
            tool: String(s.tool),
            provider: String(s.provider),
            product: String(s.product),
            plan_type: s.plan_type ?? null,
            rate_limit_tier: s.rate_limit_tier ?? null,
            observed_at: new Date(),
          }));
        if (subs.length > 0) {
          await app.db
            .insertInto('tb_device_subscriptions')
            .values(subs as never)
            .onConflict((oc) =>
              oc.columns(['user_id', 'tool', 'provider', 'product']).doUpdateSet({
                plan_type: (eb) => eb.ref('excluded.plan_type'),
                rate_limit_tier: (eb) => eb.ref('excluded.rate_limit_tier'),
                observed_at: (eb) => eb.ref('excluded.observed_at'),
              }),
            )
            .execute();
        }
      }

      // Heartbeat
      await app.db
        .insertInto('tb_sync_pings')
        .values({ user_id: ctx.user_id, device_id: ctx.device_id, last_sync_at: new Date() })
        .onConflict((oc) =>
          oc.columns(['user_id', 'device_id']).doUpdateSet({ last_sync_at: (eb) => eb.ref('excluded.last_sync_at') }),
        )
        .execute();

      return { success: true as const, inserted, skipped };
    },
  );

  app.post('/sync-ping', { preHandler: app.requireDevice }, async (req) => {
    const ctx = req.deviceContext!;
    const now = new Date();
    await app.db
      .insertInto('tb_sync_pings')
      .values({ user_id: ctx.user_id, device_id: ctx.device_id, last_sync_at: now })
      .onConflict((oc) =>
        oc.columns(['user_id', 'device_id']).doUpdateSet({ last_sync_at: (eb) => eb.ref('excluded.last_sync_at') }),
      )
      .execute();
    return { success: true as const, last_sync_at: now.toISOString() };
  });
}

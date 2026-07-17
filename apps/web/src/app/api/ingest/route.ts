import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { bearerFrom, verifyDeviceToken } from '@/lib/auth/device';
import { isHalfHourBoundary, isKnownSource, SOURCES, UsageBucket } from '@/lib/contract';
import { query } from '@/lib/db/client';
import { estimateCostUsd } from '@/lib/pricing';

const TokenTotalsSchema = z.object({
  input_tokens: z.number().int().min(0),
  cached_input_tokens: z.number().int().min(0),
  cache_creation_input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
  reasoning_output_tokens: z.number().int().min(0),
  total_tokens: z.number().int().min(0),
  billable_total_tokens: z.number().int().min(0),
});

const UsageBucketSchema = TokenTotalsSchema.extend({
  source: z.string().transform((s) => (isKnownSource(s) ? s : 'other')),
  model: z.string(),
  hour_start: z.string().refine(isHalfHourBoundary, 'hour_start must be a UTC half-hour boundary'),
  conversation_count: z.number().int().min(0),
}).strict();

const IngestPayloadSchema = z
  .object({
    device_id: z.string().optional(),
    buckets: z.array(UsageBucketSchema).max(500),
  })
  .strict();

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const rawToken = bearerFrom(authHeader);
  const identity = await verifyDeviceToken(rawToken);

  if (!identity) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = IngestPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { buckets } = parsed.data;
  const { userId, deviceId } = identity;

  await query(
    `INSERT INTO tb_user_profiles (user_id, email)
     VALUES ($1, $1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );

  for (const bucket of buckets) {
    const costUsd = estimateCostUsd(bucket.model, bucket);

    await query(
      `INSERT INTO tb_usage_buckets (
        user_id, device_id, source, model, hour_start,
        input_tokens, cached_input_tokens, cache_creation_input_tokens,
        output_tokens, reasoning_output_tokens, total_tokens, billable_total_tokens,
        total_cost_usd, conversation_count, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())
      ON CONFLICT (user_id, device_id, source, model, hour_start) DO UPDATE SET
        input_tokens = EXCLUDED.input_tokens,
        cached_input_tokens = EXCLUDED.cached_input_tokens,
        cache_creation_input_tokens = EXCLUDED.cache_creation_input_tokens,
        output_tokens = EXCLUDED.output_tokens,
        reasoning_output_tokens = EXCLUDED.reasoning_output_tokens,
        total_tokens = EXCLUDED.total_tokens,
        billable_total_tokens = EXCLUDED.billable_total_tokens,
        total_cost_usd = EXCLUDED.total_cost_usd,
        conversation_count = EXCLUDED.conversation_count,
        updated_at = now()`,
      [
        userId,
        deviceId,
        bucket.source,
        bucket.model,
        bucket.hour_start,
        bucket.input_tokens,
        bucket.cached_input_tokens,
        bucket.cache_creation_input_tokens,
        bucket.output_tokens,
        bucket.reasoning_output_tokens,
        bucket.total_tokens,
        bucket.billable_total_tokens,
        costUsd,
        bucket.conversation_count,
      ],
    );
  }

  await query(
    `UPDATE tb_devices SET last_seen_at = now() WHERE id = $1`,
    [deviceId],
  );

  return NextResponse.json({ accepted: buckets.length });
}

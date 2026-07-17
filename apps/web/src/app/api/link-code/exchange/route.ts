import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { generateDeviceToken, hashToken } from '@/lib/auth/device';
import { query } from '@/lib/db/client';

const RequestSchema = z
  .object({
    code: z.string().length(6),
    device_name: z.string().min(1),
    platform: z.string().optional(),
    machine_id: z.string().optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { code, device_name, platform, machine_id } = parsed.data;

  const linkCode = await query<{
    user_id: string;
    email: string;
    expires_at: string;
    consumed_at: string | null;
  }>(
    `SELECT user_id, email, expires_at, consumed_at
     FROM tb_link_codes
     WHERE code = $1`,
    [code],
  );

  if (linkCode.length === 0) {
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
  }

  const lc = linkCode[0];
  if (lc.consumed_at) {
    return NextResponse.json({ error: 'Code already used' }, { status: 400 });
  }

  if (new Date(lc.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Code expired' }, { status: 400 });
  }

  const userId = lc.user_id;

  await query(
    `UPDATE tb_link_codes SET consumed_at = now() WHERE code = $1`,
    [code],
  );

  await query(
    `INSERT INTO tb_user_profiles (user_id, email, display_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET
       display_name = COALESCE(tb_user_profiles.display_name, EXCLUDED.display_name),
       updated_at = now()`,
    [userId, lc.email, lc.email.split('@')[0]],
  );

  const existingDevice = await query<{ id: string }>(
    `SELECT id FROM tb_devices
     WHERE user_id = $1 AND (machine_id = $2 OR device_name = $3) AND revoked_at IS NULL
     LIMIT 1`,
    [userId, machine_id || null, device_name],
  );

  let deviceId: string;
  if (existingDevice.length > 0) {
    deviceId = existingDevice[0].id;
    await query(
      `UPDATE tb_devices SET device_name = $1, platform = $2, machine_id = $3, last_seen_at = now()
       WHERE id = $4`,
      [device_name, platform, machine_id, deviceId],
    );
  } else {
    const newDevice = await query<{ id: string }>(
      `INSERT INTO tb_devices (user_id, device_name, platform, machine_id, last_seen_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING id`,
      [userId, device_name, platform, machine_id],
    );
    deviceId = newDevice[0].id;
  }

  const rawToken = generateDeviceToken();
  const tokenHash = hashToken(rawToken);

  await query(
    `INSERT INTO tb_device_tokens (token_hash, device_id, user_id, last_used_at)
     VALUES ($1, $2, $3, now())`,
    [tokenHash, deviceId, userId],
  );

  return NextResponse.json({ token: rawToken, device_id: deviceId, user_id: userId });
}

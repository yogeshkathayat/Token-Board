import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getCompanyUser, userIdFor } from '@/lib/auth/company';
import { generateDeviceToken, hashToken } from '@/lib/auth/device';
import { query } from '@/lib/db/client';

const RequestSchema = z
  .object({
    device_name: z.string().min(1),
    platform: z.string().optional(),
    machine_id: z.string().optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const user = await getCompanyUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  const { device_name, platform, machine_id } = parsed.data;
  const userId = userIdFor(user);

  await query(
    `INSERT INTO tb_user_profiles (user_id, email, display_name, avatar_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       display_name = COALESCE(tb_user_profiles.display_name, EXCLUDED.display_name),
       avatar_url = COALESCE(tb_user_profiles.avatar_url, EXCLUDED.avatar_url),
       updated_at = now()`,
    [userId, user.email, user.name, user.image],
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

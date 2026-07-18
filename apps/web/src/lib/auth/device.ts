import { createHash, randomBytes } from 'node:crypto';

import 'server-only';

import { query } from '@/lib/db/client';

export interface DeviceIdentity {
  userId: string;
  deviceId: string;
}

/** sha256 hex of a raw device token. The CLI never sends the raw token anywhere it is stored. */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

/** Generate a fresh opaque device token (returned to the CLI exactly once). */
export function generateDeviceToken(): string {
  return randomBytes(32).toString('hex');
}

/** Extract a Bearer token from an Authorization header value. */
export function bearerFrom(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return m ? m[1].trim() : null;
}

/**
 * Resolve a raw device token to its owning (userId, deviceId), or null if unknown/revoked.
 * Updates last_used_at on success.
 */
export async function verifyDeviceToken(rawToken: string | null): Promise<DeviceIdentity | null> {
  if (!rawToken) return null;
  const rows = await query<{ user_id: string; device_id: string }>(
    `UPDATE tb_device_tokens
        SET last_used_at = now()
      WHERE token_hash = $1 AND revoked_at IS NULL
      RETURNING user_id, device_id`,
    [hashToken(rawToken)],
  );
  if (rows.length === 0) return null;
  return { userId: rows[0].user_id, deviceId: rows[0].device_id };
}

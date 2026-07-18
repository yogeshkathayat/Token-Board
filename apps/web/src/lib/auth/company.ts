import 'server-only';

import { isAllowedEmail } from '@/lib/contract';
import { query } from '@/lib/db/client';
import { User } from '@/types/auth';

import { bearerFrom, verifyDeviceToken } from './device';
import { getCurrentUser } from './server';

export function getAllowedDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function isCompanyEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return isAllowedEmail(email, getAllowedDomains());
}

/**
 * The current browser user IFF they belong to an allowed company domain, else null.
 * Use in page/server-component guards and browser-session API routes.
 */
export async function getCompanyUser(): Promise<User | null> {
  const user = await getCurrentUser();
  if (!user?.email) return null;
  return isCompanyEmail(user.email) ? user : null;
}

/** Stable per-user id derived from the session (email is the durable external key). */
export function userIdFor(user: User): string {
  return user.id || user.email;
}

/** True iff the stored profile for this user id has a company-domain email. */
export async function isCompanyUserId(userId: string): Promise<boolean> {
  const rows = await query<{ email: string }>(
    'SELECT email FROM tb_user_profiles WHERE user_id = $1',
    [userId],
  );
  return rows.length > 0 && isCompanyEmail(rows[0].email);
}

/**
 * Resolve the acting user for endpoints served to BOTH the dashboard (browser session) and
 * native clients (the CLI/menu-bar device token). Prefers a valid company device token;
 * otherwise falls back to the browser session. Returns null if neither authenticates.
 */
export async function resolveActingUserId(authHeader: string | null): Promise<string | null> {
  const raw = bearerFrom(authHeader);
  if (raw) {
    const identity = await verifyDeviceToken(raw);
    if (identity && (await isCompanyUserId(identity.userId))) {
      return identity.userId;
    }
  }
  const user = await getCompanyUser();
  return user ? userIdFor(user) : null;
}

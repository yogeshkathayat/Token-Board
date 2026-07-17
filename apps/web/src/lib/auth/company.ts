import 'server-only';

import { isAllowedEmail } from '@/lib/contract';
import { User } from '@/types/auth';

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

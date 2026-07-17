'use client';

import { getAuthDeskUrl } from '@/lib/auth/shared';

/**
 * Sign out by
 * - deleting 'next-auth.session-token' cookie
 * - and then redirecting to auth desk
 */
export function signOut() {
  document.cookie = 'next-auth.session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';

  const authDeskUrl = getAuthDeskUrl();
  window.location.href = `${authDeskUrl}/auth/signout`;
}

/**
 * Sign in by redirecting to auth desk
 */
export function signIn(callbackUrl?: string) {
  const authDeskUrl = getAuthDeskUrl();
  const callback = callbackUrl || window.location.href;
  window.location.href = `${authDeskUrl}/auth/signin?callbackUrl=${encodeURIComponent(callback)}`;
}

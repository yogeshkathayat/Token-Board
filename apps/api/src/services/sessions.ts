import { db } from '../db/index.js';
import { config } from '../config.js';
import { generateOpaqueToken, hashToken } from '../auth/tokens.js';

const REFRESH_COOKIE = 'ut_refresh';

export interface RefreshIssue {
  refreshToken: string;
  expiresAt: Date;
}

export async function issueRefreshToken(input: {
  userId: string;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<RefreshIssue> {
  const { token, hash } = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + config.refreshTtlSeconds * 1000);
  await db
    .insertInto('tb_sessions')
    .values({
      user_id: input.userId,
      refresh_token_hash: hash,
      user_agent: input.userAgent ?? null,
      ip: input.ip ?? null,
      expires_at: expiresAt,
    })
    .execute();
  return { refreshToken: token, expiresAt };
}

export async function rotateRefreshToken(refreshToken: string): Promise<{
  userId: string;
  newRefreshToken: string;
  expiresAt: Date;
} | null> {
  const oldHash = hashToken(refreshToken);
  return db.transaction().execute(async (trx) => {
    const session = await trx
      .selectFrom('tb_sessions')
      .select(['id', 'user_id', 'expires_at'])
      .where('refresh_token_hash', '=', oldHash)
      .executeTakeFirst();
    if (!session) return null;
    if (new Date(session.expires_at as unknown as string).getTime() < Date.now()) return null;

    await trx.deleteFrom('tb_sessions').where('id', '=', session.id).execute();

    const { token, hash } = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + config.refreshTtlSeconds * 1000);
    await trx
      .insertInto('tb_sessions')
      .values({
        user_id: session.user_id,
        refresh_token_hash: hash,
        expires_at: expiresAt,
      })
      .execute();
    return { userId: session.user_id, newRefreshToken: token, expiresAt };
  });
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const hash = hashToken(refreshToken);
  await db.deleteFrom('tb_sessions').where('refresh_token_hash', '=', hash).execute();
}

export const REFRESH_COOKIE_NAME = REFRESH_COOKIE;

export function refreshCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'lax' as const,
    path: '/api/v1/auth',
    expires: expiresAt,
  };
}

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { deviceHashFromSha256, deviceHashFromToken, hashToken } from './tokens.js';
import { verifyAccessToken, type AccessTokenPayload } from './jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AccessTokenPayload;
    deviceContext?: { user_id: string; device_id: string };
  }
  interface FastifyInstance {
    requireUser: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireInteractive: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireDevice: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalUser: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

function extractBearer(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (!h || typeof h !== 'string') return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1]!.trim() : null;
}

function isJwtShaped(token: string): boolean {
  return token.split('.').length === 3;
}

/**
 * Resolve a Bearer token to an authenticated user. Accepts both:
 *   - JWT (3 dot-separated segments) — verified via HS256
 *   - opaque personal access token — sha256-hashed, looked up in tb_personal_tokens
 *
 * Returns null on miss; populates req.authUser with the same shape used by
 * JWT-issued tokens so downstream code doesn't need to care which it is.
 */
async function resolveAuthUser(
  app: FastifyInstance,
  req: FastifyRequest,
): Promise<AccessTokenPayload | null> {
  const token = extractBearer(req);
  if (!token) return null;

  if (isJwtShaped(token)) {
    return verifyAccessToken(token);
  }

  const hash = hashToken(token);
  const row = await app.db
    .selectFrom('tb_personal_tokens')
    .innerJoin('tb_users', 'tb_users.id', 'tb_personal_tokens.user_id')
    .select([
      'tb_personal_tokens.id as pt_id',
      'tb_personal_tokens.user_id',
      'tb_personal_tokens.expires_at',
      'tb_personal_tokens.revoked_at',
      'tb_users.email',
      'tb_users.role',
    ])
    .where('tb_personal_tokens.token_hash', '=', hash)
    .executeTakeFirst();

  if (!row) return null;
  if (row.revoked_at) return null;
  if (new Date(row.expires_at as unknown as string).getTime() < Date.now()) return null;

  // Best-effort last_used_at update — fire-and-forget.
  app.db
    .updateTable('tb_personal_tokens')
    .set({ last_used_at: new Date() })
    .where('id', '=', row.pt_id)
    .executeTakeFirst()
    .catch((err) => req.log.warn({ err }, 'failed to update personal token last_used_at'));

  const now = Math.floor(Date.now() / 1000);
  return {
    sub: row.user_id,
    email: row.email,
    role: row.role,
    iat: now,
    exp: now + 3600, // synthetic; real expiry checked above against the row's expires_at
    jti: row.pt_id,
    pat: true,
  };
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.decorate('requireUser', async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = await resolveAuthUser(app, req);
    if (!payload) {
      await reply.code(401).send({ error: 'Unauthorized', message: 'Missing or invalid token' });
      return;
    }
    req.authUser = payload;
  });

  // Like requireUser, but rejects personal-access-token bearers. Use on routes
  // that mint new credentials so a leaked PAT can't be used to mint more
  // (device tokens, further PATs, link codes) — privilege containment.
  app.decorate('requireInteractive', async (req: FastifyRequest, reply: FastifyReply) => {
    await app.requireUser(req, reply);
    if (reply.sent) return;
    if (req.authUser?.pat) {
      await reply.code(403).send({
        error: 'Forbidden',
        message: 'This action requires an interactive session, not a personal access token',
      });
    }
  });

  app.decorate('requireAdmin', async (req: FastifyRequest, reply: FastifyReply) => {
    await app.requireUser(req, reply);
    if (reply.sent) return;
    if (req.authUser?.role !== 'admin') {
      await reply.code(403).send({ error: 'Forbidden', message: 'Admin only' });
      return;
    }
    // A long-lived personal access token (used by the menu bar etc.) must not
    // unlock admin operations even if minted by an admin — a leaked PAT would
    // otherwise grant full admin API access. Admin actions require a session JWT.
    if (req.authUser?.pat) {
      await reply.code(403).send({ error: 'Forbidden', message: 'Admin actions require an interactive session, not a personal access token' });
    }
  });

  app.decorate('optionalUser', async (req: FastifyRequest) => {
    const payload = await resolveAuthUser(app, req);
    if (payload) req.authUser = payload;
  });

  app.decorate('requireDevice', async (req: FastifyRequest, reply: FastifyReply) => {
    const proxyHash = req.headers['x-tokenboard-device-token-hash'];
    let hash: string | null = null;

    if (typeof proxyHash === 'string' && /^[a-f0-9]{64}$/i.test(proxyHash)) {
      // The proxy forwards sha256(token); pepper it before lookup (see tokens.ts).
      hash = deviceHashFromSha256(proxyHash);
    } else {
      const token = extractBearer(req);
      if (!token) {
        await reply.code(401).send({ error: 'Unauthorized', message: 'Missing device token' });
        return;
      }
      if (isJwtShaped(token)) {
        await reply.code(401).send({ error: 'Unauthorized', message: 'Expected device token' });
        return;
      }
      hash = deviceHashFromToken(token);
    }

    const row = await app.db
      .selectFrom('tb_devices')
      .select(['id', 'user_id', 'revoked_at'])
      .where('token_hash', '=', hash)
      .executeTakeFirst();

    if (!row || row.revoked_at) {
      await reply.code(401).send({ error: 'Unauthorized', message: 'Invalid device token' });
      return;
    }

    req.deviceContext = { user_id: row.user_id, device_id: row.id };

    app.db
      .updateTable('tb_devices')
      .set({ last_seen_at: new Date() })
      .where('id', '=', row.id)
      .executeTakeFirst()
      .catch((err) => req.log.warn({ err }, 'failed to update device last_seen_at'));
  });
});

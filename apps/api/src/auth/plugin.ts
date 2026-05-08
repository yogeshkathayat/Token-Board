import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { hashToken } from './tokens.js';
import { verifyAccessToken, type AccessTokenPayload } from './jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AccessTokenPayload;
    deviceContext?: { user_id: string; device_id: string };
  }
  interface FastifyInstance {
    requireUser: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
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

export const authPlugin = fp(async (app: FastifyInstance) => {
  // Require a valid user JWT. Sets req.authUser.
  app.decorate('requireUser', async (req: FastifyRequest, reply: FastifyReply) => {
    const token = extractBearer(req);
    const payload = token ? verifyAccessToken(token) : null;
    if (!payload) {
      await reply.code(401).send({ error: 'Unauthorized', message: 'Missing or invalid token' });
      return;
    }
    req.authUser = payload;
  });

  app.decorate('requireAdmin', async (req: FastifyRequest, reply: FastifyReply) => {
    await app.requireUser(req, reply);
    if (reply.sent) return;
    if (req.authUser?.role !== 'admin') {
      await reply.code(403).send({ error: 'Forbidden', message: 'Admin only' });
    }
  });

  // Optional auth — sets req.authUser if present but doesn't reject.
  app.decorate('optionalUser', async (req: FastifyRequest) => {
    const token = extractBearer(req);
    if (!token) return;
    const payload = verifyAccessToken(token);
    if (payload) req.authUser = payload;
  });

  // Require a valid device token. The proxy may have already hashed it for
  // us via the `x-tokenboard-device-token-hash` header — if so, we trust
  // that hash directly. Otherwise we hash the bearer ourselves.
  app.decorate('requireDevice', async (req: FastifyRequest, reply: FastifyReply) => {
    const proxyHash = req.headers['x-tokenboard-device-token-hash'];
    let hash: string | null = null;

    if (typeof proxyHash === 'string' && /^[a-f0-9]{64}$/i.test(proxyHash)) {
      hash = proxyHash.toLowerCase();
    } else {
      const token = extractBearer(req);
      if (!token) {
        await reply.code(401).send({ error: 'Unauthorized', message: 'Missing device token' });
        return;
      }
      // JWT-shaped tokens are user JWTs, not device tokens — reject here.
      if (token.split('.').length === 3) {
        await reply.code(401).send({ error: 'Unauthorized', message: 'Expected device token' });
        return;
      }
      hash = hashToken(token);
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

    // Best-effort last_seen_at update — fire and forget.
    app.db
      .updateTable('tb_devices')
      .set({ last_seen_at: new Date() })
      .where('id', '=', row.id)
      .executeTakeFirst()
      .catch((err) => req.log.warn({ err }, 'failed to update device last_seen_at'));
  });
});

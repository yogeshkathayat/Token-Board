import type { FastifyInstance } from 'fastify';

import { config, isOidcConfigured } from '../config.js';
import { issueAccessToken } from '../auth/jwt.js';
import { generateLinkCode, generateOpaqueToken, hashToken } from '../auth/tokens.js';
import {
  REFRESH_COOKIE_NAME,
  issueRefreshToken,
  refreshCookieOptions,
  revokeRefreshToken,
  rotateRefreshToken,
} from '../services/sessions.js';
import {
  createPasswordUser,
  findOrCreateOidcUser,
  findUserById,
  verifyPassword,
} from '../services/users.js';
import { buildAuthRequest, handleCallback } from '../services/oidc.js';

const OIDC_STATE_COOKIE = 'ut_oidc_state';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const limit = {
    rateLimit: { max: config.authRateMax, timeWindow: config.authRateWindowMs },
  };

  app.get('/config', async () => ({
    oidc_enabled: isOidcConfigured(),
    password_signup: config.allowPasswordSignup,
    allowed_email_domains: config.allowedEmailDomains,
  }));

  // ---------- Email + password ----------
  app.post('/signup', { config: limit }, async (req, reply) => {
    if (!config.allowPasswordSignup) {
      return reply.code(403).send({ error: 'Forbidden', message: 'Password signup disabled' });
    }
    const body = req.body as { email?: string; password?: string; display_name?: string };
    if (!body?.email || !body?.password || body.password.length < 8) {
      return reply.code(400).send({ error: 'BadRequest', message: 'email and password (≥8 chars) required' });
    }
    try {
      const user = await createPasswordUser({
        email: body.email,
        password: body.password,
        displayName: body.display_name ?? null,
      });
      const accessToken = issueAccessToken(user);
      const refresh = await issueRefreshToken({
        userId: user.id,
        userAgent: req.headers['user-agent'] ?? null,
        ip: req.ip,
      });
      reply.setCookie(REFRESH_COOKIE_NAME, refresh.refreshToken, refreshCookieOptions(refresh.expiresAt));
      return { access_token: accessToken, user };
    } catch (err) {
      const e = err as { code?: string; statusCode?: number; message?: string };
      if (e.code === '23505') {
        return reply.code(409).send({ error: 'Conflict', message: 'Email already in use' });
      }
      if (e.statusCode === 403) return reply.code(403).send({ error: 'Forbidden', message: e.message });
      throw err;
    }
  });

  app.post('/login', { config: limit }, async (req, reply) => {
    const body = req.body as { email?: string; password?: string };
    if (!body?.email || !body?.password) {
      return reply.code(400).send({ error: 'BadRequest', message: 'email and password required' });
    }
    const user = await verifyPassword(body.email, body.password);
    if (!user) return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
    const accessToken = issueAccessToken(user);
    const refresh = await issueRefreshToken({
      userId: user.id,
      userAgent: req.headers['user-agent'] ?? null,
      ip: req.ip,
    });
    reply.setCookie(REFRESH_COOKIE_NAME, refresh.refreshToken, refreshCookieOptions(refresh.expiresAt));
    return {
      access_token: accessToken,
      user: { id: user.id, email: user.email, display_name: user.display_name, role: user.role },
    };
  });

  app.post('/refresh', { config: limit }, async (req, reply) => {
    const cookie = req.cookies[REFRESH_COOKIE_NAME];
    if (!cookie) return reply.code(401).send({ error: 'Unauthorized', message: 'No refresh cookie' });
    const rotated = await rotateRefreshToken(cookie);
    if (!rotated) return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid refresh' });
    const user = await findUserById(rotated.userId);
    if (!user) return reply.code(401).send({ error: 'Unauthorized', message: 'User not found' });
    reply.setCookie(REFRESH_COOKIE_NAME, rotated.newRefreshToken, refreshCookieOptions(rotated.expiresAt));
    return { access_token: issueAccessToken(user), user };
  });

  app.post('/logout', async (req, reply) => {
    const cookie = req.cookies[REFRESH_COOKIE_NAME];
    if (cookie) await revokeRefreshToken(cookie);
    reply.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
    return { ok: true };
  });

  // ---------- OIDC ----------
  app.get('/oidc/start', { config: limit }, async (req, reply) => {
    if (!isOidcConfigured()) {
      return reply.code(501).send({ error: 'NotImplemented', message: 'OIDC not configured' });
    }
    const r = await buildAuthRequest();
    reply.setCookie(
      OIDC_STATE_COOKIE,
      JSON.stringify({ state: r.state, nonce: r.nonce, code_verifier: r.codeVerifier }),
      {
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: 'lax',
        path: '/api/v1/auth/oidc',
        maxAge: 600,
        signed: true,
      },
    );
    return reply.redirect(r.authorizeUrl, 302);
  });

  app.get('/oidc/callback', async (req, reply) => {
    const query = req.query as { code?: string; state?: string };
    const signed = req.cookies[OIDC_STATE_COOKIE];
    const unsigned = signed ? req.unsignCookie(signed) : { valid: false, value: null };
    if (!query.code || !query.state || !unsigned.valid || !unsigned.value) {
      return reply.code(400).send({ error: 'BadRequest', message: 'Invalid OIDC state' });
    }
    let parsed: { state: string; nonce: string; code_verifier: string };
    try {
      parsed = JSON.parse(unsigned.value);
    } catch {
      return reply.code(400).send({ error: 'BadRequest', message: 'Malformed OIDC state' });
    }
    const info = await handleCallback({
      code: query.code,
      state: query.state,
      expectedState: parsed.state,
      expectedNonce: parsed.nonce,
      codeVerifier: parsed.code_verifier,
    });
    const user = await findOrCreateOidcUser({
      provider: 'oidc',
      sub: info.sub,
      email: info.email,
      displayName: info.name,
      avatarUrl: info.picture,
    });
    const accessToken = issueAccessToken(user);
    const refresh = await issueRefreshToken({
      userId: user.id,
      userAgent: req.headers['user-agent'] ?? null,
      ip: req.ip,
    });
    reply.setCookie(REFRESH_COOKIE_NAME, refresh.refreshToken, refreshCookieOptions(refresh.expiresAt));
    reply.clearCookie(OIDC_STATE_COOKIE, { path: '/api/v1/auth/oidc' });
    return reply.redirect(`${config.publicUrl}/auth/callback#access_token=${accessToken}`, 302);
  });

  // ---------- Profile ----------
  app.get('/me', { preHandler: app.requireUser }, async (req) => {
    const user = await findUserById(req.authUser!.sub);
    return { user };
  });

  // ---------- Device tokens (for the CLI) ----------
  app.post('/device-token', { preHandler: app.requireUser }, async (req, reply) => {
    const body = (req.body as { device_name?: string; platform?: string }) ?? {};
    const { token, hash } = generateOpaqueToken();
    const inserted = await app.db
      .insertInto('tb_devices')
      .values({
        user_id: req.authUser!.sub,
        name: body.device_name ?? 'unnamed',
        platform: body.platform ?? null,
        token_hash: hash,
      })
      .returning(['id', 'created_at'])
      .executeTakeFirstOrThrow();
    return reply.send({ device_id: inserted.id, token, created_at: inserted.created_at });
  });

  // ---------- Link code (CLI ↔ browser handshake) ----------
  app.post('/link-code-init', { preHandler: app.requireUser }, async (req) => {
    const code = generateLinkCode();
    const expiresAt = new Date(Date.now() + config.linkCodeTtlSeconds * 1000);
    await app.db
      .insertInto('tb_link_codes')
      .values({
        code,
        user_id: req.authUser!.sub,
        expires_at: expiresAt,
      })
      .execute();
    return { link_code: code, expires_at: expiresAt.toISOString() };
  });

  app.post('/link-code-exchange', { config: limit }, async (req, reply) => {
    const body = req.body as { link_code?: string; request_id?: string; device_name?: string; platform?: string };
    if (!body?.link_code || !body?.request_id) {
      return reply.code(400).send({ error: 'BadRequest', message: 'link_code and request_id required' });
    }
    const result = await app.db.transaction().execute(async (trx) => {
      const row = await trx
        .selectFrom('tb_link_codes')
        .select(['code', 'user_id', 'expires_at', 'used_at', 'request_id', 'issued_token_hash'])
        .where('code', '=', body.link_code!.toUpperCase())
        .forUpdate()
        .executeTakeFirst();
      if (!row) return { status: 404 as const };
      if (new Date(row.expires_at as unknown as string).getTime() < Date.now()) return { status: 400 as const };
      // Idempotent retry: same request_id returns the previously issued device token's hash so the CLI can
      // surface a clear error (we can't re-issue the same opaque token).
      if (row.used_at) {
        if (row.request_id === body.request_id) {
          return { status: 409 as const, message: 'Code already redeemed (retry not idempotent across opaque tokens)' };
        }
        return { status: 409 as const };
      }
      const { token, hash } = generateOpaqueToken();
      const device = await trx
        .insertInto('tb_devices')
        .values({
          user_id: row.user_id,
          name: body.device_name ?? 'unnamed',
          platform: body.platform ?? null,
          token_hash: hash,
        })
        .returning(['id'])
        .executeTakeFirstOrThrow();
      await trx
        .updateTable('tb_link_codes')
        .set({ used_at: new Date(), request_id: body.request_id, issued_token_hash: hash })
        .where('code', '=', row.code)
        .execute();
      return { status: 200 as const, token, device_id: device.id, user_id: row.user_id };
    });
    if (result.status === 200) {
      return { token: result.token, device_id: result.device_id, user_id: result.user_id };
    }
    return reply.code(result.status).send({
      error: result.status === 404 ? 'NotFound' : result.status === 400 ? 'Expired' : 'Conflict',
      message: 'message' in result ? result.message : undefined,
    });
  });
}

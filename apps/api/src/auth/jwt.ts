/**
 * Minimal HS256 JWT issuer/verifier. We avoid a third-party JWT library to
 * keep the dependency surface small — the spec is simple and we only ever
 * issue/verify our own tokens (no algorithm negotiation).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

import { config } from '../config.js';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: 'user' | 'admin';
  iat: number;
  exp: number;
  jti: string;
  /** True when this principal was resolved from a personal access token rather than a session JWT. */
  pat?: boolean;
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf) : buf;
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function sign(input: string): string {
  return b64url(createHmac('sha256', config.jwtSecret).update(input).digest());
}

export function issueAccessToken(user: { id: string; email: string; role: 'user' | 'admin' }): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + config.jwtTtlSeconds,
    jti: crypto.randomUUID(),
  };
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = sign(`${header}.${body}`);
  return `${header}.${body}.${sig}`;
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts as [string, string, string];
  const expected = sign(`${header}.${body}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body).toString('utf8')) as AccessTokenPayload;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

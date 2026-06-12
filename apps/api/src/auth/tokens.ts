import { createHash, createHmac, randomBytes } from 'node:crypto';

import { config } from '../config.js';

/**
 * Generate a 32-byte URL-safe random token. Used for refresh tokens, personal
 * access tokens, and device tokens. Returns `{ token, hash }` — only the hash
 * is persisted.
 */
export function generateOpaqueToken(): { token: string; hash: string } {
  const buf = randomBytes(32);
  const token = buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Device tokens are a special case: the nginx proxy forwards `sha256(token)`
 * (not the raw token) so the secret stays out of API logs. If we stored that
 * same sha256 at rest, the stored hash would itself be a replayable credential
 * — anyone who reads a DB backup could mint authenticated ingest calls. So we
 * HMAC the sha256 with a server-only pepper (JWT_SECRET, which never lives in
 * the DB) before storing/comparing. The wire value (sha256) cannot be derived
 * back from the stored value, so a leaked stored hash is not replayable.
 */
export function deviceHashFromSha256(sha256Hex: string): string {
  return createHmac('sha256', config.jwtSecret).update(sha256Hex.toLowerCase()).digest('hex');
}

export function deviceHashFromToken(token: string): string {
  return deviceHashFromSha256(hashToken(token));
}

/**
 * Generate a short, human-friendly link code for the CLI ↔ browser handshake.
 * 6 characters from an unambiguous alphabet (no 0/O/1/I/L). Long enough that
 * brute force at the rate-limited exchange endpoint is infeasible within the
 * 10-minute TTL.
 */
const LINK_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function generateLinkCode(length = 6): string {
  const buf = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += LINK_CODE_ALPHABET[buf[i]! % LINK_CODE_ALPHABET.length];
  }
  return out;
}

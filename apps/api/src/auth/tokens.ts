import { createHash, randomBytes } from 'node:crypto';

/**
 * Generate a 32-byte URL-safe random token. Used for refresh tokens and
 * device tokens. Returns `{ token, hash }` — only the hash is persisted.
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

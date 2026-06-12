import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-secret-32-bytes-long-aaaaaaaaaaaa';
process.env.DATABASE_URL = 'postgres://test/test';

const { generateOpaqueToken, hashToken, generateLinkCode, deviceHashFromToken, deviceHashFromSha256 } =
  await import('../../src/auth/tokens.js');

test('generateOpaqueToken returns matching hash', () => {
  const { token, hash } = generateOpaqueToken();
  assert.ok(token.length >= 30, 'tokens are at least 30 chars');
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hashToken(token), hash);
});

test('generateLinkCode produces 6-char codes from the safe alphabet', () => {
  for (let i = 0; i < 50; i += 1) {
    const c = generateLinkCode();
    assert.equal(c.length, 6);
    assert.match(c, /^[A-HJ-NP-Z2-9]{6}$/, `${c} should not contain ambiguous chars`);
  }
});

test('generateOpaqueToken values are not predictable', () => {
  const a = generateOpaqueToken().token;
  const b = generateOpaqueToken().token;
  assert.notEqual(a, b);
});

test('device hash is peppered: stored value differs from the wire sha256 and is non-replayable', () => {
  const { token, hash } = generateOpaqueToken();
  const stored = deviceHashFromToken(token);
  assert.match(stored, /^[a-f0-9]{64}$/);
  // The proxy/wire value is sha256(token) (== hash). The at-rest value must NOT
  // equal it, otherwise a leaked DB hash would itself be a replayable credential.
  assert.notEqual(stored, hash);
  // The proxy-hash path and the raw-token path must resolve to the same stored value.
  assert.equal(deviceHashFromSha256(hash), stored);
  // Deterministic for a given token.
  assert.equal(deviceHashFromToken(token), stored);
});

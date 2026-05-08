import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-secret-32-bytes-long-aaaaaaaaaaaa';
process.env.DATABASE_URL = 'postgres://test/test';

const { issueAccessToken, verifyAccessToken } = await import('../../src/auth/jwt.js');

test('issued token round-trips through verify', () => {
  const t = issueAccessToken({ id: 'u1', email: 'a@b.c', role: 'user' });
  const p = verifyAccessToken(t);
  assert.ok(p);
  assert.equal(p?.sub, 'u1');
  assert.equal(p?.email, 'a@b.c');
  assert.equal(p?.role, 'user');
  assert.ok(typeof p?.exp === 'number' && p.exp * 1000 > Date.now());
});

test('verify rejects forged tokens', () => {
  const t = issueAccessToken({ id: 'u1', email: 'a@b.c', role: 'user' });
  const parts = t.split('.');
  const tampered = `${parts[0]}.${parts[1]}.aaaaa`;
  assert.equal(verifyAccessToken(tampered), null);
});

test('verify rejects malformed tokens', () => {
  assert.equal(verifyAccessToken('not-a-jwt'), null);
  assert.equal(verifyAccessToken('a.b'), null);
  assert.equal(verifyAccessToken(''), null);
});

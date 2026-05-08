'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createCipheriv, createDecipheriv, randomBytes, createHash } = require('crypto');

const { paths } = require('./paths.js');

const SERVICE = 'tokenboard';
const ACCOUNT_OPENROUTER = 'openrouter';

let keytar;
function loadKeytar() {
  if (keytar !== undefined) return keytar;
  try {
    keytar = require('keytar');
  } catch {
    keytar = null;
  }
  return keytar;
}

function fallbackFile(name) {
  return path.join(paths().secretsDir, `${name}.bin`);
}

/**
 * AES-GCM encryption with a key derived from a stable per-host seed file.
 * Not as strong as the OS keychain, but it keeps the API key out of plaintext
 * disk on Linux dev machines that don't have libsecret installed.
 */
function deriveKey() {
  const seedFile = path.join(paths().secretsDir, '.seed');
  fs.mkdirSync(paths().secretsDir, { recursive: true, mode: 0o700 });
  let seed;
  try {
    seed = fs.readFileSync(seedFile);
  } catch {
    seed = randomBytes(32);
    fs.writeFileSync(seedFile, seed, { mode: 0o600 });
  }
  return createHash('sha256').update(seed).update(os.hostname()).digest();
}

function encrypt(plain) {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

function decrypt(buf) {
  const key = deriveKey();
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

async function setSecret(account, value) {
  const k = loadKeytar();
  if (k) {
    await k.setPassword(SERVICE, account, value);
    return;
  }
  fs.mkdirSync(paths().secretsDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(fallbackFile(account), encrypt(value), { mode: 0o600 });
}

async function getSecret(account) {
  const k = loadKeytar();
  if (k) {
    const v = await k.getPassword(SERVICE, account);
    if (v) return v;
    // fall through to file fallback in case the user previously saved without keytar
  }
  try {
    const buf = fs.readFileSync(fallbackFile(account));
    return decrypt(buf);
  } catch {
    return null;
  }
}

async function deleteSecret(account) {
  const k = loadKeytar();
  if (k) {
    try {
      await k.deletePassword(SERVICE, account);
    } catch {
      /* ignore */
    }
  }
  try {
    fs.unlinkSync(fallbackFile(account));
  } catch {
    /* ignore */
  }
}

async function hasSecret(account) {
  const v = await getSecret(account);
  return Boolean(v && v.length > 0);
}

module.exports = {
  setOpenRouterKey: (v) => setSecret(ACCOUNT_OPENROUTER, v),
  getOpenRouterKey: () => getSecret(ACCOUNT_OPENROUTER),
  deleteOpenRouterKey: () => deleteSecret(ACCOUNT_OPENROUTER),
  hasOpenRouterKey: () => hasSecret(ACCOUNT_OPENROUTER),
};

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseArgv } = require('../src/lib/argv.js');

test('argv: positional args go into _', () => {
  assert.deepEqual(parseArgv(['hello', 'world']), { _: ['hello', 'world'] });
});

test('argv: --flag is true', () => {
  assert.deepEqual(parseArgv(['--yes']), { _: [], yes: true });
});

test('argv: --key=value', () => {
  const r = parseArgv(['--base-url=https://x.com']);
  assert.equal(r['base-url'], 'https://x.com');
});

test('argv: --key value (separated)', () => {
  const r = parseArgv(['--link-code', 'ABC234']);
  assert.equal(r['link-code'], 'ABC234');
});

test('argv: short -y is true', () => {
  assert.equal(parseArgv(['-y']).y, true);
});

test('argv: positional + flags mix', () => {
  const r = parseArgv(['https://x.com', '--link-code', 'ABC234', '--yes']);
  assert.deepEqual(r._, ['https://x.com']);
  assert.equal(r['link-code'], 'ABC234');
  assert.equal(r.yes, true);
});

test('argv: --flag followed by another --flag does not consume it', () => {
  const r = parseArgv(['--yes', '--no-hooks']);
  assert.equal(r.yes, true);
  assert.equal(r['no-hooks'], true);
});

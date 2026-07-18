'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const cli = require(path.join(__dirname, '..', '..', '..', 'apps', 'cli', 'src', 'lib', 'buckets.js'));

// Load the web TS twin by transpiling on the fly is overkill; instead we parse the
// exported constants/behaviour we care about by re-implementing the vector check against
// the CLI twin, and separately assert the TS file declares the same SOURCES list.
const fs = require('node:fs');
const webContractSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'apps', 'web', 'src', 'lib', 'contract.ts'),
  'utf8',
);

const VECTOR = [
  '2026-07-17T14:29:59.999Z',
  '2026-07-17T14:30:00.000Z',
  '2026-07-17T14:30:01.000Z',
  '2026-07-17T00:00:00.000Z',
  '2026-07-17T23:59:59.999Z',
  '2026-01-01T12:15:30.500Z',
  1752762600000,
];

test('halfHourFloor lands on :00 or :30 boundaries', () => {
  for (const ts of VECTOR) {
    const iso = cli.halfHourFloor(ts);
    assert.ok(cli.isHalfHourBoundary(iso), `${iso} should be a half-hour boundary`);
    const m = new Date(iso).getUTCMinutes();
    assert.ok(m === 0 || m === 30);
  }
});

test('halfHourFloor rounds down, never up', () => {
  assert.equal(cli.halfHourFloor('2026-07-17T14:29:59.999Z'), '2026-07-17T14:00:00.000Z');
  assert.equal(cli.halfHourFloor('2026-07-17T14:30:00.000Z'), '2026-07-17T14:30:00.000Z');
  assert.equal(cli.halfHourFloor('2026-07-17T14:59:59.999Z'), '2026-07-17T14:30:00.000Z');
});

test('isHalfHourBoundary rejects non-boundaries', () => {
  assert.equal(cli.isHalfHourBoundary('2026-07-17T14:15:00.000Z'), false);
  assert.equal(cli.isHalfHourBoundary('2026-07-17T14:00:01.000Z'), false);
  assert.equal(cli.isHalfHourBoundary('not-a-date'), false);
});

test('CLI and web declare the same SOURCES list', () => {
  const webList = /SOURCES = \[([\s\S]*?)\]/.exec(webContractSrc);
  assert.ok(webList, 'web contract.ts must declare a SOURCES array');
  const webSources = [...webList[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual(webSources, cli.SOURCES);
});

test('invalid timestamps throw', () => {
  assert.throws(() => cli.halfHourFloor('nope'));
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderPlist, binPath, LABEL, INTERVAL } = require('../src/commands/autosync');

test('plist has the label, 5-min interval, and runs `sync`', () => {
  const p = renderPlist();
  assert.match(p, new RegExp(`<string>${LABEL}</string>`));
  assert.match(p, new RegExp(`<integer>${INTERVAL}</integer>`));
  assert.equal(INTERVAL, 300);
  assert.match(p, /<string>sync<\/string>/);
  assert.match(p, new RegExp(binPath().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(p, /<string>.*node.*<\/string>/);
});

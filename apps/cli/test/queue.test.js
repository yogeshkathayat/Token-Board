'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function freshHome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tokenboard-test-'));
  process.env.TOKENBOARD_HOME = dir;
  // Reset cached module state by purging the require cache for the lib files.
  for (const k of Object.keys(require.cache)) {
    if (k.includes('/src/lib/')) delete require.cache[k];
  }
  return dir;
}

test('queue: append and read with byte offset', () => {
  freshHome();
  const queue = require('../src/lib/queue.js');
  queue.appendBuckets([
    { hour_start: '2026-05-07T10:00:00.000Z', source: 'claude', model: 'a', total_tokens: 10 },
    { hour_start: '2026-05-07T10:30:00.000Z', source: 'claude', model: 'a', total_tokens: 20 },
  ]);
  const batch = queue.nextBatch();
  assert.equal(batch.rawCount, 2);
  assert.equal(batch.rows.length, 2);
  queue.commitOffset(batch.nextOffset);

  const second = queue.nextBatch();
  assert.equal(second.rawCount, 0, 'queue is drained');
});

test('queue: dedup by (source|model|hour_start) keeps last write', () => {
  freshHome();
  const queue = require('../src/lib/queue.js');
  queue.appendBuckets([
    { hour_start: '2026-05-07T10:00:00.000Z', source: 'claude', model: 'a', total_tokens: 10 },
    { hour_start: '2026-05-07T10:00:00.000Z', source: 'claude', model: 'a', total_tokens: 99 },
  ]);
  const batch = queue.nextBatch();
  assert.equal(batch.rows.length, 1);
  assert.equal(batch.rows[0].total_tokens, 99);
});

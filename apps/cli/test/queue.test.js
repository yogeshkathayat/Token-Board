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

test('queue: an oversized line does not wedge the queue (poison pill)', () => {
  const dir = freshHome();
  const queue = require('../src/lib/queue.js');
  const { paths } = require('../src/lib/paths.js');

  // A single line larger than the 256KB batch window, framed by two valid rows.
  const valid1 = JSON.stringify({ hour_start: '2026-05-07T10:00:00.000Z', source: 'claude', model: 'a', total_tokens: 1 });
  const poison = JSON.stringify({ hour_start: '2026-05-07T10:30:00.000Z', source: 'claude', model: 'x'.repeat(300 * 1024), total_tokens: 2 });
  const valid2 = JSON.stringify({ hour_start: '2026-05-07T11:00:00.000Z', source: 'claude', model: 'b', total_tokens: 3 });
  fs.writeFileSync(paths().queue, `${valid1}\n${poison}\n${valid2}\n`);

  // Drain like sync.js does: commit nextOffset each round until nothing is consumed.
  const seen = [];
  for (let i = 0; i < 10; i += 1) {
    const start = queue.loadQueueState().offset;
    const { rows, nextOffset, rawCount } = queue.nextBatch();
    if (nextOffset === start && rawCount === 0) break;
    for (const r of rows) seen.push(r.total_tokens);
    queue.commitOffset(nextOffset);
  }

  // Both valid rows must be delivered; the oversized line is skipped, not stuck.
  assert.ok(seen.includes(1), 'first valid row delivered');
  assert.ok(seen.includes(3), 'row after the poison line delivered');
  void dir;
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-oc-'));
process.env.OPENCODE_HOME = tmp;
const msgDir = path.join(tmp, 'storage', 'message', 'ses_1');
fs.mkdirSync(msgDir, { recursive: true });

const opencode = require('../src/parsers/opencode');

function writeMsg(id, completed, tokens, role = 'assistant') {
  fs.writeFileSync(
    path.join(msgDir, `${id}.json`),
    JSON.stringify({ id, role, modelID: 'm1', time: { created: completed - 100, completed }, tokens }),
  );
}

function collect(cursors) {
  const rows = [];
  return opencode
    .parse({ cursors, aggregate: (source, model, ts, delta) => rows.push({ source, model, delta }) })
    .then(() => rows);
}

test('opencode: reads token fields from message JSON files', async () => {
  writeMsg('msg_a', 1_700_000_000_000, { input: 100, output: 40, reasoning: 5, cache: { read: 900, write: 10 } });
  writeMsg('msg_user', 1_700_000_000_500, { input: 1 }, 'user'); // non-assistant ignored
  const rows = await collect({});
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, 'opencode');
  assert.equal(rows[0].model, 'm1');
  assert.deepEqual(rows[0].delta, {
    input_tokens: 100,
    cached_input_tokens: 900,
    cache_creation_input_tokens: 10,
    output_tokens: 40,
    reasoning_output_tokens: 5,
    total_tokens: 1055,
  });
});

test('opencode: incremental — a second run over unchanged data yields nothing', async () => {
  const cursors = {};
  await collect(cursors); // first run consumes msg_a (+ any earlier)
  const second = await collect(cursors);
  assert.equal(second.length, 0);
  // a newer message IS picked up
  writeMsg('msg_b', 1_700_000_100_000, { input: 7, output: 3, cache: { read: 0, write: 0 } });
  const third = await collect(cursors);
  assert.equal(third.length, 1);
  assert.equal(third[0].delta.total_tokens, 10);
});

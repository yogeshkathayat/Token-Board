'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

let Database;
try {
  Database = require('better-sqlite3');
} catch {
  Database = null;
}

if (!Database) {
  test('kiro parser tests skipped — better-sqlite3 not available', () => {});
} else {
  const TEST_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'tokenboard-kiro-home-'));
  const TEST_TRACKER_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'tokenboard-kiro-tracker-'));
  process.env.HOME = TEST_HOME;
  process.env.TOKENBOARD_HOME = TEST_TRACKER_HOME;

  function setupDb(rows) {
    const dir = path.join(TEST_HOME, 'Library', 'Application Support', 'kiro-cli');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'data.sqlite3');
    try { fs.unlinkSync(file); } catch { /* fresh */ }
    const db = new Database(file);
    db.exec(`
      CREATE TABLE conversations_v2 (
        key TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (key, conversation_id)
      );
    `);
    const stmt = db.prepare(
      'INSERT INTO conversations_v2(key, conversation_id, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    );
    for (const r of rows) stmt.run(r.key, r.id, r.value, r.created_at, r.updated_at);
    db.close();
  }

  function clearCache() {
    for (const k of Object.keys(require.cache)) {
      if (k.includes('/src/')) delete require.cache[k];
    }
  }

  function reset() {
    fs.rmSync(TEST_TRACKER_HOME, { recursive: true, force: true });
    fs.mkdirSync(TEST_TRACKER_HOME, { recursive: true });
    clearCache();
  }

  test('kiro: estimates tokens from prompt/response char length', async () => {
    reset();
    const conv = JSON.stringify({
      conversation_id: 'c1',
      model_info: { model_id: 'auto' },
      history: [
        {
          user: {},
          assistant: { Response: '...' },
          request_metadata: {
            request_id: 'r1',
            request_start_timestamp_ms: Date.parse('2026-05-07T10:05:00Z'),
            user_prompt_length: 400, // → 100 tokens
            response_size: 200,      // → 50 tokens
            model_id: 'kiro-fast',
          },
        },
      ],
    });
    setupDb([{ key: 'workspace', id: 'c1', value: conv, created_at: 1, updated_at: 100 }]);

    const kiro = require('../src/parsers/kiro.js');
    const buckets = await kiro.parse();
    assert.equal(buckets.length, 1);
    const b = buckets[0];
    assert.equal(b.source, 'kiro');
    assert.equal(b.model, 'kiro-fast');
    assert.equal(b.input_tokens, 100);
    assert.equal(b.output_tokens, 50);
    assert.equal(b.total_tokens, 150);
    assert.equal(b.hour_start, '2026-05-07T10:00:00.000Z');
  });

  test('kiro: dedupes by request_id across runs', async () => {
    reset();
    const conv = JSON.stringify({
      conversation_id: 'c1',
      history: [
        {
          request_metadata: {
            request_id: 'r1',
            request_start_timestamp_ms: Date.parse('2026-05-07T10:05:00Z'),
            user_prompt_length: 400,
            response_size: 200,
            model_id: 'kiro',
          },
        },
      ],
    });
    setupDb([{ key: 'workspace', id: 'c1', value: conv, created_at: 1, updated_at: 100 }]);

    const kiro = require('../src/parsers/kiro.js');
    const first = await kiro.parse();
    assert.equal(first.length, 1);
    const second = await kiro.parse();
    assert.equal(second.length, 0, 'no new buckets on second run');
  });

  test('kiro: skips turns without timestamps or zero-char content', async () => {
    reset();
    const conv = JSON.stringify({
      conversation_id: 'c1',
      history: [
        { request_metadata: { request_id: 'r1' /* no ts */, user_prompt_length: 100, response_size: 50 } },
        { request_metadata: { request_id: 'r2', request_start_timestamp_ms: Date.parse('2026-05-07T10:00:00Z'), user_prompt_length: 0, response_size: 0 } },
      ],
    });
    setupDb([{ key: 'workspace', id: 'c1', value: conv, created_at: 1, updated_at: 100 }]);

    const kiro = require('../src/parsers/kiro.js');
    const buckets = await kiro.parse();
    assert.equal(buckets.length, 0);
  });
}

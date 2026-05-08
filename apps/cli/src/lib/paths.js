'use strict';

const os = require('os');
const path = require('path');

/**
 * Canonical paths for tokenboard state. Every file that touches disk
 * goes through this module — keeps the layout discoverable.
 *
 *   ~/.tokenboard/
 *     config.json              backend URL, device token, user info
 *     queue.jsonl              pending usage buckets to upload
 *     queue.state.json         { offset } — byte offset into queue.jsonl
 *     cursors.json             per-source incremental parse state
 *     upload.throttle.json     backoff / next-allowed-at timestamps
 *     openrouter.cursor.json   last seen generation_id
 *     secrets/                 encrypted fallback keychain (Linux without keytar)
 *     bin/notify.cjs           hook script that triggers a sync
 */
function home() {
  return process.env.TOKENBOARD_HOME || path.join(os.homedir(), '.tokenboard');
}

function paths() {
  const root = home();
  return {
    root,
    config: path.join(root, 'config.json'),
    queue: path.join(root, 'queue.jsonl'),
    queueState: path.join(root, 'queue.state.json'),
    cursors: path.join(root, 'cursors.json'),
    throttle: path.join(root, 'upload.throttle.json'),
    openrouterCursor: path.join(root, 'openrouter.cursor.json'),
    secretsDir: path.join(root, 'secrets'),
    binDir: path.join(root, 'bin'),
    notifyScript: path.join(root, 'bin', 'notify.cjs'),
    logFile: path.join(root, 'tokenboard.log'),
  };
}

module.exports = { home, paths };

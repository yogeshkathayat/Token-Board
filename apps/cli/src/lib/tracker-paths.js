'use strict';

const os = require('node:os');
const path = require('node:path');

// Base dir for all local CLI state. `TOKENBOARD_HOME` overrides ~/.tokenboard.
// Read lazily so tests can set the env var before/after require.
function trackerDir() {
  const override = process.env.TOKENBOARD_HOME;
  if (override && override.trim()) return path.resolve(override);
  return path.join(os.homedir(), '.tokenboard');
}

// The user's OS home used to locate third-party tool logs (~/.claude etc.).
// `TOKENBOARD_USER_HOME` lets tests point the scanners at a fixture tree;
// os.homedir() ignores $HOME on darwin, so an explicit override is required.
function userHome() {
  const override = process.env.TOKENBOARD_USER_HOME;
  if (override && override.trim()) return path.resolve(override);
  return os.homedir();
}

function paths() {
  const root = trackerDir();
  return {
    root,
    configPath: path.join(root, 'config.json'),
    cursorsPath: path.join(root, 'cursors.json'),
    queuePath: path.join(root, 'queue.jsonl'),
    queueStatePath: path.join(root, 'queue.state.json'),
    throttlePath: path.join(root, 'upload.throttle.json'),
    lockPath: path.join(root, 'sync.lock'),
    summaryPath: path.join(root, 'summary.json'),
  };
}

module.exports = { trackerDir, userHome, paths };

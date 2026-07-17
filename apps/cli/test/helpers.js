'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Create isolated temp dirs and point the CLI at them. `TOKENBOARD_HOME` holds
// CLI state; `TOKENBOARD_USER_HOME` is the fake OS home the parsers scan.
function setupEnv() {
  const trackerHome = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-state-'));
  const userHome = fs.mkdtempSync(path.join(os.tmpdir(), 'tb-home-'));
  process.env.TOKENBOARD_HOME = trackerHome;
  process.env.TOKENBOARD_USER_HOME = userHome;
  return { trackerHome, userHome };
}

function writeFixture(userHome, relPath, content) {
  const full = path.join(userHome, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}

module.exports = { setupEnv, writeFixture };

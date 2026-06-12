'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { paths } = require('./paths.js');
const { ensureDir: makeDir } = require('./fs-util.js');

const NOTIFY_SCRIPT_BODY = `#!/usr/bin/env node
// tokenboard hook trampoline. Spawned by AI tools on session end.
// Triggers a sync without blocking the parent (fire-and-forget).
'use strict';
const { spawn } = require('child_process');
const path = require('path');

const tracker = path.resolve(__dirname, '..', 'app', 'bin', 'tracker.js');
let target;
try {
  require.resolve(tracker);
  target = ['node', tracker, 'sync', '--quiet'];
} catch {
  // Fall back to global tokenboard on PATH (for users who installed via npm).
  target = ['tokenboard', 'sync', '--quiet'];
}

const child = spawn(target[0], target.slice(1), {
  detached: true,
  stdio: 'ignore',
});
child.unref();
process.exit(0);
`;

function installNotifyScript() {
  makeDir(paths().binDir);
  fs.writeFileSync(paths().notifyScript, NOTIFY_SCRIPT_BODY, { mode: 0o755 });
  return paths().notifyScript;
}

// ---------- Claude Code ----------
function claudeSettingsPath() {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

function installClaudeHook() {
  const file = claudeSettingsPath();
  let settings = {};
  try {
    settings = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    /* fresh */
  }
  settings.hooks = settings.hooks || {};
  const list = Array.isArray(settings.hooks.SessionEnd) ? settings.hooks.SessionEnd : [];
  const cmd = `node ${paths().notifyScript}`;
  if (!list.some((h) => h?.command === cmd)) {
    list.push({ command: cmd, name: 'tokenboard' });
  }
  settings.hooks.SessionEnd = list;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(settings, null, 2));
}

function uninstallClaudeHook() {
  const file = claudeSettingsPath();
  try {
    const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (settings?.hooks?.SessionEnd) {
      settings.hooks.SessionEnd = settings.hooks.SessionEnd.filter(
        (h) => !String(h?.command ?? '').includes('tokenboard') && h?.name !== 'tokenboard',
      );
      fs.writeFileSync(file, JSON.stringify(settings, null, 2));
    }
  } catch {
    /* not installed */
  }
}

// ---------- Gemini ----------
function geminiSettingsPath() {
  return path.join(os.homedir(), '.gemini', 'settings.json');
}

function installGeminiHook() {
  const file = geminiSettingsPath();
  let settings = {};
  try {
    settings = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    /* fresh */
  }
  settings.hooks = settings.hooks || {};
  const list = Array.isArray(settings.hooks.SessionEnd) ? settings.hooks.SessionEnd : [];
  const cmd = `node ${paths().notifyScript}`;
  if (!list.some((h) => h?.command === cmd)) {
    list.push({ command: cmd, name: 'tokenboard', matcher: 'exit|clear|logout|prompt_input_exit|other' });
  }
  settings.hooks.SessionEnd = list;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(settings, null, 2));
}

function uninstallGeminiHook() {
  const file = geminiSettingsPath();
  try {
    const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (settings?.hooks?.SessionEnd) {
      settings.hooks.SessionEnd = settings.hooks.SessionEnd.filter(
        (h) => !String(h?.command ?? '').includes('tokenboard') && h?.name !== 'tokenboard',
      );
      fs.writeFileSync(file, JSON.stringify(settings, null, 2));
    }
  } catch {
    /* not installed */
  }
}

// ---------- Codex (TOML notify array) ----------
function codexConfigPath() {
  return path.join(os.homedir(), '.codex', 'config.toml');
}

function readToml(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function installCodexHook() {
  const file = codexConfigPath();
  let body = readToml(file);
  const arrayLine = `notify = ["node", "${paths().notifyScript}"]`;
  const existing = body.match(/^notify\s*=\s*\[[^\]]*\]/m);
  if (existing) {
    // Codex supports a single `notify` program, so we can't merge. If the user
    // already configured their own, leave it untouched rather than clobber it.
    if (!existing[0].includes('tokenboard')) {
      process.stderr.write(
        '[tokenboard] ~/.codex/config.toml already has a `notify` entry; leaving it untouched. ' +
          `Add ["node", "${paths().notifyScript}"] yourself to enable sync on Codex events.\n`,
      );
      return;
    }
    body = body.replace(/^notify\s*=\s*\[[^\]]*\]/m, arrayLine); // idempotent refresh of our own entry
  } else {
    body = (body ? body.trimEnd() + '\n\n' : '') + arrayLine + '\n';
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

function uninstallCodexHook() {
  const file = codexConfigPath();
  try {
    let body = fs.readFileSync(file, 'utf8');
    if (body.includes('tokenboard')) {
      body = body.replace(/^notify\s*=\s*\[[^\]]*\]\s*\n/m, '');
      fs.writeFileSync(file, body);
    }
  } catch {
    /* not installed */
  }
}

// ---------- OpenCode plugin ----------
function opencodePluginDir() {
  return path.join(os.homedir(), '.config', 'opencode', 'plugin');
}

function installOpencodePlugin() {
  const dir = opencodePluginDir();
  fs.mkdirSync(dir, { recursive: true });
  const body = `// tokenboard — OpenCode session plugin (auto-installed)
import { spawn } from 'node:child_process';

export const TokenboardPlugin = {
  name: 'tokenboard',
  hooks: {
    'session.updated': () => {
      const child = spawn('node', ['${paths().notifyScript}'], { detached: true, stdio: 'ignore' });
      child.unref();
    },
  },
};
export default TokenboardPlugin;
`;
  fs.writeFileSync(path.join(dir, 'tokenboard.js'), body);
}

function uninstallOpencodePlugin() {
  try {
    fs.unlinkSync(path.join(opencodePluginDir(), 'tokenboard.js'));
  } catch {
    /* not installed */
  }
}

function detectInstalledTools() {
  const out = {};
  try {
    out.claude = fs.statSync(path.join(os.homedir(), '.claude')).isDirectory();
  } catch {
    out.claude = false;
  }
  try {
    out.codex = fs.statSync(path.join(os.homedir(), '.codex')).isDirectory();
  } catch {
    out.codex = false;
  }
  try {
    out.gemini = fs.statSync(path.join(os.homedir(), '.gemini')).isDirectory();
  } catch {
    out.gemini = false;
  }
  try {
    out.opencode = fs.statSync(path.join(os.homedir(), '.config', 'opencode')).isDirectory();
  } catch {
    out.opencode = false;
  }
  return out;
}

module.exports = {
  installNotifyScript,
  installClaudeHook,
  uninstallClaudeHook,
  installGeminiHook,
  uninstallGeminiHook,
  installCodexHook,
  uninstallCodexHook,
  installOpencodePlugin,
  uninstallOpencodePlugin,
  detectInstalledTools,
};

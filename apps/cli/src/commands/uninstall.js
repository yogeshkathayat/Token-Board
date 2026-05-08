'use strict';

const fs = require('fs');

const hooks = require('../lib/hooks.js');
const secrets = require('../lib/secrets.js');
const { paths } = require('../lib/paths.js');
const { confirm } = require('../lib/prompt.js');

async function run() {
  const ok = await confirm('Remove all tokenboard hooks and local state?', false);
  if (!ok) return;

  hooks.uninstallClaudeHook();
  hooks.uninstallGeminiHook();
  hooks.uninstallCodexHook();
  hooks.uninstallOpencodePlugin();
  await secrets.deleteOpenRouterKey().catch(() => {});

  // Remove ~/.tokenboard entirely.
  try {
    fs.rmSync(paths().root, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  console.log('✓ Uninstalled.');
}

module.exports = { run };

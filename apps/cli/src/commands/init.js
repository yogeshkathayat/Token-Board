'use strict';

const os = require('os');
const { prompt, confirm } = require('../lib/prompt.js');
const { parseArgv } = require('../lib/argv.js');
const { loadConfig, saveConfig } = require('../lib/config.js');
const { request } = require('../lib/http.js');
const hooks = require('../lib/hooks.js');
const secrets = require('../lib/secrets.js');

async function exchangeLinkCode({ baseUrl, code }) {
  const requestId = `${os.hostname()}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return request({
    baseUrl,
    path: '/api/v1/auth/link-code-exchange',
    method: 'POST',
    body: {
      link_code: code.toUpperCase(),
      request_id: requestId,
      device_name: os.hostname(),
      platform: process.platform,
    },
  });
}

function printHelp() {
  console.log(`tokenboard init — link this device to a tokenboard server

Usage:
  tokenboard init [BASE_URL] [options]

Options:
  --base-url <URL>      Backend URL (alternative to positional arg)
  --link-code <CODE>    6-char code from /settings/devices (skips browser step)
  --openrouter-key <K>  Pre-populate OpenRouter API key
  --yes, -y             Non-interactive — install hooks for every detected tool, skip OpenRouter
  --no-hooks            Don't install any hooks (useful for daemon-only mode)
  --help, -h            Show this help

Examples:
  tokenboard init                                   # interactive
  tokenboard init https://usage.acme.com            # interactive, URL prefilled
  tokenboard init https://usage.acme.com --link-code ABC234 --yes  # unattended
`);
}

async function run(argv) {
  const args = parseArgv(argv);
  if (args.help || args.h) {
    printHelp();
    return;
  }

  const cfg = loadConfig();
  const yes = Boolean(args.yes || args.y);
  const skipHooks = Boolean(args['no-hooks']);

  // 1) Resolve backend URL.
  let baseUrl = (args._[0] && /^https?:\/\//.test(args._[0]) ? args._[0] : null) ||
    args['base-url'] ||
    cfg.base_url;

  if (!baseUrl && yes) {
    throw new Error('--yes requires a backend URL (positional or --base-url)');
  }
  if (!baseUrl) {
    baseUrl = await prompt('Backend URL (e.g. https://usage.acme.internal): ');
  } else if (!yes && cfg.base_url && cfg.base_url !== baseUrl) {
    const reuse = await confirm(`Use existing backend URL ${cfg.base_url}?`, true);
    if (reuse) baseUrl = cfg.base_url;
  }
  if (!/^https?:\/\//.test(baseUrl)) {
    throw new Error('Backend URL must start with http:// or https://');
  }

  // Sanity-check the backend.
  try {
    await request({ baseUrl, path: '/api/v1/healthz' });
  } catch (err) {
    throw new Error(`Cannot reach ${baseUrl} (${err.message})`);
  }

  // 2) Resolve link code.
  let code = args['link-code'] || null;
  if (!code) {
    if (yes) {
      throw new Error('--yes requires --link-code');
    }
    console.log(`\n1) Open this URL in your browser, sign in, and create a link code:`);
    console.log(`   ${baseUrl.replace(/\/$/, '')}/settings/devices`);
    code = await prompt('\n2) Paste the link code: ');
  }
  code = code.toString().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    throw new Error('Link code must be 6 chars (A-Z, 2-9)');
  }

  // 3) Exchange.
  const exchanged = await exchangeLinkCode({ baseUrl, code });
  saveConfig({
    base_url: baseUrl,
    device_id: exchanged.device_id,
    device_token: exchanged.token,
    user: { id: exchanged.user_id },
    auto_sync: true,
  });
  console.log(`✓ Linked device ${os.hostname()}`);

  // 4) Install hooks.
  if (skipHooks) {
    console.log('Skipping hook installation (--no-hooks).');
  } else {
    hooks.installNotifyScript();
    const detected = hooks.detectInstalledTools();
    const detectedList = Object.entries(detected).filter(([, v]) => v).map(([k]) => k);
    console.log(`\nDetected on this machine: ${detectedList.join(', ') || '(none)'}`);

    const installAll = yes || detectedList.length === 0
      ? true
      : await confirm('Install hooks for all detected tools?', true);

    if (detected.claude && installAll) {
      hooks.installClaudeHook();
      console.log('✓ Claude Code hook installed');
    }
    if (detected.gemini && installAll) {
      hooks.installGeminiHook();
      console.log('✓ Gemini hook installed');
    }
    if (detected.codex && installAll) {
      hooks.installCodexHook();
      console.log('✓ Codex hook installed');
    }
    if (detected.opencode && installAll) {
      hooks.installOpencodePlugin();
      console.log('✓ OpenCode plugin installed');
    }
  }

  // 5) OpenRouter (optional).
  if (args['openrouter-key']) {
    await secrets.setOpenRouterKey(String(args['openrouter-key']));
    console.log('✓ OpenRouter key stored');
  } else if (!yes) {
    if (await confirm('\nTrack OpenRouter usage too? (you\'ll need an API key)', false)) {
      const key = await prompt('Paste your OpenRouter API key (sk-or-...): ');
      if (key && key.length > 10) {
        await secrets.setOpenRouterKey(key);
        console.log('✓ OpenRouter key stored');
      }
    }
  }

  console.log('\nAll set. Try: tokenboard sync');
  console.log('To run a background daemon that syncs every 10 min: tokenboard daemon install');
}

module.exports = { run };

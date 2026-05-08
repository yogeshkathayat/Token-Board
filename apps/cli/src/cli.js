'use strict';

const COMMANDS = {
  init: () => require('./commands/init.js'),
  sync: () => require('./commands/sync.js'),
  serve: () => require('./commands/serve.js'),
  status: () => require('./commands/status.js'),
  doctor: () => require('./commands/doctor.js'),
  uninstall: () => require('./commands/uninstall.js'),
  openrouter: () => require('./commands/openrouter.js'),
  daemon: () => require('./commands/daemon.js'),
  link: () => require('./commands/link.js'),
};

function printHelp() {
  console.log(`tokenboard — track AI coding tool token usage on your laptop

Usage:
  tokenboard <command> [options]

Commands:
  init                    First-time setup: link this device, install hooks
  link <CODE>             Link a device using a code (alias for: init --link-code)
  sync                    Parse all tool sources and upload to the server
  daemon install          Install a background sync timer (10-min interval)
  daemon uninstall        Remove the background timer
  daemon status           Show daemon state
  serve                   Run a local dashboard server on port 7680
  status                  Print queue size, last sync, hooks installed
  doctor                  Health check: backend reachable, hooks live
  uninstall               Remove all hooks and config
  openrouter login        Store your OpenRouter API key for usage pulls
  openrouter logout       Forget the stored OpenRouter API key

Global flags:
  --debug, -d             Verbose logging
  --help, -h              Show this help

Environment:
  TOKENBOARD_BASE_URL   Backend URL (set during \`init\`)
  TOKENBOARD_DEBUG      1 to enable verbose logs
`);
}

async function run(argv) {
  const cmd = argv[0];

  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
    printHelp();
    return;
  }

  const loader = COMMANDS[cmd];
  if (!loader) {
    console.error(`Unknown command: ${cmd}`);
    printHelp();
    process.exit(2);
  }

  const mod = loader();
  await mod.run(argv.slice(1));
}

module.exports = { run };

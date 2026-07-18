'use strict';

const path = require('node:path');

const HELP = `tokenboard — local AI token-usage tracker

Usage:
  tokenboard <command> [options]

Commands:
  init            Show the privacy promise and pair this device
                  (--base-url <url> --link-code <CODE> [--yes])
  device-login    Pair using a dashboard link code
                  (--link-code <CODE> [--base-url <url>])
  sync            Parse local tool logs and upload usage buckets
                  (--drain to only upload, --force to bypass throttle)
  autosync        Manage the 5-min background sync agent
                  (autosync install | uninstall | status)
  status          Show config, pending queue size, and last sync
  config          Get/set config values (config get [key] | config set <key> <value>)

Options:
  -h, --help      Show this help
  -v, --version   Show version

Privacy: only token counts and timestamps are uploaded — never prompts,
responses, file contents, or filenames.
`;

function version() {
  try {
    return require(path.join(__dirname, '..', 'package.json')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const COMMANDS = {
  init: () => require('./commands/init'),
  'device-login': () => require('./commands/device-login'),
  sync: () => require('./commands/sync'),
  autosync: () => require('./commands/autosync'),
  status: () => require('./commands/status'),
  config: () => require('./commands/config'),
};

async function main(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const first = args[0];

  if (!first || first === '-h' || first === '--help' || first === 'help') {
    process.stdout.write(HELP);
    return 0;
  }
  if (first === '-v' || first === '--version' || first === 'version') {
    process.stdout.write(`${version()}\n`);
    return 0;
  }

  const loader = COMMANDS[first];
  if (!loader) {
    process.stderr.write(`unknown command: ${first}\n\n${HELP}`);
    return 2;
  }

  const command = loader();
  return command.run(args.slice(1));
}

module.exports = { main, HELP, version };

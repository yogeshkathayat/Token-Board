'use strict';

const { readConfig, updateConfig } = require('../lib/config');
const { pairWithLinkCode } = require('./device-login');

const PRIVACY_PROMISE = [
  'TokenBoard privacy promise:',
  '  • It uploads token COUNTS and timestamps only.',
  '  • It NEVER uploads your prompts, responses, file contents, or filenames.',
  '  • Only aggregated half-hour usage buckets leave this machine.',
  '',
].join('\n');

function parseArgs(argv) {
  const out = { baseUrl: null, code: null, yes: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base-url') out.baseUrl = argv[++i] || null;
    else if (a === '--link-code' || a === '--code') out.code = argv[++i] || null;
    else if (a === '--yes' || a === '-y') out.yes = true;
  }
  return out;
}

async function run(argv) {
  const args = parseArgs(argv);
  const out = process.stdout;
  out.write(PRIVACY_PROMISE);

  const config = readConfig();
  const baseUrl = args.baseUrl || config.baseUrl;
  if (args.baseUrl) updateConfig({ baseUrl });

  if (!args.code) {
    out.write('To pair this device:\n');
    out.write('  1. Open the TokenBoard dashboard and generate a link code.\n');
    out.write(`  2. Run: tokenboard init --link-code <CODE>${args.baseUrl ? '' : ' --base-url <url>'}\n`);
    out.write(`\nConfigured backend: ${baseUrl}\n`);
    return 0;
  }

  await pairWithLinkCode({ baseUrl, code: args.code, out });
  out.write('\nSetup complete. Run `tokenboard sync` to upload usage.\n');
  return 0;
}

module.exports = { run, PRIVACY_PROMISE };

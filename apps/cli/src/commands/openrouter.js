'use strict';

const { prompt } = require('../lib/prompt.js');
const secrets = require('../lib/secrets.js');

async function run(argv) {
  const sub = argv[0];
  if (sub === 'login') {
    const key = await prompt('Paste your OpenRouter API key (sk-or-...): ');
    if (!key || key.length < 10) throw new Error('Key too short');
    await secrets.setOpenRouterKey(key);
    console.log('✓ Stored. Run `tokenboard sync` to fetch usage.');
    return;
  }
  if (sub === 'logout') {
    await secrets.deleteOpenRouterKey();
    console.log('✓ OpenRouter key forgotten.');
    return;
  }
  if (sub === 'status' || !sub) {
    const has = await secrets.hasOpenRouterKey();
    console.log(`OpenRouter key: ${has ? 'configured' : 'not set'}`);
    return;
  }
  throw new Error(`Unknown openrouter subcommand: ${sub}. Use login | logout | status.`);
}

module.exports = { run };

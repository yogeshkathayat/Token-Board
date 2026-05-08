#!/usr/bin/env node
'use strict';

// Strip a leading --debug for global debug enablement.
const argv = process.argv.slice(2).filter((a) => {
  if (a === '--debug' || a === '-d') {
    process.env.TOKENBOARD_DEBUG = '1';
    return false;
  }
  return true;
});

const cli = require('../src/cli.js');
cli.run(argv).catch((err) => {
  if (process.env.TOKENBOARD_DEBUG) {
    console.error(err);
  } else {
    console.error(`Error: ${err.message}`);
  }
  process.exit(1);
});

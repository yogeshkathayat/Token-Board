#!/usr/bin/env node
'use strict';

require('../src/cli').main(process.argv.slice(2)).then(
  (code) => process.exit(typeof code === 'number' ? code : 0),
  (err) => {
    process.stderr.write(`tokenboard: ${err && err.message ? err.message : err}\n`);
    process.exit(1);
  },
);

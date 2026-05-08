'use strict';

/**
 * Convenience alias: `tokenboard link <CODE>` is the same as
 * `tokenboard init --link-code <CODE> --yes`. Used by the dashboard's
 * one-line install command and by users re-linking after a token revoke.
 */
const init = require('./init.js');

async function run(argv) {
  const code = argv[0];
  if (!code) {
    throw new Error('Usage: tokenboard link <CODE>');
  }
  // Forward all remaining args, plus our defaults.
  const rest = argv.slice(1);
  return init.run(['--link-code', code, '--yes', ...rest]);
}

module.exports = { run };

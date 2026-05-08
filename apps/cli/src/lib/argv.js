'use strict';

/**
 * Tiny argv parser. Supports:
 *   --flag                 → flag = true
 *   --key=value            → key = value
 *   --key value            → key = value
 *   -f                     → f = true
 *   <positional>           → pushed onto _.
 *
 * No external dep, no over-engineering. We never need short-flag bundling.
 */
function parseArgv(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq >= 0) {
        out[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const key = a.slice(2);
        const next = argv[i + 1];
        if (next && !next.startsWith('-')) {
          out[key] = next;
          i += 1;
        } else {
          out[key] = true;
        }
      }
    } else if (a.startsWith('-') && a.length > 1) {
      out[a.slice(1)] = true;
    } else {
      out._.push(a);
    }
  }
  return out;
}

module.exports = { parseArgv };

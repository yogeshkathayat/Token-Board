'use strict';

const { CONFIG_KEYS, readConfig, updateConfig } = require('../lib/config');

const REDACTED = new Set(['deviceToken']);

function display(key, value) {
  if (value == null) return '(unset)';
  if (REDACTED.has(key) && typeof value === 'string' && value.length > 0) {
    return `${value.slice(0, 4)}…(${value.length} chars)`;
  }
  return String(value);
}

async function run(argv) {
  const out = process.stdout;
  const [sub, key, ...rest] = argv;
  const config = readConfig();

  if (!sub || sub === 'get') {
    if (key) {
      if (!CONFIG_KEYS.includes(key)) {
        process.stderr.write(`unknown config key: ${key}\n`);
        return 2;
      }
      out.write(`${display(key, config[key])}\n`);
      return 0;
    }
    for (const k of CONFIG_KEYS) out.write(`${k} = ${display(k, config[k])}\n`);
    return 0;
  }

  if (sub === 'set') {
    if (!key || !CONFIG_KEYS.includes(key)) {
      process.stderr.write(`usage: tokenboard config set <${CONFIG_KEYS.join('|')}> <value>\n`);
      return 2;
    }
    const value = rest.join(' ');
    updateConfig({ [key]: value });
    out.write(`${key} = ${display(key, value)}\n`);
    return 0;
  }

  process.stderr.write('usage: tokenboard config [get [key] | set <key> <value>]\n');
  return 2;
}

module.exports = { run };

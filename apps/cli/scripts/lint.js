#!/usr/bin/env node
'use strict';

// Lightweight lint: syntax-check every shipping JS file with `node --check`.
// Replaces the previous no-op so `npm run lint` actually fails on broken code.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const roots = ['bin', 'src', 'scripts'];
const failures = [];
let checked = 0;

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.isFile() && (e.name.endsWith('.js') || e.name.endsWith('.cjs'))) {
      checked += 1;
      try {
        execFileSync(process.execPath, ['--check', full], { stdio: 'pipe' });
      } catch (err) {
        failures.push(`${full}: ${String(err.stderr || err.message).trim()}`);
      }
    }
  }
}

const cwd = path.resolve(__dirname, '..');
for (const r of roots) walk(path.join(cwd, r));

if (failures.length > 0) {
  console.error(`lint: ${failures.length} file(s) failed syntax check:`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`lint: ${checked} file(s) OK`);

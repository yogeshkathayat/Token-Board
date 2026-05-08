#!/usr/bin/env node
/**
 * Bundle the macOS menu-bar widget source into `public/macos-widget.tar.gz`
 * so the Vite dev server (and the production build) can serve it as a
 * direct download from the "Desktop Widgets" page.
 *
 * Skips `.build/` (compiled artifacts — different per developer) and any
 * dotfiles. Output is gzip'd tar so it's a single ~15 KB file the dashboard
 * can link to.
 *
 * Run by `npm --workspace @tokenboard/dashboard run bundle:widget`. Hooked
 * into `predev` and `prebuild` so it's always up to date.
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const SRC = path.join(REPO, 'apps', 'menubar');
const OUT_DIR = path.resolve(__dirname, '..', 'public');
const OUT = path.join(OUT_DIR, 'macos-widget.tar.gz');

if (!fs.existsSync(SRC)) {
  console.warn(`[bundle-widget] menubar source not found at ${SRC} — skipping`);
  process.exit(0);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

// Use `tar` from the system path. Available on macOS, Linux, and modern Windows.
const args = [
  '-czf', OUT,
  '--exclude=.build',
  '--exclude=.DS_Store',
  '--exclude=*.swp',
  '-C', path.dirname(SRC),
  path.basename(SRC),
];
const res = spawnSync('tar', args, { stdio: 'inherit' });
if (res.status !== 0) {
  console.error(`[bundle-widget] tar failed (exit ${res.status})`);
  process.exit(1);
}
const stat = fs.statSync(OUT);
console.log(`[bundle-widget] wrote ${OUT} (${(stat.size / 1024).toFixed(1)} KB)`);

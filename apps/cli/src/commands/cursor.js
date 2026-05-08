'use strict';

const { prompt } = require('../lib/prompt.js');
const secrets = require('../lib/secrets.js');

/**
 * `tokenboard cursor login | logout | status`
 *
 * Cursor's web dashboard exposes per-event usage CSV at
 *   https://cursor.com/api/dashboard/export-usage-events-csv?strategy=tokens
 * but the request needs a `WorkosCursorSessionToken` cookie. Recent Cursor
 * versions store the underlying JWT in macOS Keychain (encrypted, not
 * accessible without a user prompt), so we ask the user to paste the
 * cookie value once and stash it in our own keychain entry.
 *
 * To grab it: open Cursor → Settings (gear) → click any tab that loads
 * web content (Dashboard / Account) → in the embedded webview, open
 * DevTools (Cmd+Opt+I) → Application → Cookies → www.cursor.com →
 * find `WorkosCursorSessionToken`. Copy the *value*. Or do it from
 * cursor.com in any browser where you're signed in.
 */

function showHelp() {
  console.log(`tokenboard cursor — manage Cursor session credentials

Usage:
  tokenboard cursor login         Paste your WorkosCursorSessionToken value
  tokenboard cursor logout        Forget the stored cookie
  tokenboard cursor status        Show whether a cookie is stored

How to get the cookie:
  Open https://www.cursor.com in any browser where you're signed in →
  open DevTools → Application → Cookies → www.cursor.com → copy the
  value of WorkosCursorSessionToken.`);
}

async function run(argv) {
  const sub = argv[0];

  if (!sub || sub === 'help' || sub === '--help' || sub === '-h') {
    showHelp();
    return;
  }

  if (sub === 'login') {
    console.log('Paste your WorkosCursorSessionToken cookie value.');
    console.log('(Tip: it usually looks like  user_XYZ%3A%3AeyJ…  — URL-encoded)');
    const value = (await prompt('Cookie value: ')).trim();
    if (!value || value.length < 20) {
      throw new Error('Cookie value too short — paste the full WorkosCursorSessionToken value');
    }
    await secrets.setCursorCookie(value);
    console.log('✓ Stored. Run `tokenboard sync` to fetch your Cursor usage.');
    return;
  }

  if (sub === 'logout') {
    await secrets.deleteCursorCookie();
    console.log('✓ Cursor cookie forgotten.');
    return;
  }

  if (sub === 'status') {
    const has = await secrets.hasCursorCookie();
    console.log(`Cursor cookie: ${has ? 'configured' : 'not set'}`);
    return;
  }

  throw new Error(`Unknown cursor subcommand: ${sub}. Use login | logout | status.`);
}

module.exports = { run };

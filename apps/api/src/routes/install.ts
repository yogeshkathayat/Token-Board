import type { FastifyInstance } from 'fastify';

import { config } from '../config.js';

/**
 * Public install script — served at /install.sh on the same origin as the
 * dashboard so users can run:
 *
 *   curl -fsSL https://usage.acme.com/install.sh | sh
 *   curl -fsSL https://usage.acme.com/install.sh?code=ABC234 | sh
 *
 * The script bakes in the deployment URL (and optionally a link code) so
 * users never type a URL by hand.
 *
 * Note: this route is mounted *outside* the /api/v1 prefix (in server.ts)
 * so the URL is short and memorable.
 */

const SCRIPT_TEMPLATE = `#!/usr/bin/env sh
# tokenboard installer
#
# Pre-baked deployment URL: __PUBLIC_URL__
#
# Run:
#   curl -fsSL __PUBLIC_URL__/install.sh | sh
#   curl -fsSL __PUBLIC_URL__/install.sh?code=ABC234 | sh
#
set -eu

PUBLIC_URL="__PUBLIC_URL__"
LINK_CODE="__LINK_CODE__"

bold() { printf "\\033[1m%s\\033[0m\\n" "$*"; }
red()  { printf "\\033[31m%s\\033[0m\\n" "$*"; }
green(){ printf "\\033[32m%s\\033[0m\\n" "$*"; }

bold "→ tokenboard installer"
echo "  backend: $PUBLIC_URL"

# 1. Verify Node 20+ is available.
if ! command -v node >/dev/null 2>&1; then
  red "✗ node not found. Install Node.js ≥ 20 from https://nodejs.org and re-run."
  exit 1
fi
NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 20 ]; then
  red "✗ Node $NODE_MAJOR found; need Node ≥ 20."
  exit 1
fi

# 2. Install (or upgrade) the CLI globally.
if command -v tokenboard >/dev/null 2>&1; then
  green "✓ tokenboard already installed at $(command -v tokenboard)"
else
  bold "→ Installing tokenboard-cli globally…"
  npm install -g tokenboard-cli
fi

# 3. Run init.
if [ -n "$LINK_CODE" ]; then
  bold "→ Linking with code $LINK_CODE"
  tokenboard init "$PUBLIC_URL" --link-code "$LINK_CODE" --yes
else
  bold "→ Open $PUBLIC_URL/settings/devices to grab a link code, then:"
  echo "    tokenboard init $PUBLIC_URL"
  exit 0
fi

# 4. Offer to install the background daemon.
bold "→ Install background sync daemon (every 10 min)?"
printf "  [Y/n] "
read -r ANSWER || ANSWER=y
case "$ANSWER" in
  n|N|no|NO)
    echo "  Skipped. Run \\\`tokenboard daemon install\\\` later if you change your mind."
    ;;
  *)
    tokenboard daemon install
    ;;
esac

green "✓ Done. Verify with: tokenboard status"
`;

function escapeShellSingleLine(s: string): string {
  // Block control chars and shell metacharacters that could escape the quoted context.
  // Link codes are validated to /^[A-Z0-9]{6}$/, so this is belt-and-suspenders.
  return s.replace(/[^A-Za-z0-9_./:\-]/g, '');
}

export async function installScriptRoutes(app: FastifyInstance): Promise<void> {
  app.get('/install.sh', { config: { rateLimit: { max: 30, timeWindow: 60 * 60 * 1000 } } }, async (req, reply) => {
    const codeRaw = (req.query as { code?: string }).code;
    const code = typeof codeRaw === 'string' && /^[A-Z0-9]{6}$/i.test(codeRaw)
      ? codeRaw.toUpperCase()
      : '';

    const body = SCRIPT_TEMPLATE
      .replace(/__PUBLIC_URL__/g, escapeShellSingleLine(config.publicUrl))
      .replace(/__LINK_CODE__/g, code);

    reply
      .header('Content-Type', 'text/x-shellscript; charset=utf-8')
      .header('Cache-Control', 'no-store')
      // hint to curl-pipes that this is a shell script
      .header('Content-Disposition', 'inline; filename="tokenboard-install.sh"');
    return body;
  });
}

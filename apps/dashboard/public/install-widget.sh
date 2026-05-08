#!/usr/bin/env sh
# Token Board macOS menu bar widget — one-line installer.
#
# Usage:
#   curl -fsSL <server>/install-widget.sh | sh -s -- <server>
#
# The script downloads the widget bundle, builds it with swiftc, and
# registers a launchd agent so the bar icon auto-starts on login.

set -eu

bold()  { printf "\033[1m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
red()   { printf "\033[31m%s\033[0m\n" "$*"; }

SERVER="${1:-}"
PAT="${2:-}"
if [ -z "$SERVER" ]; then
  red "✗ Usage: curl -fsSL <server>/install-widget.sh | sh -s -- <server> [pat]"
  exit 1
fi

bold "→ Token Board widget installer"
echo "   Server: $SERVER"
[ -n "$PAT" ] && echo "   Token:  ${PAT%${PAT#????????}}…  (will be written to Keychain-equivalent file)"
echo

case "$(uname -s)" in
  Darwin) ;;
  *)
    red "✗ This installer is macOS only."
    exit 1
    ;;
esac

if ! command -v swiftc >/dev/null 2>&1; then
  red "✗ swiftc not found. Install Xcode Command Line Tools first:"
  echo "    xcode-select --install"
  exit 1
fi

WORK="$(mktemp -d -t tokenboard-widget)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"

bold "→ Downloading widget source..."
if ! curl -fsSL "$SERVER/macos-widget.tar.gz" | tar -xzf -; then
  red "✗ Could not download $SERVER/macos-widget.tar.gz"
  exit 1
fi

cd menubar
bold "→ Building and installing..."
./build.sh install

# If a PAT was passed in, pre-configure the bar app so the user doesn't have
# to paste anything. The bar app reads server URL + token from these files
# at startup.
if [ -n "$PAT" ]; then
  bold "→ Pre-configuring the bar app..."
  TB_DIR="$HOME/Library/Application Support/TokenBoard"
  mkdir -p "$TB_DIR"
  printf '%s' "$PAT" > "$TB_DIR/token"
  chmod 600 "$TB_DIR/token"
  defaults write tb.baseURL -string "$SERVER" 2>/dev/null || true

  # Nudge the running bar app to re-read by bouncing the launchd job.
  PLIST="$HOME/Library/LaunchAgents/com.tokenboard.bar.plist"
  if [ -f "$PLIST" ]; then
    launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
    pkill -9 -f TokenBoardBar 2>/dev/null || true
    sleep 2
    launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || true
  fi
fi

echo
green "✓ Done."
if [ -n "$PAT" ]; then
  echo "  The bar icon should appear (top-right of your screen) and start showing"
  echo "  today's count within a few seconds. No manual configuration needed."
else
  echo "  The bar icon should appear in your menu bar (top-right). Click it → gear ⚙️"
  echo "  → paste an access token from $SERVER to start showing data."
fi

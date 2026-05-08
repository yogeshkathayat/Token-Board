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
if [ -z "$SERVER" ]; then
  red "✗ Usage: curl -fsSL <server>/install-widget.sh | sh -s -- <server>"
  exit 1
fi

bold "→ Token Board widget installer"
echo "   Server: $SERVER"
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

echo
green "✓ Done. The bar icon should appear in your menu bar (top-right) within a second or two."
echo "  Next step: click the icon → gear ⚙️ → paste your access token from $SERVER."

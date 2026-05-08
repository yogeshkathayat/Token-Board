#!/usr/bin/env bash
# Build the Token Board menu bar app and (optionally) install it as a
# launch agent so it starts on login.
#
# Usage:
#   ./build.sh           # build only
#   ./build.sh run       # build + run in foreground
#   ./build.sh install   # build + register as a launchd login item
#   ./build.sh uninstall # remove the launchd login item
#
# Note: this script invokes swiftc directly rather than `swift build`
# because SwiftPM's manifest-loader stack on macOS Command Line Tools
# can be flaky after partial OS updates. Direct compilation is more
# robust and produces the same output.
set -euo pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

ACTION="${1:-build}"
PRODUCT="TokenBoardBar"
BUILD_DIR="$DIR/.build/release"
LAUNCHD_LABEL="com.tokenboard.bar"
PLIST="$HOME/Library/LaunchAgents/${LAUNCHD_LABEL}.plist"
INSTALL_PATH="$HOME/Library/Application Support/TokenBoard/${PRODUCT}"

build() {
  mkdir -p "$BUILD_DIR"
  echo "→ swiftc -O Sources/TokenBoardBar/*.swift"
  swiftc -O \
    -framework AppKit -framework SwiftUI -framework Combine -framework Security \
    -o "$BUILD_DIR/$PRODUCT" \
    Sources/TokenBoardBar/*.swift
  echo "✓ built $BUILD_DIR/$PRODUCT ($(stat -f %z "$BUILD_DIR/$PRODUCT" 2>/dev/null || echo ?) bytes)"
}

case "$ACTION" in
  build)
    build
    ;;
  run)
    build
    "$BUILD_DIR/$PRODUCT"
    ;;
  install)
    build
    mkdir -p "$(dirname "$INSTALL_PATH")"
    cp "$BUILD_DIR/$PRODUCT" "$INSTALL_PATH"
    chmod +x "$INSTALL_PATH"
    LOG_PATH="$HOME/Library/Logs/TokenBoardBar.log"
    cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LAUNCHD_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${INSTALL_PATH}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Interactive</string>
  <key>StandardOutPath</key><string>${LOG_PATH}</string>
  <key>StandardErrorPath</key><string>${LOG_PATH}</string>
</dict>
</plist>
EOF
    # Use the modern launchctl API; `load`/`unload` is deprecated and doesn't
    # properly bind to the user's GUI session on macOS 13+, which makes
    # NSStatusItem invisible.
    launchctl bootout gui/$UID "$PLIST" 2>/dev/null || true
    pkill -9 -f "$PRODUCT" 2>/dev/null || true
    launchctl bootstrap gui/$UID "$PLIST"
    echo "✓ installed and launched. The bar icon should appear shortly."
    echo "  Logs: ${LOG_PATH:-~/Library/Logs/TokenBoardBar.log}"
    ;;
  uninstall)
    launchctl bootout gui/$UID "$PLIST" 2>/dev/null || true
    pkill -9 -f "$PRODUCT" 2>/dev/null || true
    rm -f "$PLIST"
    rm -f "$INSTALL_PATH"
    echo "✓ uninstalled"
    ;;
  *)
    echo "Usage: $0 [build|run|install|uninstall]"
    exit 1
    ;;
esac

#!/usr/bin/env bash
# Build the Token Board menu bar app and (optionally) install it as a
# launchd login item.
#
# Usage:
#   ./build.sh            # build only -> .build/TokenBoard.app
#   ./build.sh install     # build + install into ~/Applications + launchd
#   ./build.sh uninstall   # remove the launchd agent + installed app
#
# Note: this invokes `swiftc` directly rather than `swift build` / an
# .xcodeproj. SwiftPM's manifest-loader stack is broken on most Command Line
# Tools installs (PackageDescription ABI mismatch + a duplicate
# `SwiftBridging` modulemap left behind by an interrupted CLT update), so
# direct compilation is the reliable path here.
#
# If swiftc itself fails with "redefinition of module 'SwiftBridging'":
#   sudo mv /Library/Developer/CommandLineTools/usr/include/swift/module.modulemap{,.bak}
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

ACTION="${1:-build}"

PRODUCT="TokenBoard"
APP_NAME="TokenBoard.app"
BUNDLE_ID="com.tokenboard.bar"
LAUNCHD_LABEL="com.tokenboard.bar"

BUILD_DIR="$DIR/.build"
APP_BUNDLE="$BUILD_DIR/$APP_NAME"

INSTALL_DIR="$HOME/Applications"
INSTALLED_APP="$INSTALL_DIR/$APP_NAME"

PLIST_PATH="$HOME/Library/LaunchAgents/${LAUNCHD_LABEL}.plist"
LOG_PATH="$HOME/Library/Logs/TokenBoardBar.log"

# Render logomark.svg into an AppIcon.icns via Quick Look + iconutil (macOS built-ins).
# Best-effort: if either tool is missing, the app just uses the default icon.
make_app_icon() {
  local out="$1"
  command -v qlmanage >/dev/null 2>&1 && command -v iconutil >/dev/null 2>&1 || return 1
  local base iconset p sz name tmp
  base="$(mktemp -d)"; iconset="$base/AppIcon.iconset"; mkdir -p "$iconset"
  for p in 16:icon_16x16.png 32:icon_16x16@2x.png 32:icon_32x32.png 64:icon_32x32@2x.png \
           128:icon_128x128.png 256:icon_128x128@2x.png 256:icon_256x256.png \
           512:icon_256x256@2x.png 512:icon_512x512.png 1024:icon_512x512@2x.png; do
    sz="${p%%:*}"; name="${p##*:}"; tmp="$(mktemp -d)"
    qlmanage -t -s "$sz" -o "$tmp" "$DIR/Resources/logomark.svg" >/dev/null 2>&1 || true
    [ -f "$tmp/logomark.svg.png" ] && cp "$tmp/logomark.svg.png" "$iconset/$name"
    rm -rf "$tmp"
  done
  iconutil -c icns "$iconset" -o "$out" >/dev/null 2>&1 || { rm -rf "$base"; return 1; }
  rm -rf "$base"; [ -f "$out" ]
}

build() {
  mkdir -p "$APP_BUNDLE/Contents/MacOS" "$APP_BUNDLE/Contents/Resources"

  echo "-> swiftc -O Sources/*.swift"
  swiftc -O \
    -framework AppKit -framework SwiftUI -framework Combine \
    -o "$APP_BUNDLE/Contents/MacOS/$PRODUCT" \
    Sources/*.swift

  cp "$DIR/Info.plist" "$APP_BUNDLE/Contents/Info.plist"
  # Menu-bar status icon (loaded as a template image at runtime).
  cp "$DIR/Resources/logomark-mono.svg" "$APP_BUNDLE/Contents/Resources/" 2>/dev/null || true
  # App icon (Finder / Dock / About).
  if make_app_icon "$APP_BUNDLE/Contents/Resources/AppIcon.icns"; then
    echo "-> app icon generated"
  else
    echo "-> app icon skipped (qlmanage/iconutil unavailable)"
  fi
  # Ad-hoc sign so the binary keeps a stable code identity across relaunches
  # within the same build (not across rebuilds — see the token-storage note
  # in Sources/ConfigStore.swift for why we don't rely on that for Keychain).
  codesign --force --deep --sign - "$APP_BUNDLE" >/dev/null 2>&1 || true

  echo "OK built $APP_BUNDLE"
}

install() {
  build

  mkdir -p "$INSTALL_DIR"
  rm -rf "$INSTALLED_APP"
  cp -R "$APP_BUNDLE" "$INSTALLED_APP"

  mkdir -p "$(dirname "$PLIST_PATH")"
  mkdir -p "$(dirname "$LOG_PATH")"

  cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LAUNCHD_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${INSTALLED_APP}/Contents/MacOS/${PRODUCT}</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Interactive</string>
  <key>StandardOutPath</key><string>${LOG_PATH}</string>
  <key>StandardErrorPath</key><string>${LOG_PATH}</string>
</dict>
</plist>
EOF

  # Use the modern launchctl API — `load`/`unload` is deprecated and doesn't
  # bind to the GUI session correctly on macOS 13+, which makes the
  # NSStatusItem invisible even though the process is running.
  launchctl bootout "gui/$UID" "$PLIST_PATH" >/dev/null 2>&1 || true
  pkill -x "$PRODUCT" >/dev/null 2>&1 || true
  launchctl bootstrap "gui/$UID" "$PLIST_PATH"

  echo "OK installed $INSTALLED_APP"
  echo "  launchd label: $LAUNCHD_LABEL"
  echo "  logs: $LOG_PATH"
  echo "  bundle id: $BUNDLE_ID"
}

uninstall() {
  launchctl bootout "gui/$UID" "$PLIST_PATH" >/dev/null 2>&1 || true
  pkill -x "$PRODUCT" >/dev/null 2>&1 || true
  rm -f "$PLIST_PATH"
  rm -rf "$INSTALLED_APP"
  echo "OK uninstalled"
}

case "$ACTION" in
  build)
    build
    ;;
  install)
    install
    ;;
  uninstall)
    uninstall
    ;;
  *)
    echo "Usage: $0 [build|install|uninstall]"
    exit 1
    ;;
esac

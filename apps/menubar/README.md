# Token Board menu bar widget (macOS)

A thin native `NSStatusItem` widget. It has no server, no WebView, and no
local state of its own beyond a server URL + auth token — it just polls the
deployed TokenBoard backend and shows today's token count in the menu bar.

## What it shows

Bar item: `TB 1.2M` (compact today total, refreshed every ~60s)

Menu:
- Today / this week / all-time token totals (or "Not connected" if
  unauthenticated or the server is unreachable)
- **Sync Now** — informational only. The CLI (`tokenboard sync`) does the
  actual syncing in the background; this just re-fetches the summary so the
  bar reflects whatever the CLI has already uploaded.
- **Open Dashboard** — opens the web dashboard in your default browser.
- **Settings…** — a small window to set the server URL and paste an auth
  token.
- **Quit**

## Build + run

```bash
cd apps/menubar
./build.sh build     # -> .build/TokenBoard.app
open .build/TokenBoard.app
```

Requires only Xcode Command Line Tools (`xcode-select --install`) — no full
Xcode, no Swift Package Manager.

### Why `swiftc` and not `swift build` / an .xcodeproj

SwiftPM's manifest-loader stack is broken on most Command Line Tools
installs: a `PackageDescription` ABI mismatch plus a duplicate
`SwiftBridging` modulemap left behind by an interrupted CLT update. Direct
`swiftc -O Sources/*.swift` compilation sidesteps that whole stack and
produces the same output. If `swiftc` itself fails with:

```
redefinition of module 'SwiftBridging'
```

fix it with:

```bash
sudo mv /Library/Developer/CommandLineTools/usr/include/swift/module.modulemap{,.bak}
```

## Install as a login item

```bash
./build.sh install
```

This compiles `TokenBoard.app`, copies it to `~/Applications/`, writes a
LaunchAgent plist at `~/Library/LaunchAgents/com.tokenboard.bar.plist`,
and registers it with `launchctl bootstrap gui/$UID` (the modern API —
`launchctl load`/`unload` is deprecated and doesn't bind to the GUI session
correctly on macOS 13+, which makes the `NSStatusItem` invisible even though
the process is running).

```bash
./build.sh uninstall
```

Runs `launchctl bootout gui/$UID/com.tokenboard.bar` and removes
the installed app + plist.

Logs: `~/Library/Logs/TokenBoardBar.log`

## Configuration

The app reads two things, in priority order:

1. **This app's own config** at
   `~/Library/Application Support/TokenBoard/config.json` (`{"baseUrl": "..."}`,
   mode 0600) — written by the Settings window. An explicit user override
   here always wins.
2. **The CLI's config** at `~/.tokenboard/config.json` (written by
   `tokenboard init` / `tokenboard link`) — read-only from here. Keys match
   the CLI's own format (`apps/cli/src/lib/config.js`): `baseUrl`,
   `deviceToken`.

If neither is set, it falls back to `http://localhost:3000`.

The auth token follows the same priority: a token pasted into Settings
(stored at `~/Library/Application Support/TokenBoard/token`, mode 0600) wins;
otherwise the app reuses the CLI's `deviceToken` from
`~/.tokenboard/config.json`.

**Why a 0600 file instead of Keychain**: every unsigned dev rebuild changes
the binary's on-disk identity, and macOS Keychain ACLs default to "this
exact binary only" — a rebuild would make the previous entry unreadable
(`errSecUserCanceled` / `-128`). A 0600 file has the same effective blast
radius (readable only by this OS user) without that rebuild-breaks-auth
footgun. See the comment on `ConfigStore` in `Sources/ConfigStore.swift`.

The bearer token is only ever sent over `https://`, or to `localhost` /
`127.0.0.1` / `*.local` for local dev — never in cleartext to a remote host.

## Endpoint

```
GET {baseUrl}/api/usage/summary?tz={TimeZone.current.identifier}
Authorization: Bearer <token>
```

Expected response:

```json
{
  "tz": "Asia/Dubai",
  "totals": { "today": "123456", "week": "987654", "month": "...", "total": "..." }
}
```

## Layout

```
apps/menubar/
├── Sources/
│   ├── AppDelegate.swift          @main entry point (LSUIElement, no dock icon)
│   ├── StatusBarController.swift  NSStatusItem + NSMenu, 60s refresh timer
│   ├── APIClient.swift            tiny URLSession wrapper for /api/usage/summary
│   ├── Models.swift                response decoding + compact number formatting
│   ├── ConfigStore.swift          server URL + token resolution/storage
│   └── SettingsWindow.swift       small SwiftUI settings form in a plain NSWindow
├── Info.plist                     template copied into the built .app bundle
├── build.sh                       build / install / uninstall
└── README.md
```

## Caveats

- **Unsigned binary**: `build.sh` ad-hoc signs the bundle so the code
  identity stays stable across relaunches within the same build, but
  Gatekeeper will still warn on first launch of a freshly built bundle
  (right-click → Open). For company-wide distribution, sign with a
  Developer ID and notarize.
- **No custom icon**: uses a plain text status item (`TB 1.2M`). Dropping in
  a `.icns` just needs an `AppIcon` entry added to `Info.plist` plus a
  `Contents/Resources/AppIcon.icns` file in `build.sh`'s `build()` step.

# Token Board menu bar widget (macOS)

Lightweight Swift menu bar app that shows your current token count and a
mini summary popover. Powered by Swift Package Manager — no Xcode project,
no code signing, no DMG packaging. Just `./build.sh` and you're done.

## What it shows

Bar item: `📊 1.7B` (compact today total)

Popover (~360×480):
- 4 stat cards: Today, 7-Day, 30-Day, Total
- Sources list (last 30 days, all 8 tools)
- Top 5 models by tokens
- Refresh + Settings + Open Dashboard + Quit
- Settings sheet for server URL + personal access token (stored in Keychain)

## Build + run

```bash
cd apps/menubar
./build.sh run
```

Requires Swift 5.5+ on a working toolchain (Xcode 15+ recommended).

### If `swift build` fails with "this SDK is not supported by the compiler"

That's a Command Line Tools version skew — your installed CLT compiler and
SDK were built with different swiftlang versions. Two fixes:

```bash
# Option A: refresh CLT
sudo rm -rf /Library/Developer/CommandLineTools
sudo xcode-select --install   # then re-run ./build.sh

# Option B: install full Xcode (also includes a matching toolchain)
mas install 497799835   # or download from https://developer.apple.com/xcode/
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

Verify with:

```bash
swift --version            # should match SDK version in MacOSX.sdk
xcrun --show-sdk-path      # path to the SDK actually being used
```

## Install as a login item

```bash
./build.sh install
```

This compiles `TokenBoardBar`, copies it to
`~/Library/Application Support/TokenBoard/`, and writes a launchd plist at
`~/Library/LaunchAgents/com.tokenboard.bar.plist` so it starts on login.

```bash
./build.sh uninstall
```

Removes everything.

## How it authenticates

The app reads two things on launch:

1. **Server URL** — picked up automatically from
   `~/.tokenboard/config.json` written by `tokenboard init` on the same Mac.
   You can also override it from the Settings sheet.

2. **Personal access token** — paste once in Settings. Stored in macOS
   Keychain as `service=com.tokenboard.bar`. The bar app uses this token
   to call `/api/v1/usage/summary`, `/usage/daily`, `/usage/model-breakdown`.

> A "personal access token" is a long-lived user JWT or refresh-issued JWT.
> The dashboard's Settings page can expose a "Generate token for menu bar"
> button — that's a small follow-up. For now, paste an `access_token` from a
> recent `/api/v1/auth/login` response, or any short-lived JWT you have at
> hand. The bar app handles 401 by surfacing a "Not connected" prompt.

## Layout

```
apps/menubar/
├── Package.swift
├── Sources/TokenBoardBar/
│   ├── main.swift            # NSApp.run() entry point (accessory policy)
│   ├── AppDelegate.swift     # status bar item + popover wiring
│   ├── APIClient.swift       # tiny URLSession wrapper
│   ├── Models.swift          # API response types + CLI config loader
│   ├── Settings.swift        # UserDefaults + Keychain
│   ├── UsageViewModel.swift  # fetches in parallel, publishes summary
│   └── UsageView.swift       # SwiftUI popover
├── build.sh                  # build / run / install / uninstall
└── README.md
```

## Caveats

- **Unsigned binary**: `swift build -c release` produces an ad-hoc-signed
  Mach-O. Gatekeeper won't block running it from the user's own home dir
  but will warn on first download. For company-wide rollout, sign with your
  Developer ID and notarize before distribution.
- **No icon assets**: the app uses an inline-drawn template image. To bundle
  a `.icns` you'd need a proper `.app` bundle (Xcode project or a
  `Contents/Info.plist` + `Resources/` layout).
- **Refresh cadence**: every 5 minutes via `Timer.scheduledTimer`. Cheap on
  the API; the popover does an extra refresh on each open.

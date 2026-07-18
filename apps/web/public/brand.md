# TokenBoard Brand Guidelines

## Concept

The TokenBoard logo represents **ascending token bars** — a visual metaphor combining two core concepts:

1. **Tokens** — represented as pill-shaped capsules (rounded rectangles)
2. **Leaderboard ranking** — shown through ascending bar heights (3rd, 2nd, 1st place)

The three bars rise from left to right, creating a clean, technical mark that communicates competitive progress and measurement. The geometric simplicity ensures the mark remains crisp at any size, from 16px favicons to large-format displays.

## Color Palette

### Primary Brand Color
**Cyan 500**: `#06b6d4`

### Supporting Tones (for depth in the logomark)
- **Cyan 600**: `#0891b2` (middle bar)
- **Cyan 700**: `#0e7490` (tallest bar)

These three shades create subtle depth while maintaining a cohesive cyan identity. The cyan family was chosen for its technical, modern feel — it's distinctive in developer tools, works well on both light and dark backgrounds, and conveys precision without being aggressive.

### Text Color
**Slate 900**: `#0f172a` (for wordmark text on light backgrounds)

## Usage Guidelines

### Light Mode
- Use the full-color `logomark.svg` or `logo-wordmark.svg` directly on light backgrounds
- The cyan tones provide sufficient contrast against white/light gray backgrounds
- Text in wordmark is slate-900 for maximum readability

### Dark Mode
- The logomark's cyan shades work well on dark backgrounds (no separate dark variant needed)
- For the wordmark on dark backgrounds, you may want to invert the text fill to white or slate-100
- The mono version (`logomark-mono.svg`) inherits the current text color, making it theme-adaptive

### File Reference

| File | Usage | Notes |
|------|-------|-------|
| `logomark.svg` | App icons, standalone mark | Square 64×64, full color, works on light or dark |
| `logomark-mono.svg` | macOS menu bar, monochrome contexts | Uses `fill="currentColor"`, adapts to system theme |
| `logo-wordmark.svg` | Headers, splash screens, marketing | Horizontal lockup ~280×64, text as vector paths |
| `favicon.svg` | Browser favicon | Optimized for 16×16 display, same as logomark |

### Sizing Recommendations

- **Minimum size**: 16×16px (favicon)
- **Menu bar / system tray**: 16×16px to 22×22px (use mono version)
- **App icon**: 64×64px, 128×128px, 256×256px, 512×512px
- **Header logo**: 120px to 180px wide (wordmark)
- **Hero sections**: up to 400px wide

### Clear Space
Maintain clear space around the logo equal to at least 25% of the logo's width on all sides. For the wordmark, use the height of one bar as the minimum clear-space unit.

### What NOT to Do
- Do not rotate or skew the logo
- Do not change the aspect ratio (always scale proportionally)
- Do not add drop shadows, gradients, or effects
- Do not place on busy backgrounds that reduce contrast
- Do not use colors outside the brand palette for the logomark
- Do not recreate the wordmark in a system font (always use the vector version)

## Export Notes

All files are pure SVG with no external dependencies:
- No web fonts (wordmark text converted to paths)
- No `<image>` tags or external resources
- Self-contained, render identically everywhere
- Optimized coordinates and clean viewBox values

These assets are production-ready for web, native apps, and print.

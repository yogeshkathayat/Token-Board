/**
 * Per-source mini-logos for the leaderboard. Letter-based with brand-evocative
 * gradients so each tool is instantly recognizable without using any
 * copyrighted brand mark.
 */

type Source =
  | 'claude'
  | 'codex'
  | 'gemini'
  | 'opencode'
  | 'kiro'
  | 'cursor'
  | 'copilot'
  | 'openrouter'
  | 'other';

interface IconStyle {
  letter: string;
  fg: string;
  bg: string;
}

const STYLES: Record<Source, IconStyle> = {
  // warm orange — Anthropic's signature feel
  claude: { letter: 'C', fg: '#ffffff', bg: 'linear-gradient(135deg,#d97706,#f59e0b)' },
  // muted green/teal — OpenAI Codex
  codex: { letter: 'X', fg: '#ffffff', bg: 'linear-gradient(135deg,#0f766e,#10b981)' },
  // Google-style multi-stop gradient
  gemini: { letter: 'G', fg: '#ffffff', bg: 'linear-gradient(135deg,#1d4ed8,#a855f7,#ec4899)' },
  // purple — OpenCode community vibe
  opencode: { letter: 'O', fg: '#ffffff', bg: 'linear-gradient(135deg,#7c3aed,#a855f7)' },
  // AWS-ish navy + amber accent
  kiro: { letter: 'K', fg: '#ffffff', bg: 'linear-gradient(135deg,#1e3a8a,#0ea5e9)' },
  // monochrome wedge — Cursor
  cursor: { letter: 'R', fg: '#ffffff', bg: 'linear-gradient(135deg,#1f2937,#4b5563)' },
  // GitHub charcoal/blue
  copilot: { letter: 'P', fg: '#ffffff', bg: 'linear-gradient(135deg,#0f172a,#3b82f6)' },
  // OpenRouter orange
  openrouter: { letter: 'R', fg: '#ffffff', bg: 'linear-gradient(135deg,#ea580c,#f97316)' },
  // catch-all
  other: { letter: '·', fg: '#475569', bg: '#e2e8f0' },
};

const LABELS: Record<Source, string> = {
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini',
  opencode: 'OpenCode',
  kiro: 'Kiro',
  cursor: 'Cursor',
  copilot: 'Copilot',
  openrouter: 'OpenRouter',
  other: 'Other',
};

export function SourceIcon({ source, size = 20 }: { source: Source; size?: number }) {
  const style = STYLES[source] ?? STYLES.other;
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-md font-semibold uppercase"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.floor(size * 0.5)),
        color: style.fg,
        background: style.bg,
        letterSpacing: '-0.02em',
      }}
    >
      {style.letter}
    </span>
  );
}

export function SourceBadge({ source, size = 18 }: { source: Source; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <SourceIcon source={source} size={size} />
      <span className="text-xs font-medium">{LABELS[source]}</span>
    </span>
  );
}

export function sourceLabel(source: Source): string {
  return LABELS[source] ?? source;
}

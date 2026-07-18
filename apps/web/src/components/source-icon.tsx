import { cn } from '@/lib/utils';

type Source = 'claude' | 'codex' | 'cursor' | 'kiro' | 'gemini' | 'opencode' | 'other';

interface SourceIconProps {
  source: Source;
  className?: string;
}

export const SOURCE_META: Record<Source, { label: string; color: string }> = {
  claude: {
    label: 'Claude',
    color: 'oklch(0.62 0.18 27)',
  },
  codex: {
    label: 'Codex',
    color: 'oklch(0.55 0.16 170)',
  },
  cursor: {
    label: 'Cursor',
    color: 'oklch(0.50 0.20 265)',
  },
  gemini: {
    label: 'Gemini',
    color: 'oklch(0.58 0.18 238)',
  },
  kiro: {
    label: 'Kiro',
    color: 'oklch(0.65 0.20 145)',
  },
  opencode: {
    label: 'OpenCode',
    color: 'oklch(0.60 0.22 75)',
  },
  other: {
    label: 'Other',
    color: 'oklch(0.55 0.05 240)',
  },
};

function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Claude"
    >
      <path
        d="M12 3L4 8v8l8 5 8-5V8l-8-5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M12 8v8M8 10l4 4 4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CodexIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Codex"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
      <path
        d="M8 12l2-2m0 4l-2-2m6 0l2 2m0-4l-2 2M12 8v8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CursorIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Cursor"
    >
      <path
        d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M13 13l6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GeminiIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Gemini"
    >
      <path
        d="M12 2L2 7l10 5 10-5-10-5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M2 17l10 5 10-5M2 12l10 5 10-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KiroIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Kiro"
    >
      <path
        d="M12 2v20M2 12h20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4" />
    </svg>
  );
}

function OpenCodeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="OpenCode"
    >
      <path
        d="M8 6L4 12l4 6M16 6l4 6-4 6M14 4l-4 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OtherIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Other"
    >
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <circle cx="8" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="16" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

const ICON_MAP: Record<Source, React.ComponentType<{ className?: string }>> = {
  claude: ClaudeIcon,
  codex: CodexIcon,
  cursor: CursorIcon,
  gemini: GeminiIcon,
  kiro: KiroIcon,
  opencode: OpenCodeIcon,
  other: OtherIcon,
};

export function SourceIcon({ source, className }: SourceIconProps) {
  const Icon = ICON_MAP[source] || OtherIcon;
  return <Icon className={cn('h-4 w-4', className)} />;
}

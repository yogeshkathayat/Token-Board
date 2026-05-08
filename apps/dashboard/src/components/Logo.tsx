import { useId } from 'react';

/**
 * Token Board brandmark — a stacked-bar leaderboard glyph inside a token coin.
 * Renders crisply at any size and uses React.useId so multiple instances on a
 * page don't collide on the gradient `<defs>` reference.
 */
export function Logo({ size = 28, className = '' }: { size?: number; className?: string }) {
  const reactId = useId();
  const gradId = `tb-grad-${reactId.replace(/:/g, '')}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Token Board"
      className={className}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="60%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="28" height="28" rx="8" fill={`url(#${gradId})`} />
      {/* Three ascending bars — the leaderboard motif. */}
      <rect x="8" y="18" width="4" height="7" rx="1" fill="white" fillOpacity="0.95" />
      <rect x="14" y="13" width="4" height="12" rx="1" fill="white" fillOpacity="0.95" />
      <rect x="20" y="8" width="4" height="17" rx="1" fill="white" fillOpacity="0.95" />
    </svg>
  );
}

export function LogoWordmark({
  size = 22,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <Logo size={size} />
      <span>
        Token<span className="text-brand-500">Board</span>
      </span>
    </span>
  );
}

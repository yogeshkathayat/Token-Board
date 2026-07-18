'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseCursorGlowOptions {
  /** Glow color (default: 'rgba(225, 29, 72, 0.35)') */
  color?: string;
  /** Glow radius in percentage (default: 60) */
  size?: number;
  /** Disable the effect */
  disabled?: boolean;
}

interface UseCursorGlowReturn {
  ref: React.RefObject<HTMLDivElement | null>;
  glowStyle: React.CSSProperties;
  isHovering: boolean;
}

/**
 * Cursor-following radial glow effect hook.
 *
 * Tracks the cursor over a referenced element and renders a
 * `radial-gradient` overlay that follows the pointer, creating a
 * soft light-under-glass effect. The overlay fades in on enter
 * and out on leave.
 *
 * @example
 * ```tsx
 * const { ref, glowStyle, isHovering } = useCursorGlow({ color: 'rgba(99,102,241,0.3)' });
 * return (
 *   <div ref={ref} style={{ position: 'relative' }}>
 *     <div style={glowStyle} />
 *     <div style={{ position: 'relative', zIndex: 1 }}>Content</div>
 *   </div>
 * );
 * ```
 */
export function useCursorGlow(options: UseCursorGlowOptions = {}): UseCursorGlowReturn {
  const { color = 'rgba(225, 29, 72, 0.35)', size = 60, disabled = false } = options;

  const ref = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!ref.current || disabled) return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setPosition({ x, y });
        rafRef.current = 0;
      });
    },
    [disabled],
  );

  const handleMouseEnter = useCallback(() => {
    if (!disabled) setIsHovering(true);
  }, [disabled]);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element || disabled) return;

    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleMouseMove, handleMouseEnter, handleMouseLeave, disabled]);

  const glowStyle: React.CSSProperties = isHovering
    ? {
        background: `radial-gradient(circle at ${position.x}% ${position.y}%, ${color}, transparent ${size}%)`,
        position: 'absolute' as const,
        inset: 0,
        borderRadius: 'inherit',
        pointerEvents: 'none' as const,
        transition: 'opacity 0.3s ease',
        opacity: 1,
        zIndex: 0,
      }
    : {
        position: 'absolute' as const,
        inset: 0,
        borderRadius: 'inherit',
        pointerEvents: 'none' as const,
        opacity: 0,
        zIndex: 0,
      };

  return { ref, glowStyle, isHovering };
}

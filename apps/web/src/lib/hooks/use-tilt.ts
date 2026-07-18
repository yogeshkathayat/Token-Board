'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseTiltOptions {
  /** Max tilt angle in degrees (default: 8) */
  maxTilt?: number;
  /** Scale on hover (default: 1.02) */
  scale?: number;
  /** CSS perspective value (default: 800) */
  perspective?: number;
  /** Transition speed in ms (default: 400) */
  speed?: number;
  /** CSS easing function */
  easing?: string;
}

interface UseTiltReturn {
  ref: React.RefObject<HTMLDivElement | null>;
  style: React.CSSProperties;
}

/**
 * Mouse-responsive 3D tilt effect hook.
 *
 * Tracks the cursor position over a referenced element and applies
 * a perspective-based rotateX/rotateY transform, producing a smooth
 * 3D card-tilt effect. The transform resets when the cursor leaves.
 *
 * @example
 * ```tsx
 * const { ref, style } = useTilt({ maxTilt: 10, scale: 1.03 });
 * return <div ref={ref} style={style}>Tilt me</div>;
 * ```
 */
export function useTilt(options: UseTiltOptions = {}): UseTiltReturn {
  const {
    maxTilt = 8,
    scale = 1.02,
    perspective = 800,
    speed = 400,
    easing = 'cubic-bezier(0.03, 0.98, 0.52, 0.99)',
  } = options;

  const ref = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const [transform, setTransform] = useState('');

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!ref.current) return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const rotateX = ((e.clientY - centerY) / (rect.height / 2)) * -maxTilt;
        const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * maxTilt;

        setTransform(
          `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale}, ${scale}, ${scale})`,
        );
      });
    },
    [maxTilt, scale, perspective],
  );

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setTransform(`perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`);
  }, [perspective]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseleave', handleMouseLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleMouseMove, handleMouseLeave]);

  const style: React.CSSProperties = {
    transform: transform || `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`,
    transformStyle: 'preserve-3d',
    willChange: 'transform',
    backfaceVisibility: 'hidden',
    transition: `transform ${speed}ms ${easing}`,
  };

  return { ref, style };
}

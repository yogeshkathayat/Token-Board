'use client';

import * as React from 'react';

import { Card } from '@/components/ui/card';
import { useCursorGlow } from '@/lib/hooks/use-cursor-glow';
import { useTilt } from '@/lib/hooks/use-tilt';
import { cn } from '@/lib/utils';

interface AnimatedCardProps extends React.ComponentProps<typeof Card> {
  /** Enable 3D mouse-tracking tilt */
  tilt?: boolean;
  /** Enable cursor-following radial glow overlay */
  glow?: boolean;
  /** Enable floating animation (1 = subtle, 2 = medium, 3 = gentle) */
  float?: 1 | 2 | 3;
  /** Custom glow color (CSS color string) */
  glowColor?: string;
  /** Fine-tune tilt behaviour */
  tiltOptions?: {
    maxTilt?: number;
    scale?: number;
    perspective?: number;
  };
}

function AnimatedCard({
  tilt = false,
  glow = false,
  float,
  glowColor,
  tiltOptions,
  className,
  children,
  ...props
}: AnimatedCardProps) {
  const { ref: tiltRef, style: tiltStyle } = useTilt({
    ...tiltOptions,
    maxTilt: tilt ? (tiltOptions?.maxTilt ?? 8) : 0,
    scale: tilt ? (tiltOptions?.scale ?? 1.02) : 1,
  });

  const { ref: glowRef, glowStyle } = useCursorGlow({
    color: glowColor,
    disabled: !glow,
  });

  const mergedRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      (tiltRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      (glowRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [tiltRef, glowRef],
  );

  const floatClass = float ? `animate-float-${float}` : '';

  return (
    <Card
      ref={mergedRef}
      className={cn('relative overflow-hidden', tilt && 'card-3d', floatClass, className)}
      style={tilt ? tiltStyle : undefined}
      {...props}
    >
      {glow && <div style={glowStyle} aria-hidden="true" />}
      <div className="relative z-10">{children}</div>
    </Card>
  );
}
AnimatedCard.displayName = 'AnimatedCard';

export { AnimatedCard, type AnimatedCardProps };

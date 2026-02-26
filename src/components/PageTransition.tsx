'use client';

import { ReactNode } from 'react';

/**
 * PageTransition — NUCLEAR TEST: no animation at all.
 * Renders immediately at full opacity to test if the
 * flicker is caused by the animation system.
 */
export default function PageTransition({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{ overflowX: 'hidden', ...style }}
    >
      {children}
    </div>
  );
}

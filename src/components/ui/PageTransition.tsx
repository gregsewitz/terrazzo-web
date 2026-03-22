'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';

/**
 * PageTransition — smooth page entry animation.
 *
 * Uses a CSS transition instead of Framer Motion's WAAPI to avoid the
 * Safari bug where removing a WAAPI animation causes a one-frame flash
 * to opacity 0 before the inline style takes effect.
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
  const [visible, setVisible] = useState(false);
  const divRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Trigger on next frame so the initial opacity:0 is painted first
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      ref={divRef}
      className={className}
      style={{
        overflowX: 'hidden',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

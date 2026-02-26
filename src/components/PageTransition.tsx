'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * PageTransition — prevents the SSR hydration flash.
 *
 * Problem: Server renders content visible, then framer-motion hides it
 * during hydration (initial={{ opacity: 0 }}), then animates it back.
 * This causes a visible strobe/flash on mobile.
 *
 * Solution: Render with `style={{ opacity: 0 }}` so both SSR and client
 * start hidden. Framer-motion then smoothly fades the page in.
 * Child animations (staggers, etc.) still play normally underneath.
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
    <motion.div
      className={className}
      style={{ opacity: 0, overflowX: 'hidden', ...style }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
    >
      {children}
    </motion.div>
  );
}

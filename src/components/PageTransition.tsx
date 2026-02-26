'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * PageTransition — smooth page entry animation.
 *
 * Uses framer-motion `initial` + `animate` (not `style`) so the hidden
 * state is managed entirely by framer-motion and never re-applied by React
 * on re-renders.
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
      style={{ overflowX: 'hidden', ...style }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
    >
      {children}
    </motion.div>
  );
}

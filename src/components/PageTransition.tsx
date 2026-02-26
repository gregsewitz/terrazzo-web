'use client';

import { motion } from 'framer-motion';
import { ReactNode, useEffect, useRef } from 'react';

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
  const renderCount = useRef(0);
  const divRef = useRef<HTMLDivElement | null>(null);
  renderCount.current += 1;

  if (typeof window !== 'undefined') {
    console.log(
      `%c[PageTransition] RENDER #${renderCount.current} @ ${performance.now().toFixed(1)}ms`,
      'color: #9C27B0; font-weight: bold'
    );
  }

  useEffect(() => {
    const el = divRef.current;
    if (!el) return;

    console.log(
      `%c[PageTransition] MOUNTED — monitoring opacity @ ${performance.now().toFixed(1)}ms`,
      'color: #4CAF50; font-weight: bold'
    );

    let lastOp = '';
    let lastTransform = '';
    const rafLoop = () => {
      if (!divRef.current) return;
      const cs = getComputedStyle(divRef.current);
      if (cs.opacity !== lastOp) {
        const prev = lastOp;
        lastOp = cs.opacity;
        if (prev !== '') {
          const emoji = parseFloat(cs.opacity) < parseFloat(prev) ? '🔴' : '🟢';
          console.log(
            `%c[PageTransition] ${emoji} OPACITY: ${prev} → ${cs.opacity} @ ${performance.now().toFixed(1)}ms`,
            `color: ${parseFloat(cs.opacity) < parseFloat(prev) ? '#f44336' : '#4CAF50'}; font-weight: bold`
          );
        }
      }
      if (cs.transform !== lastTransform) {
        const prev = lastTransform;
        lastTransform = cs.transform;
        if (prev !== '') {
          console.log(
            `%c[PageTransition] 🔄 TRANSFORM: ${prev} → ${cs.transform} @ ${performance.now().toFixed(1)}ms`,
            'color: #FF9800; font-weight: bold'
          );
        }
      }
      requestAnimationFrame(rafLoop);
    };
    const id = requestAnimationFrame(rafLoop);

    // Watch for style mutations
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'style') {
          console.log(
            `%c[PageTransition] 🎨 STYLE MUTATED: "${(m.target as HTMLElement).style.cssText}" @ ${performance.now().toFixed(1)}ms`,
            'color: #E91E63; font-weight: bold'
          );
        }
      }
    });
    mo.observe(el, { attributes: true, attributeFilter: ['style'] });

    return () => {
      cancelAnimationFrame(id);
      mo.disconnect();
      console.log(
        `%c[PageTransition] UNMOUNTED @ ${performance.now().toFixed(1)}ms`,
        'color: #f44336; font-weight: bold; font-size: 14px'
      );
    };
  }, []);

  return (
    <motion.div
      ref={divRef}
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

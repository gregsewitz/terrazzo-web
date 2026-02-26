'use client';

import { motion } from 'framer-motion';
import { ReactNode, useEffect, useRef } from 'react';

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
  // ── DEBUG: track PageTransition renders and opacity ──
  const _rc = useRef(0);
  const divRef = useRef<HTMLDivElement>(null);
  _rc.current += 1;
  console.log(`[PageTransition] render #${_rc.current}`);

  useEffect(() => {
    console.log('[PageTransition] MOUNTED');
    // Monitor opacity changes on this element
    const el = divRef.current;
    if (el) {
      const observer = new MutationObserver(() => {
        console.log('[PageTransition] style mutated, opacity:', el.style.opacity);
      });
      observer.observe(el, { attributes: true, attributeFilter: ['style'] });
      // Also log current computed opacity every 100ms for the first 2 seconds
      let count = 0;
      const interval = setInterval(() => {
        count++;
        const computed = window.getComputedStyle(el).opacity;
        console.log(`[PageTransition] opacity check #${count}: ${computed}`);
        if (count >= 20) clearInterval(interval);
      }, 100);
      return () => {
        observer.disconnect();
        clearInterval(interval);
        console.log('[PageTransition] UNMOUNTED');
      };
    }
    return () => console.log('[PageTransition] UNMOUNTED (no ref)');
  }, []);

  return (
    <motion.div
      ref={divRef}
      className={className}
      style={{ opacity: 0, overflowX: 'hidden', ...style }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
    >
      {children}
    </motion.div>
  );
}

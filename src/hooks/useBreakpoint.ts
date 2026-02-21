'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

const BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
} as const;

/** Read breakpoint synchronously from window (client only) */
function getBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return 'mobile';
  const w = window.innerWidth;
  if (w >= BREAKPOINTS.desktop) return 'desktop';
  if (w >= BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
}

/**
 * Responsive breakpoint hook — returns current layout mode.
 * Uses useSyncExternalStore so the first client render is already
 * correct (no hydration flash from mobile → desktop).
 */
export function useBreakpoint(): Breakpoint {
  const bp = useSyncExternalStore(
    (callback) => {
      const mqDesktop = window.matchMedia(`(min-width: ${BREAKPOINTS.desktop}px)`);
      const mqTablet = window.matchMedia(`(min-width: ${BREAKPOINTS.tablet}px)`);
      mqDesktop.addEventListener('change', callback);
      mqTablet.addEventListener('change', callback);
      return () => {
        mqDesktop.removeEventListener('change', callback);
        mqTablet.removeEventListener('change', callback);
      };
    },
    getBreakpoint,      // client snapshot
    (): Breakpoint => 'mobile',     // server snapshot (SSR fallback)
  );

  return bp;
}

/** Helper: is current breakpoint at least desktop? */
export function useIsDesktop(): boolean {
  return useBreakpoint() === 'desktop';
}

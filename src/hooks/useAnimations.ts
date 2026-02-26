'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Detect Safari on iOS/iPadOS. Cached after first call.
 * On the server (SSR) this returns false — animations will be enabled
 * by default and the client will correct on hydration if needed.
 */
let _isMobileSafari: boolean | null = null;
export function isMobileSafari(): boolean {
  if (_isMobileSafari !== null) return _isMobileSafari;
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iOS Safari: contains "AppleWebKit" and "Mobile" but not "CriOS" (Chrome)
  // or "FxiOS" (Firefox) or "EdgiOS" (Edge)
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /AppleWebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  _isMobileSafari = isIOS && isSafari;
  return _isMobileSafari;
}

/**
 * Hook that detects when an element enters the viewport.
 * Returns [ref, isInView] — attach the ref to the element you want to observe.
 *
 * On Safari mobile, animations are disabled (returns true immediately) to avoid
 * a WAAPI compositor bug that causes elements to flicker/strobe after animating.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  options: { threshold?: number; once?: boolean; rootMargin?: string } = {},
): [React.RefObject<T | null>, boolean] {
  const { threshold = 0.15, once = true, rootMargin = '0px 0px -40px 0px' } = options;
  const ref = useRef<T | null>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    // On Safari mobile, skip animations entirely — elements render immediately.
    // This avoids the flicker/strobe bug with no visual downside on mobile
    // where scroll-triggered animations are less impactful anyway.
    if (isMobileSafari()) {
      setIsInView(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    let timerId: ReturnType<typeof setTimeout> | null = null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Use a 50ms setTimeout to guarantee the browser has painted the
          // initial hidden state before we trigger the CSS transition.
          timerId = setTimeout(() => {
            setIsInView(true);
          }, 50);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setIsInView(false);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timerId !== null) clearTimeout(timerId);
    };
  }, [threshold, once, rootMargin]);

  return [ref, isInView];
}

/**
 * Hook that counts up from 0 to a target number when triggered.
 */
export function useCountUp(target: number, isActive: boolean, duration = 1200): number {
  const [current, setCurrent] = useState(0);
  const startTime = useRef<number | null>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!isActive) return;

    startTime.current = null;
    const animate = (timestamp: number) => {
      if (startTime.current === null) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(eased * target));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isActive, target, duration]);

  return current;
}

/**
 * Hook for staggered children animations.
 * Returns a function that provides delay for index i.
 */
export function useStagger(staggerMs = 80) {
  return useCallback((index: number) => index * staggerMs / 1000, [staggerMs]);
}

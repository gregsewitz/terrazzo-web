'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook that detects when an element enters the viewport.
 * Returns [ref, isInView] — attach the ref to the element you want to observe.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  options: { threshold?: number; once?: boolean; rootMargin?: string } = {},
): [React.RefObject<T | null>, boolean] {
  const { threshold = 0.15, once = true, rootMargin = '0px 0px -40px 0px' } = options;
  const ref = useRef<T | null>(null);
  const seen = useRef(false);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    // If already seen with once=true, no need to observe again
    if (seen.current && once) return;

    const el = ref.current;
    if (!el) return;

    // Synchronous viewport check — avoids the async IntersectionObserver
    // gap that causes elements to flicker back to hidden on re-render
    const rect = el.getBoundingClientRect();
    if (
      rect.top < window.innerHeight + 40 &&
      rect.bottom > 0
    ) {
      seen.current = true;
      setIsInView(true);
      if (once) return; // Don't even set up the observer
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          seen.current = true;
          setIsInView(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setIsInView(false);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once, rootMargin]);

  // Once seen with once=true, always return true regardless of state
  return [ref, seen.current || isInView];
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

'use client';

import { useInView } from '@/hooks/useAnimations';
import type { ReactNode, CSSProperties } from 'react';
import { useEffect, useState, forwardRef, useRef, useCallback } from 'react';

const CSS_EASE_OUT_EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)';

/**
 * Safari-safe replacement for Framer Motion's whileInView opacity animation.
 *
 * Uses CSS transitions instead of WAAPI to avoid the Safari bug where
 * removing a finished WAAPI animation causes a one-frame flash to opacity 0.
 */

interface SafeFadeInProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  duration?: number;
  delay?: number;
  /** Direction to animate from */
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number;
  /** Also animate scale */
  scale?: number;
  /** IntersectionObserver margin */
  viewMargin?: string;
  /** Only animate once */
  once?: boolean;
}

export const SafeFadeIn = forwardRef<HTMLDivElement, SafeFadeInProps>(function SafeFadeIn({
  children, className, style,
  duration = 0.6, delay = 0,
  direction = 'none', distance = 20,
  scale,
  viewMargin = '-100px',
  once = true,
}, forwardedRef) {
  const [inViewRef, isInView] = useInView({ threshold: 0.05 });
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const localRef = useRef<HTMLDivElement | null>(null);

  const setRefs = useCallback((node: HTMLDivElement | null) => {
    localRef.current = node;
    // Set the inView ref
    (inViewRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    // Set the forwarded ref
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [inViewRef, forwardedRef]);

  useEffect(() => {
    if (isInView && !hasBeenVisible) setHasBeenVisible(true);
  }, [isInView, hasBeenVisible]);

  const show = once ? hasBeenVisible : isInView;

  const getTransform = () => {
    const parts: string[] = [];
    if (!show) {
      switch (direction) {
        case 'up': parts.push(`translateY(${distance}px)`); break;
        case 'down': parts.push(`translateY(${-distance}px)`); break;
        case 'left': parts.push(`translateX(${distance}px)`); break;
        case 'right': parts.push(`translateX(${-distance}px)`); break;
      }
    }
    if (scale !== undefined && !show) {
      parts.push(`scale(${scale})`);
    }
    return parts.length > 0 ? parts.join(' ') : undefined;
  };

  const transitionProps = [
    `opacity ${duration}s ${CSS_EASE_OUT_EXPO} ${delay}s`,
  ];
  if (direction !== 'none') {
    transitionProps.push(`transform ${duration}s ${CSS_EASE_OUT_EXPO} ${delay}s`);
  }
  if (scale !== undefined) {
    if (!transitionProps.some(t => t.startsWith('transform'))) {
      transitionProps.push(`transform ${duration}s ${CSS_EASE_OUT_EXPO} ${delay}s`);
    }
  }

  return (
    <div
      ref={setRefs}
      className={className}
      style={{
        opacity: show ? 1 : 0,
        transform: getTransform(),
        transition: transitionProps.join(', '),
        ...style,
      }}
    >
      {children}
    </div>
  );
});

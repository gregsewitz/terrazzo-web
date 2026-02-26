'use client';

import { motion, AnimatePresence, type Variants, type Transition } from 'framer-motion';
import { useInView, useCountUp } from '@/hooks/useAnimations';
import { FONT } from '@/constants/theme';
import type { ReactNode, CSSProperties } from 'react';
import { useEffect, useState, createContext, useContext, useRef, useCallback } from 'react';

// ─── Shared animation presets ───

const EASE_OUT_EXPO: Transition['ease'] = [0.16, 1, 0.3, 1];
const EASE_OUT_QUART: Transition['ease'] = [0.25, 1, 0.5, 1];

// CSS easing equivalents for CSS transitions
const CSS_EASE_OUT_EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)';

// ─── Fade-in on scroll (Safari-safe CSS transition) ───

interface FadeInSectionProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number;
  duration?: number;
}

export function FadeInSection({
  children, delay = 0, className, style,
  direction = 'up', distance = 24, duration = 0.7,
}: FadeInSectionProps) {
  const [ref, isInView] = useInView({ threshold: 0.1 });
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  useEffect(() => {
    if (isInView && !hasBeenVisible) setHasBeenVisible(true);
  }, [isInView, hasBeenVisible]);

  const show = hasBeenVisible;

  const getTranslate = () => {
    switch (direction) {
      case 'up': return show ? 'translate3d(0,0,0)' : `translate3d(0,${distance}px,0)`;
      case 'down': return show ? 'translate3d(0,0,0)' : `translate3d(0,${-distance}px,0)`;
      case 'left': return show ? 'translate3d(0,0,0)' : `translate3d(${distance}px,0,0)`;
      case 'right': return show ? 'translate3d(0,0,0)' : `translate3d(${-distance}px,0,0)`;
      case 'none': return 'translate3d(0,0,0)';
    }
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: show ? 1 : 0,
        transform: getTranslate(),
        transition: `opacity ${duration}s ${CSS_EASE_OUT_EXPO} ${delay}s, transform ${duration}s ${CSS_EASE_OUT_EXPO} ${delay}s`,
        willChange: show ? 'auto' : 'opacity, transform',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Staggered children container (Safari-safe CSS transitions) ───

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  staggerDelay?: number;
  delayStart?: number;
}

interface StaggerContextValue {
  isVisible: boolean;
  getDelay: () => number;
}

const StaggerContext = createContext<StaggerContextValue>({
  isVisible: false,
  getDelay: () => 0,
});

export function StaggerContainer({
  children, className, style, staggerDelay = 0.08, delayStart = 0,
}: StaggerContainerProps) {
  const [ref, isInView] = useInView({ threshold: 0.1 });
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    if (isInView && !hasBeenVisible) setHasBeenVisible(true);
  }, [isInView, hasBeenVisible]);

  // Reset index counter on each render so children get consistent delays
  indexRef.current = 0;

  const getDelay = useCallback(() => {
    const i = indexRef.current++;
    return delayStart + i * staggerDelay;
  }, [delayStart, staggerDelay]);

  return (
    <StaggerContext.Provider value={{ isVisible: hasBeenVisible, getDelay }}>
      <div ref={ref} className={className} style={style}>
        {children}
      </div>
    </StaggerContext.Provider>
  );
}

export function StaggerItem({
  children, className, style,
}: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const { isVisible, getDelay } = useContext(StaggerContext);
  // Capture delay on first render so it stays stable
  const [delay] = useState(() => getDelay());

  return (
    <div
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translate3d(0,0,0)' : 'translate3d(0,16px,0)',
        transition: `opacity 0.5s ${CSS_EASE_OUT_EXPO} ${delay}s, transform 0.5s ${CSS_EASE_OUT_EXPO} ${delay}s`,
        willChange: isVisible ? 'auto' : 'opacity, transform',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Animated progress bar ───

interface AnimatedBarProps {
  percentage: number;
  color: string;
  height?: number;
  delay?: number;
  bgColor?: string;
  borderRadius?: number;
}

export function AnimatedBar({
  percentage, color, height = 8, delay = 0,
  bgColor = 'rgba(28,26,23,0.06)', borderRadius = 999,
}: AnimatedBarProps) {
  const [ref, isInView] = useInView({ threshold: 0.3 });
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  useEffect(() => {
    if (isInView && !hasBeenVisible) setHasBeenVisible(true);
  }, [isInView, hasBeenVisible]);

  const show = hasBeenVisible;

  return (
    <div ref={ref} style={{ height, borderRadius, background: bgColor, overflow: 'hidden' }}>
      <div
        style={{
          height: '100%',
          borderRadius,
          background: `linear-gradient(90deg, ${color}80, ${color})`,
          width: `${percentage}%`,
          transform: show ? 'scaleX(1)' : 'scaleX(0)',
          transformOrigin: 'left',
          transition: `transform 1s ${CSS_EASE_OUT_EXPO} ${delay}s`,
          willChange: show ? 'auto' : 'transform',
        }}
      />
    </div>
  );
}

// ─── Animated spectrum marker ───

interface AnimatedSpectrumProps {
  percentage: number;
  markerColor?: string;
  delay?: number;
  bgGradient?: string;
}

export function AnimatedSpectrum({
  percentage, markerColor = '#8b6b4a', delay = 0,
  bgGradient = 'linear-gradient(90deg, rgba(28,26,23,0.06), rgba(28,26,23,0.15))',
}: AnimatedSpectrumProps) {
  const [ref, isInView] = useInView({ threshold: 0.3 });
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  useEffect(() => {
    if (isInView && !hasBeenVisible) setHasBeenVisible(true);
  }, [isInView, hasBeenVisible]);

  const show = hasBeenVisible;
  const CSS_EASE_QUART = 'cubic-bezier(0.25, 1, 0.5, 1)';

  return (
    <div ref={ref} className="relative h-2 rounded-full" style={{ background: bgGradient }}>
      <div
        className="absolute top-1/2 w-3 h-3 rounded-full border-2"
        style={{
          left: show ? `${percentage}%` : '50%',
          opacity: show ? 1 : 0,
          transform: show
            ? 'translate(-50%, -50%) scale(1)'
            : 'translate(-50%, -50%) scale(0)',
          transition: `left 0.8s ${CSS_EASE_QUART} ${delay}s, opacity 0.8s ${CSS_EASE_QUART} ${delay}s, transform 0.8s ${CSS_EASE_QUART} ${delay}s`,
          background: markerColor,
          borderColor: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          willChange: show ? 'auto' : 'left, opacity, transform',
        }}
      />
    </div>
  );
}

// ─── Animated counter ───

interface AnimatedNumberProps {
  value: number;
  style?: CSSProperties;
  className?: string;
  suffix?: string;
  prefix?: string;
}

export function AnimatedNumber({ value, style, className, suffix = '', prefix = '' }: AnimatedNumberProps) {
  const [ref, isInView] = useInView({ threshold: 0.5 });
  const count = useCountUp(value, isInView);

  return (
    <span ref={ref} className={className} style={style}>
      {prefix}{count}{suffix}
    </span>
  );
}

// ─── Animated ScoreArc (SVG circle) ───

interface AnimatedScoreArcProps {
  score: number;
  size?: number;
  color?: string;
  delay?: number;
}

export function AnimatedScoreArc({ score, size = 52, color = '#4a6741', delay = 0 }: AnimatedScoreArcProps) {
  const [ref, isInView] = useInView({ threshold: 0.3 });
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  useEffect(() => {
    if (isInView && !hasBeenVisible) setHasBeenVisible(true);
  }, [isInView, hasBeenVisible]);

  const show = hasBeenVisible;
  const pct = score <= 1 ? Math.round(score * 100) : Math.round(score);
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (pct / 100) * circumference;
  const count = useCountUp(pct, isInView, 1000);

  return (
    <div ref={ref} className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(28,26,23,0.08)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={show ? `${progress} ${circumference - progress}` : `0 ${circumference}`}
          style={{
            transition: `stroke-dasharray 1.2s ${CSS_EASE_OUT_EXPO} ${delay}s`,
          }}
        />
      </svg>
      <span
        className="absolute text-[11px] font-bold"
        style={{ color, fontFamily: FONT.mono }}
      >
        {count}
      </span>
    </div>
  );
}

// ─── Word bubble / tag pop-in ───

interface PopInTagProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  style?: CSSProperties;
}

export function PopInTag({ children, delay = 0, className, style }: PopInTagProps) {
  return (
    <motion.span
      variants={{
        hidden: { opacity: 0, scale: 0.5, y: 8 },
        visible: {
          opacity: 1, scale: 1, y: 0,
          transition: { duration: 0.4, delay, ease: EASE_OUT_QUART },
        },
      }}
      className={className}
      style={style}
    >
      {children}
    </motion.span>
  );
}

// ─── Card transition for Wrapped experience ───

interface CardTransitionProps {
  children: ReactNode;
  cardKey: string | number;
  direction?: 'forward' | 'backward';
}

const cardVariants: Variants = {
  enter: (direction: string) => ({
    opacity: 0,
    x: direction === 'forward' ? 60 : -60,
    scale: 0.96,
  }),
  center: {
    opacity: 1, x: 0, scale: 1,
    transition: { duration: 0.5, ease: EASE_OUT_EXPO },
  },
  exit: (direction: string) => ({
    opacity: 0,
    x: direction === 'forward' ? -60 : 60,
    scale: 0.96,
    transition: { duration: 0.3 },
  }),
};

export function CardTransition({ children, cardKey, direction = 'forward' }: CardTransitionProps) {
  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={cardKey}
        custom={direction}
        variants={cardVariants}
        initial="enter"
        animate="center"
        exit="exit"
        style={{ width: '100%' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Floating pulse animation for buttons ───

export function FloatingButton({
  children, className, style, onClick,
}: { children: ReactNode; className?: string; style?: CSSProperties; onClick?: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      className={className}
      style={style}
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      animate={{
        boxShadow: [
          '0 2px 8px rgba(0,0,0,0.06)',
          '0 4px 16px rgba(0,0,0,0.1)',
          '0 2px 8px rgba(0,0,0,0.06)',
        ],
      }}
      transition={{
        boxShadow: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
        scale: { duration: 0.15 },
      }}
    >
      {children}
    </motion.button>
  );
}

// ─── Breathing glow for decorative elements ───

export function BreathingGlow({
  children, color = 'var(--t-honey)', className, style,
}: { children: ReactNode; color?: string; className?: string; style?: CSSProperties }) {
  return (
    <motion.div
      className={className}
      style={style}
      animate={{
        boxShadow: [
          `0 0 0px ${color}00`,
          `0 0 20px ${color}20`,
          `0 0 0px ${color}00`,
        ],
      }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}

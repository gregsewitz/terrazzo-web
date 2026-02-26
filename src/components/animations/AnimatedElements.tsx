'use client';

import { motion, AnimatePresence, type Variants, type Transition } from 'framer-motion';
import { useInView, useCountUp } from '@/hooks/useAnimations';
import { FONT } from '@/constants/theme';
import type { ReactNode, CSSProperties } from 'react';

// ─── Shared animation presets ───

const EASE_OUT_EXPO: Transition['ease'] = [0.16, 1, 0.3, 1];
const EASE_OUT_QUART: Transition['ease'] = [0.25, 1, 0.5, 1];

// ─── Fade-in on scroll ───

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

  const getInitial = () => {
    switch (direction) {
      case 'up': return { opacity: 0, y: distance };
      case 'down': return { opacity: 0, y: -distance };
      case 'left': return { opacity: 0, x: distance };
      case 'right': return { opacity: 0, x: -distance };
      case 'none': return { opacity: 0 };
    }
  };

  return (
    <motion.div
      ref={ref}
      initial={getInitial()}
      animate={isInView ? { opacity: 1, x: 0, y: 0 } : getInitial()}
      transition={{ duration, delay, ease: EASE_OUT_EXPO }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// ─── Staggered children container ───

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  staggerDelay?: number;
  delayStart?: number;
}

const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0 },
  },
};

const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.5, ease: EASE_OUT_EXPO },
  },
};

export function StaggerContainer({
  children, className, style, staggerDelay = 0.08, delayStart = 0,
}: StaggerContainerProps) {
  const [ref, isInView] = useInView({ threshold: 0.1 });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: staggerDelay, delayChildren: delayStart },
        },
      }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children, className, style,
}: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <motion.div variants={staggerItemVariants} className={className} style={style}>
      {children}
    </motion.div>
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

  return (
    <div ref={ref} style={{ height, borderRadius, background: bgColor, overflow: 'hidden' }}>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
        transition={{ duration: 1, delay, ease: EASE_OUT_EXPO }}
        style={{
          height: '100%',
          borderRadius,
          background: `linear-gradient(90deg, ${color}80, ${color})`,
          width: `${percentage}%`,
          transformOrigin: 'left',
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

  return (
    <div ref={ref} className="relative h-2 rounded-full" style={{ background: bgGradient }}>
      <motion.div
        className="absolute top-1/2 w-3 h-3 rounded-full border-2"
        initial={{ left: '50%', opacity: 0, scale: 0 }}
        animate={isInView
          ? { left: `${percentage}%`, opacity: 1, scale: 1 }
          : { left: '50%', opacity: 0, scale: 0 }
        }
        transition={{ duration: 0.8, delay, ease: EASE_OUT_QUART }}
        style={{
          transform: 'translate(-50%, -50%)',
          background: markerColor,
          borderColor: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
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
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={isInView
            ? { strokeDasharray: `${progress} ${circumference - progress}` }
            : { strokeDasharray: `0 ${circumference}` }
          }
          transition={{ duration: 1.2, delay, ease: EASE_OUT_EXPO }}
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

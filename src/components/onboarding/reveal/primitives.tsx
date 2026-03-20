'use client';

/**
 * Shared decorative primitives used by RevealSequence card components.
 *
 * Extracted from RevealSequence.tsx for reuse and readability.
 */

import { motion } from 'framer-motion';
import { FONT, INK, COLOR } from '@/constants/theme';
import { SafeFadeIn } from '@/components/animations/SafeFadeIn';

// ─── Animation constants ─────────────────────────────────────────────────────

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
export const SPRING_GENTLE = { type: 'spring' as const, stiffness: 200, damping: 24 };
export const SPRING_BOUNCY = { type: 'spring' as const, stiffness: 300, damping: 20 };

// ─── Brand Palette ───────────────────────────────────────────────────────────

export const BRAND = {
  coral: COLOR.coral,
  ochre: COLOR.ochre,
  darkTeal: COLOR.darkTeal,
  olive: COLOR.olive,
  periwinkle: COLOR.periwinkle,
  peach: COLOR.peach,
  navy: COLOR.navy,
  cream: COLOR.cream,
  blush: COLOR.blush,
};

// ─── Decorative elements ─────────────────────────────────────────────────────

export function WaveDivider({ from, to = BRAND.cream }: { from: string; to?: string }) {
  return (
    <div style={{ position: 'relative', marginTop: -1, lineHeight: 0, overflow: 'hidden' }}>
      <svg viewBox="0 0 400 28" preserveAspectRatio="none" style={{ width: '100%', display: 'block', height: 28 }}>
        <path d="M0,0 L400,0 L400,2 C320,26 80,26 0,2 Z" fill={from} />
        <path d="M0,2 C80,26 320,26 400,2 L400,28 L0,28 Z" fill={to} />
      </svg>
    </div>
  );
}

export function OrgBlob({ color = 'rgba(255,255,255,0.08)', size = 180, style }: { color?: string; size?: number; style?: React.CSSProperties }) {
  return (
    <motion.div
      style={{
        position: 'absolute', width: size, height: size,
        borderRadius: '42% 58% 35% 65% / 48% 32% 68% 52%',
        background: color, pointerEvents: 'none',
        ...style,
      }}
      animate={{
        borderRadius: [
          '42% 58% 35% 65% / 48% 32% 68% 52%',
          '55% 45% 60% 40% / 35% 55% 45% 65%',
          '42% 58% 35% 65% / 48% 32% 68% 52%',
        ],
      }}
      transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

export function HeroSection({
  bg,
  label,
  children,
  minHeight = 200,
}: {
  bg: string;
  label?: string;
  children: React.ReactNode;
  minHeight?: number;
}) {
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      padding: '48px 28px 36px', background: bg,
      minHeight,
    }}>
      <OrgBlob color="rgba(255,255,255,0.07)" size={200} style={{ top: -60, right: -40 }} />
      <OrgBlob color="rgba(255,255,255,0.04)" size={140} style={{ bottom: -30, left: -30 }} />
      <div style={{ position: 'relative', zIndex: 2 }}>
        {label && (
          <SafeFadeIn delay={0.1} direction="up" distance={8} duration={0.4}>
            <div style={{
              fontFamily: FONT.sans, fontSize: 10, fontWeight: 700,
              letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.65)', marginBottom: 14,
            }}>
              {label}
            </div>
          </SafeFadeIn>
        )}
        {children}
      </div>
    </div>
  );
}

export function ContentSection({ children, padding = '28px 28px 20px' }: { children: React.ReactNode; padding?: string }) {
  return (
    <div style={{ padding, background: BRAND.cream }}>
      {children}
    </div>
  );
}

export function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      borderRadius: 24, overflow: 'hidden',
      boxShadow: '0 4px 32px rgba(0,42,85,0.08), 0 1px 4px rgba(0,42,85,0.04)',
      background: BRAND.cream,
    }}>
      {children}
    </div>
  );
}

export function SectionLabel({ children, color = 'rgba(255,255,255,0.65)', delay = 0.1 }: { children: string; color?: string; delay?: number }) {
  return (
    <SafeFadeIn delay={delay} direction="up" distance={12} duration={0.5}>
      <div style={{
        fontFamily: FONT.sans, fontSize: 10, fontWeight: 700,
        letterSpacing: '0.18em', textTransform: 'uppercase',
        color, marginBottom: 14,
      }}>
        {children}
      </div>
    </SafeFadeIn>
  );
}

export function GoldDivider({ width = 40, delay = 0 }: { width?: number; delay?: number }) {
  return (
    <motion.div
      initial={{ scaleX: 0, opacity: 0 }}
      animate={{ scaleX: 1, opacity: 1 }}
      transition={{ duration: 0.8, ease: EASE_OUT_EXPO, delay }}
      style={{
        width, height: 2,
        background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)`,
        margin: '0 auto',
      }}
    />
  );
}

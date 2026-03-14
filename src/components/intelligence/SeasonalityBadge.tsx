'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT } from '@/constants/theme';
import { T } from '@/types';
import type { SeasonalityData } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface SeasonalityBadgeProps {
  seasonality: SeasonalityData;
  /** Rhythm tempo from SavedPlace (e.g. "slow morning", "vibrant evening") */
  rhythmTempo?: string;
  /** Seasonal note from enrichment */
  seasonalNote?: string;
  variant?: 'compact' | 'full';
  layout?: 'desktop' | 'mobile';
  className?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Get current month index (0-based) */
function currentMonth(): number {
  return new Date().getMonth();
}

/** Check if a month name matches the current month */
function isCurrentMonth(monthStr: string): boolean {
  const curr = currentMonth();
  const lower = monthStr.toLowerCase();
  return (
    lower === MONTH_NAMES[curr].toLowerCase() ||
    lower === MONTH_FULL[curr].toLowerCase()
  );
}

/** Determine if "now" is a good time based on bestMonths */
function isGoodTimeNow(bestMonths?: string[]): boolean | null {
  if (!bestMonths || bestMonths.length === 0) return null;
  return bestMonths.some(isCurrentMonth);
}

/** Get the timing context label */
function getTimingLabel(bestMonths?: string[]): string | null {
  const good = isGoodTimeNow(bestMonths);
  if (good === null) return null;
  if (good) return 'Great time to visit';
  // Find next best month
  const curr = currentMonth();
  if (!bestMonths || bestMonths.length === 0) return null;

  const monthIndices = bestMonths.map(m => {
    const lower = m.toLowerCase();
    const idx = MONTH_FULL.findIndex(f => f.toLowerCase() === lower);
    if (idx >= 0) return idx;
    return MONTH_NAMES.findIndex(n => n.toLowerCase() === lower);
  }).filter(i => i >= 0);

  if (monthIndices.length === 0) return null;

  // Find nearest future month
  const sorted = monthIndices
    .map(i => ({ idx: i, dist: (i - curr + 12) % 12 }))
    .sort((a, b) => a.dist - b.dist);

  const next = sorted[0];
  if (next.dist === 0) return 'Great time to visit';
  return `Best in ${MONTH_FULL[next.idx]}`;
}

/** Get crowd context from crowdPatterns */
function getCrowdContext(
  crowdPatterns?: { peak?: string; shoulder?: string; quiet?: string },
): string | null {
  if (!crowdPatterns) return null;
  const good = isGoodTimeNow(); // not applicable without bestMonths, but we can use month
  // Just return the most relevant pattern
  const curr = currentMonth();
  // Summer months (Jun-Aug) tend to be peak in most destinations
  if (curr >= 5 && curr <= 7 && crowdPatterns.peak) return crowdPatterns.peak;
  if ((curr >= 3 && curr <= 4) || (curr >= 8 && curr <= 9)) {
    if (crowdPatterns.shoulder) return crowdPatterns.shoulder;
  }
  if (crowdPatterns.quiet && (curr >= 10 || curr <= 2)) return crowdPatterns.quiet;
  return null;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const TIMING_COLOR_GOOD = T.verde;
const TIMING_COLOR_NEUTRAL = T.amber;

// ─── Component ──────────────────────────────────────────────────────────────────

export function SeasonalityBadge({
  seasonality,
  rhythmTempo,
  seasonalNote,
  variant = 'compact',
  layout = 'desktop',
  className,
}: SeasonalityBadgeProps) {
  const isDesktop = layout === 'desktop';
  const timingLabel = getTimingLabel(seasonality.bestMonths);
  const isGood = isGoodTimeNow(seasonality.bestMonths);
  const crowdContext = getCrowdContext(seasonality.crowdPatterns);

  // Don't render if there's nothing meaningful
  if (!timingLabel && !rhythmTempo && !seasonalNote && !crowdContext) return null;

  const color = isGood ? TIMING_COLOR_GOOD : TIMING_COLOR_NEUTRAL;

  if (variant === 'compact') {
    // Compact: single-line pill for place cards
    return (
      <div className={`flex items-center gap-1.5 ${className || ''}`}>
        {timingLabel && (
          <span
            className={`flex items-center gap-1 ${isDesktop ? 'text-[11px]' : 'text-[10px]'} font-semibold px-2 py-0.5 rounded-md`}
            style={{
              background: `${color}0a`,
              color,
              border: `1px solid ${color}14`,
              fontFamily: FONT.sans,
              letterSpacing: '-0.01em',
            }}
          >
            <PerriandIcon name="discover" size={10} color={color} />
            {timingLabel}
          </span>
        )}
        {rhythmTempo && (
          <span
            className={`${isDesktop ? 'text-[11px]' : 'text-[10px]'} px-2 py-0.5 rounded-md`}
            style={{
              background: `${INK['95']}06`,
              color: TEXT.secondary,
              fontFamily: FONT.mono,
            }}
          >
            {rhythmTempo}
          </span>
        )}
      </div>
    );
  }

  // Full: expanded card for briefing view
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-2xl overflow-hidden ${className || ''}`}
      style={{
        background: 'white',
        border: `1px solid ${color}14`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{
          background: `${color}06`,
          borderBottom: `1px solid ${color}10`,
        }}
      >
        <div
          className="w-5 h-5 rounded-md flex items-center justify-center"
          style={{ background: `${color}12` }}
        >
          <PerriandIcon name="discover" size={11} color={color} />
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color, fontFamily: FONT.mono, letterSpacing: '1px' }}
        >
          When to Visit
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {/* Timing headline */}
        {timingLabel && (
          <p
            className={`${isDesktop ? 'text-[14px]' : 'text-[13px]'} font-semibold`}
            style={{ color: TEXT.primary, fontFamily: FONT.serif }}
          >
            {timingLabel}
          </p>
        )}

        {/* Best months pills */}
        {seasonality.bestMonths && seasonality.bestMonths.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {seasonality.bestMonths.map((month, i) => {
              const isCurrent = isCurrentMonth(month);
              return (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                  style={{
                    background: isCurrent ? `${TIMING_COLOR_GOOD}15` : `${INK['95']}06`,
                    color: isCurrent ? TIMING_COLOR_GOOD : TEXT.secondary,
                    fontFamily: FONT.mono,
                    border: isCurrent ? `1px solid ${TIMING_COLOR_GOOD}25` : 'none',
                  }}
                >
                  {month}
                </span>
              );
            })}
          </div>
        )}

        {/* Rhythm tempo */}
        {rhythmTempo && (
          <div className="flex items-center gap-1.5 mt-2">
            <PerriandIcon name="discover" size={10} color={TEXT.secondary} />
            <span
              className={`${isDesktop ? 'text-[11px]' : 'text-[10px]'}`}
              style={{ color: TEXT.secondary, fontFamily: FONT.mono }}
            >
              {rhythmTempo}
            </span>
          </div>
        )}

        {/* Crowd context */}
        {crowdContext && (
          <p
            className={`${isDesktop ? 'text-[12px]' : 'text-[11px]'} leading-relaxed mt-2`}
            style={{ color: TEXT.secondary, fontFamily: FONT.sans }}
          >
            {crowdContext}
          </p>
        )}

        {/* Seasonal note */}
        {seasonalNote && (
          <p
            className={`${isDesktop ? 'text-[12px]' : 'text-[11px]'} leading-relaxed mt-2`}
            style={{ color: TEXT.secondary, fontFamily: FONT.sans }}
          >
            {seasonalNote}
          </p>
        )}

        {/* Seasonal closures warning */}
        {seasonality.seasonalClosures && seasonality.seasonalClosures.length > 0 && (
          <div
            className="flex items-start gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg"
            style={{ background: `${T.signalRed}08` }}
          >
            <PerriandIcon name="sparkle" size={10} color={T.signalRed} className="mt-0.5" />
            <span
              className="text-[10px]"
              style={{ color: TEXT.secondary, fontFamily: FONT.mono }}
            >
              Closures: {seasonality.seasonalClosures.join(', ')}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default SeasonalityBadge;

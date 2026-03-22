'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TasteDomain, DOMAIN_COLORS, DOMAIN_ICONS } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { COLOR, FONT, INK, TEXT } from '@/constants/theme';
import { FadeInSection } from '@/components/animations/AnimatedElements';
import { formatDomain } from '@/constants/profile';
import { getMatchTier } from '@/lib/match-tier';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface StretchPick {
  /** Place name */
  name: string;
  /** Location */
  location: string;
  /** Overall match score (raw — displayed as tier label) */
  score: number;
  /** Place type */
  type: string;
  /** Domain where this place excels */
  strongAxis: TasteDomain;
  /** Strength on the strong axis (raw score — displayed as tier) */
  strongScore: number;
  /** Domain where this place challenges the user */
  weakAxis: TasteDomain;
  /** Score on the weak axis (raw score — displayed as tier) */
  weakScore: number;
  /** 2-sentence explanation of why this expands taste */
  why: string;
  /** Which pattern this breaks */
  tension: string;
  googlePlaceId?: string;
}

interface StretchPickAxisProps {
  pick: StretchPick;
  onPlaceTap?: (googlePlaceId: string) => void;
  variant?: 'desktop' | 'mobile';
  className?: string;
}

// ─── Axis Bar Sub-component ─────────────────────────────────────────────────────

function AxisBar({
  domain,
  score,
  label,
  isDesktop,
}: {
  domain: TasteDomain;
  score: number;
  label: 'shines' | 'challenges';
  isDesktop: boolean;
}) {
  const color = DOMAIN_COLORS[domain];
  const isStrong = label === 'shines';
  const barWidth = Math.max(score, 8); // minimum visual width

  return (
    <div className="flex items-center gap-2.5">
      {/* Domain icon + name */}
      <div className="flex items-center gap-1.5" style={{ minWidth: isDesktop ? 90 : 75 }}>
        <PerriandIcon name={DOMAIN_ICONS[domain]} size={12} color={color} />
        <span
          className={`${isDesktop ? 'text-[13px]' : 'text-[12px]'} font-semibold`}
          style={{ color, fontFamily: FONT.sans }}
        >
          {formatDomain(domain)}
        </span>
      </div>

      {/* Bar */}
      <div className="flex-1 flex items-center gap-2">
        <div
          className="flex-1 h-2 rounded-full overflow-hidden"
          style={{ background: `${color}0c` }}
        >
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${barWidth}%` }}
            viewport={{ once: true }}
            transition={{
              duration: 0.8,
              ease: [0.16, 1, 0.3, 1],
              delay: isStrong ? 0.2 : 0.4,
            }}
            className="h-full rounded-full"
            style={{
              background: isStrong
                ? `linear-gradient(90deg, ${color}60, ${color})`
                : `linear-gradient(90deg, ${color}30, ${color}60)`,
            }}
          />
        </div>
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{
            color: getMatchTier(score).color,
            background: getMatchTier(score).bg,
            fontFamily: FONT.mono,
          }}
        >
          {getMatchTier(score).shortLabel}
        </span>
      </div>

      {/* Label */}
      <span
        className={`${isDesktop ? 'text-[11px]' : 'text-[10px]'} font-semibold uppercase tracking-wider`}
        style={{
          color: isStrong ? COLOR.darkTeal : COLOR.coral,
          fontFamily: FONT.mono,
          minWidth: isDesktop ? 68 : 56,
          textAlign: 'right',
        }}
      >
        {label === 'shines' ? 'Shines here' : 'Stretches you'}
      </span>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function StretchPickAxis({
  pick,
  onPlaceTap,
  variant = 'desktop',
  className,
}: StretchPickAxisProps) {
  const isDesktop = variant === 'desktop';

  return (
    <FadeInSection delay={0.1} direction="up" distance={16}>
      <div
        className={`overflow-hidden ${className || ''}`}
      >
        {/* Header */}
        <div className="pb-3">
          <span
            className="text-[13px] font-bold"
            style={{ color: COLOR.navy, fontFamily: FONT.mono }}
          >
            {getMatchTier(pick.score).label}
          </span>

          {/* Place info */}
          <div
            className={onPlaceTap && pick.googlePlaceId ? 'cursor-pointer' : ''}
            onClick={() => onPlaceTap && pick.googlePlaceId && onPlaceTap(pick.googlePlaceId)}
          >
            <h3
              className={`${isDesktop ? 'text-[20px]' : 'text-[18px]'} italic leading-snug m-0`}
              style={{ fontFamily: FONT.serif, color: COLOR.darkTeal }}
            >
              {pick.name}
            </h3>
            <span
              className={`${isDesktop ? 'text-[13px]' : 'text-[12px]'} mt-0.5 block`}
              style={{ color: COLOR.navy }}
            >
              {pick.location} · {pick.type}
            </span>
          </div>
        </div>

        {/* Polarity axis bars */}
        <div className="pb-3 flex flex-col gap-2.5">
          <AxisBar
            domain={pick.strongAxis}
            score={pick.strongScore}
            label="shines"
            isDesktop={isDesktop}
          />
          <AxisBar
            domain={pick.weakAxis}
            score={pick.weakScore}
            label="challenges"
            isDesktop={isDesktop}
          />
        </div>

        {/* Editorial explanation */}
        <div
          className="py-3"
          style={{
            borderTop: `1px solid ${INK['05']}`,
          }}
        >
          <p
            className={`${isDesktop ? 'text-[14px]' : 'text-[13px]'} leading-relaxed m-0 mb-2`}
            style={{ color: COLOR.navy }}
          >
            {pick.why}
          </p>
          <div className="flex items-center gap-1.5">
            <PerriandIcon name="sparkle" size={10} color={COLOR.coral} />
            <span
              className={`${isDesktop ? 'text-[12px]' : 'text-[11px]'} italic`}
              style={{ color: COLOR.navy }}
            >
              Breaks your pattern: {pick.tension}
            </span>
          </div>
        </div>
      </div>
    </FadeInSection>
  );
}

export default StretchPickAxis;

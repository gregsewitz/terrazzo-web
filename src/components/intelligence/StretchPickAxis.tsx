'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TasteDomain, DOMAIN_COLORS, DOMAIN_ICONS } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { COLOR, FONT, INK, TEXT } from '@/constants/theme';
import { FadeInSection } from '@/components/animations/AnimatedElements';
import { formatDomain } from '@/constants/profile';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface StretchPick {
  /** Place name */
  name: string;
  /** Location */
  location: string;
  /** Overall match score (65-80, deliberately lower) */
  score: number;
  /** Place type */
  type: string;
  /** Domain where this place excels */
  strongAxis: TasteDomain;
  /** Strength on the strong axis (85-99) */
  strongScore: number;
  /** Domain where this place challenges the user */
  weakAxis: TasteDomain;
  /** Score on the weak axis (20-45) */
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
          className={`${isDesktop ? 'text-[11px]' : 'text-[10px]'} font-semibold`}
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
          className="text-[10px] font-bold"
          style={{
            color: isStrong ? color : `${color}80`,
            fontFamily: FONT.mono,
            minWidth: 24,
            textAlign: 'right',
          }}
        >
          {score}
        </span>
      </div>

      {/* Label */}
      <span
        className={`${isDesktop ? 'text-[9px]' : 'text-[8px]'} font-semibold uppercase tracking-wider`}
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
        className={`rounded-2xl overflow-hidden ${className || ''}`}
        style={{
          background: 'linear-gradient(155deg, rgba(238,113,109,0.06), rgba(238,113,109,0.12))',
          border: '1px solid var(--t-coral)',
        }}
      >
        {/* Header */}
        <div className={`${isDesktop ? 'px-5 pt-5 pb-3' : 'px-4 pt-4 pb-2.5'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div
              className="flex items-center justify-center"
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: `${COLOR.coral}12`,
              }}
            >
              <PerriandIcon name="discover" size={12} color={COLOR.coral} />
            </div>
            <span
              className="text-[9px] font-bold uppercase tracking-widest"
              style={{ color: COLOR.coral, fontFamily: FONT.mono }}
            >
              Stretch pick
            </span>
            <span
              className="text-[11px] font-bold ml-auto"
              style={{ color: COLOR.navy, fontFamily: FONT.mono }}
            >
              {pick.score}% match
            </span>
          </div>

          {/* Place info */}
          <div
            className={onPlaceTap && pick.googlePlaceId ? 'cursor-pointer' : ''}
            onClick={() => onPlaceTap && pick.googlePlaceId && onPlaceTap(pick.googlePlaceId)}
          >
            <h3
              className={`${isDesktop ? 'text-[18px]' : 'text-[16px]'} italic leading-snug m-0`}
              style={{ fontFamily: FONT.serif, color: COLOR.darkTeal }}
            >
              {pick.name}
            </h3>
            <span
              className={`${isDesktop ? 'text-[11px]' : 'text-[10px]'} mt-0.5 block`}
              style={{ color: COLOR.navy }}
            >
              {pick.location} · {pick.type}
            </span>
          </div>
        </div>

        {/* Polarity axis bars */}
        <div className={`${isDesktop ? 'px-5 pb-4' : 'px-4 pb-3'} flex flex-col gap-2.5`}>
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
          className={`${isDesktop ? 'px-5 py-4' : 'px-4 py-3'}`}
          style={{
            borderTop: `1px solid ${INK['05']}`,
          }}
        >
          <p
            className={`${isDesktop ? 'text-[12px]' : 'text-[11px]'} leading-relaxed m-0 mb-2`}
            style={{ color: COLOR.navy }}
          >
            {pick.why}
          </p>
          <div className="flex items-center gap-1.5">
            <PerriandIcon name="sparkle" size={10} color={COLOR.coral} />
            <span
              className={`${isDesktop ? 'text-[10px]' : 'text-[9px]'} italic`}
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

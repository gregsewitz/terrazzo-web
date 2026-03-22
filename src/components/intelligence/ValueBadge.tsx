'use client';

import React from 'react';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { COLOR, FONT, INK, TEXT } from '@/constants/theme';
import { computeValueAssessment, getPriceLabel } from '@/lib/price-value';
import type { ValueAssessment } from '@/lib/price-value';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ValueBadgeProps {
  matchScore: number | null | undefined;
  priceLevel: number | null | undefined;
  variant?: 'compact' | 'full';
  layout?: 'desktop' | 'mobile';
  className?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const SENTIMENT_COLORS: Record<ValueAssessment['sentiment'], string> = {
  positive: COLOR.darkTeal,
  neutral: COLOR.ochre,
  cautious: COLOR.signalRed,
};

// ─── Component ──────────────────────────────────────────────────────────────────

export function ValueBadge({
  matchScore,
  priceLevel,
  variant = 'compact',
  layout = 'desktop',
  className,
}: ValueBadgeProps) {
  const assessment = computeValueAssessment(matchScore, priceLevel);
  const priceLabel = getPriceLabel(priceLevel);
  const isDesktop = layout === 'desktop';

  // Always show price label if available, even without full assessment
  if (!priceLabel) return null;

  if (!assessment) {
    // Just show price level without value framing
    return (
      <span
        className={`${isDesktop ? 'text-[11px]' : 'text-[10px]'} font-semibold ${className || ''}`}
        style={{ color: TEXT.secondary, fontFamily: FONT.mono }}
      >
        {priceLabel}
      </span>
    );
  }

  const color = SENTIMENT_COLORS[assessment.sentiment];

  if (variant === 'compact') {
    return (
      <span
        className={`inline-flex items-center gap-1 ${isDesktop ? 'text-[11px]' : 'text-[10px]'} font-semibold px-2 py-0.5 rounded-md ${className || ''}`}
        style={{
          background: `${color}0a`,
          color,
          border: `1px solid ${color}14`,
          fontFamily: FONT.sans,
          letterSpacing: '-0.01em',
        }}
        title={assessment.explanation}
      >
        <span style={{ fontFamily: FONT.mono }}>{priceLabel}</span>
        <span className="opacity-40">·</span>
        {assessment.label}
      </span>
    );
  }

  // Full variant for detail/briefing views
  return (
    <div
      className={`flex items-start gap-2.5 px-3 py-2 rounded-xl ${className || ''}`}
      style={{
        background: `${color}06`,
        border: `1px solid ${color}12`,
      }}
    >
      <div
        className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: `${color}12` }}
      >
        <PerriandIcon
          name={assessment.sentiment === 'positive' ? 'myPlace' : assessment.sentiment === 'cautious' ? 'sparkle' : 'discover'}
          size={11}
          color={color}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={`${isDesktop ? 'text-[12px]' : 'text-[11px]'} font-semibold`}
            style={{ color, fontFamily: FONT.sans }}
          >
            {assessment.label}
          </span>
          <span
            className="text-[10px] font-bold"
            style={{ color: TEXT.secondary, fontFamily: FONT.mono }}
          >
            {priceLabel}
          </span>
        </div>
        <p
          className={`${isDesktop ? 'text-[11px]' : 'text-[10px]'} mt-0.5`}
          style={{ color: TEXT.secondary, fontFamily: FONT.sans }}
        >
          {assessment.explanation}
        </p>
      </div>
    </div>
  );
}

export default ValueBadge;

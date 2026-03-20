'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TasteDomain, DOMAIN_COLORS, DOMAIN_ICONS, T } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { COLOR, FONT, INK, TEXT } from '@/constants/theme';
import { FadeInSection, StaggerContainer, StaggerItem, AnimatedBar } from '@/components/animations/AnimatedElements';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface DeepMatchSignal {
  /** The specific micro-signal that matched */
  signal: string;
  /** Which taste domain it belongs to */
  domain: TasteDomain;
  /** Strength of this signal match 0-100 */
  strength: number;
  /** 1-sentence note explaining why this signal matched the property */
  note: string;
}

export interface DeepMatch {
  /** Property name */
  name: string;
  /** Location */
  location: string;
  /** Overall match score (93-99 for deep matches) */
  score: number;
  /** 12-word editorial headline */
  headline: string;
  /** Per-signal breakdown */
  signalBreakdown: DeepMatchSignal[];
  /** Which user contradiction this place resolves */
  tensionResolved?: string;
  googlePlaceId?: string;
}

interface DeepMatchBreakdownProps {
  match: DeepMatch;
  /** Callback when the place name/header is tapped */
  onPlaceTap?: (googlePlaceId: string) => void;
  variant?: 'desktop' | 'mobile';
  className?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Title-case a string: "communal dining" → "Communal Dining" */
function titleCase(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

function humanizeSignal(raw: string): string {
  const cleaned = raw
    .replace(/-/g, ' ')
    .replace(/\b(format|style|emphasis|preference|level)\b/gi, '')
    .trim()
    .replace(/\s+/g, ' ');
  return titleCase(cleaned);
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function DeepMatchBreakdown({
  match,
  onPlaceTap,
  variant = 'desktop',
  className,
}: DeepMatchBreakdownProps) {
  const isDesktop = variant === 'desktop';

  return (
    <FadeInSection delay={0.1} direction="up" distance={18}>
      <div
        className={`overflow-hidden ${className || ''}`}
      >
        {/* Header — editorial headline */}
        <div className={`${isDesktop ? 'px-5 pt-5 pb-3' : 'px-4 pt-4 pb-2.5'}`}>
          <div className="flex items-center gap-2 mb-2">
            <div
              className="flex items-center justify-center"
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: `${COLOR.coral}14`,
              }}
            >
              <PerriandIcon name="terrazzo" size={12} color={COLOR.coral} />
            </div>
            <span
              className="text-[9px] font-bold uppercase tracking-widest"
              style={{ color: COLOR.coral, fontFamily: FONT.mono }}
            >
              Deep match
            </span>
            <span
              className="text-[11px] font-bold ml-auto"
              style={{ color: COLOR.ochre, fontFamily: FONT.mono }}
            >
              {match.score}%
            </span>
          </div>

          {/* Place name — tappable */}
          <div
            className={onPlaceTap && match.googlePlaceId ? 'cursor-pointer' : ''}
            onClick={() => onPlaceTap && match.googlePlaceId && onPlaceTap(match.googlePlaceId)}
          >
            <h3
              className={`${isDesktop ? 'text-[20px]' : 'text-[18px]'} italic leading-snug m-0`}
              style={{ fontFamily: FONT.serif, color: COLOR.ochre }}
            >
              {match.name}
            </h3>
            <span
              className={`${isDesktop ? 'text-[11px]' : 'text-[10px]'} mt-0.5 block`}
              style={{ color: COLOR.navy }}
            >
              {match.location}
            </span>
          </div>

          {/* Editorial headline */}
          <p
            className={`${isDesktop ? 'text-[13px]' : 'text-[12px]'} leading-relaxed mt-2.5 mb-0 italic`}
            style={{ color: COLOR.navy }}
          >
            {match.headline}
          </p>
        </div>

        {/* Signal breakdown — editorial stack, not a chart */}
        <div className={`${isDesktop ? 'px-5 pb-4' : 'px-4 pb-3'}`}>
          <StaggerContainer staggerDelay={0.08} delayStart={0.15}>
            <div className="flex flex-col gap-3">
              {match.signalBreakdown.map((signal, i) => {
                const color = DOMAIN_COLORS[signal.domain];
                return (
                  <StaggerItem key={`${signal.domain}-${i}`}>
                    <div className="flex gap-3">
                      {/* Domain color bar */}
                      <div
                        className="flex-shrink-0 mt-1"
                        style={{
                          width: 3,
                          height: 32,
                          borderRadius: 2,
                          background: `linear-gradient(to bottom, ${color}, ${color}40)`,
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        {/* Signal name + domain + strength */}
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <PerriandIcon
                            name={DOMAIN_ICONS[signal.domain]}
                            size={10}
                            color={color}
                          />
                          <span
                            className="text-[11px] font-semibold"
                            style={{ color: COLOR.ochre, fontFamily: FONT.sans }}
                          >
                            {humanizeSignal(signal.signal)}
                          </span>
                          <span
                            className="text-[9px] font-bold ml-auto"
                            style={{ color: COLOR.navy, fontFamily: FONT.mono }}
                          >
                            {signal.strength}
                          </span>
                        </div>
                        {/* Explanation note */}
                        <p
                          className={`${isDesktop ? 'text-[11px]' : 'text-[10px]'} leading-relaxed m-0`}
                          style={{ color: COLOR.navy }}
                        >
                          {signal.note}
                        </p>
                      </div>
                    </div>
                  </StaggerItem>
                );
              })}
            </div>
          </StaggerContainer>
        </div>

        {/* Tension resolved — if applicable */}
        {match.tensionResolved && (
          <div
            className={`${isDesktop ? 'px-5 py-3' : 'px-4 py-2.5'}`}
            style={{
              borderTop: `1px solid ${INK['05']}`,
              background: `${COLOR.coral}08`,
            }}
          >
            <div className="flex items-center gap-2">
              <PerriandIcon name="sparkle" size={11} color={COLOR.coral} />
              <p
                className={`${isDesktop ? 'text-[11px]' : 'text-[10px]'} m-0`}
                style={{ color: COLOR.navy, fontFamily: FONT.sans }}
              >
                <span className="font-semibold" style={{ color: COLOR.coral }}>
                  Resolves your tension:
                </span>{' '}
                {match.tensionResolved}
              </p>
            </div>
          </div>
        )}
      </div>
    </FadeInSection>
  );
}

export default DeepMatchBreakdown;

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TasteDomain, DOMAIN_COLORS } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { COLOR, FONT, INK, TEXT } from '@/constants/theme';
import { SafeFadeIn } from '@/components/animations/SafeFadeIn';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface TasteTension {
  /** Short tension title, e.g. "Quiet luxury meets late-night energy" */
  title: string;
  /** What the user says they want */
  stated: string;
  /** What their behavior reveals */
  revealed: string;
  /** 2-3 sentence editorial on why this tension exists */
  editorial: string;
  /** The place that bridges the tension */
  resolvedBy?: {
    name: string;
    location: string;
    /** 1-sentence explanation of how it resolves the tension */
    how: string;
    googlePlaceId?: string;
  };
}

interface TasteTensionCardProps {
  tension: TasteTension;
  /** Callback when the resolving place is tapped */
  onPlaceTap?: (googlePlaceId: string) => void;
  variant?: 'desktop' | 'mobile';
  className?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function TasteTensionCard({
  tension,
  onPlaceTap,
  variant = 'desktop',
  className,
}: TasteTensionCardProps) {
  const isDesktop = variant === 'desktop';

  return (
    <SafeFadeIn direction="up" distance={16} duration={0.6}>
      <div
        className={`overflow-hidden ${className || ''}`}
      >
        {/* Header */}
        <div className="pb-3">
          <h3
            className={`${isDesktop ? 'text-[20px]' : 'text-[18px]'} leading-snug italic`}
            style={{ fontFamily: FONT.serif, color: COLOR.darkTeal, margin: 0 }}
          >
            {tension.title}
          </h3>
        </div>

        {/* Stated vs Revealed — the editorial vignette */}
        <div className="pb-3">
          {/* Stated preference */}
          <div className="flex items-start gap-2.5 mb-2">
            <div
              className="flex-shrink-0 mt-0.5"
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: `${COLOR.darkTeal}14`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: COLOR.darkTeal,
                }}
              />
            </div>
            <p
              className={`${isDesktop ? 'text-[15px]' : 'text-[14px]'} leading-relaxed m-0`}
              style={{ color: COLOR.navy }}
            >
              <span className="font-semibold" style={{ color: COLOR.darkTeal }}>You say: </span>
              {tension.stated}
            </p>
          </div>

          {/* Revealed behavior */}
          <div className="flex items-start gap-2.5 mb-3">
            <div
              className="flex-shrink-0 mt-0.5"
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: `${COLOR.coral}14`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: COLOR.coral,
                }}
              />
            </div>
            <p
              className={`${isDesktop ? 'text-[15px]' : 'text-[14px]'} leading-relaxed m-0`}
              style={{ color: COLOR.navy }}
            >
              <span className="font-semibold" style={{ color: COLOR.darkTeal }}>But you keep saving: </span>
              {tension.revealed}
            </p>
          </div>

          {/* Editorial explanation */}
          <p
            className={`${isDesktop ? 'text-[14px]' : 'text-[13px]'} leading-relaxed italic`}
            style={{ color: COLOR.navy, margin: 0 }}
          >
            {tension.editorial}
          </p>
        </div>

        {/* Resolution — the place that bridges this tension */}
        {tension.resolvedBy && (
          <div
            className="py-3"
            style={{
              borderTop: `1px solid ${INK['06']}`,
              background: `${COLOR.ochre}06`,
              cursor: onPlaceTap && tension.resolvedBy.googlePlaceId ? 'pointer' : 'default',
            }}
            onClick={() => {
              if (onPlaceTap && tension.resolvedBy?.googlePlaceId) {
                onPlaceTap(tension.resolvedBy.googlePlaceId);
              }
            }}
            role={onPlaceTap && tension.resolvedBy.googlePlaceId ? 'button' : undefined}
            tabIndex={onPlaceTap && tension.resolvedBy.googlePlaceId ? 0 : undefined}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <PerriandIcon name="terrazzo" size={11} color={COLOR.coral} />
              <span
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: COLOR.coral, fontFamily: FONT.mono }}
              >
                Bridges this tension
              </span>
            </div>
            <p className={`${isDesktop ? 'text-[16px]' : 'text-[15px]'} font-semibold m-0 mb-1`} style={{ color: COLOR.darkTeal }}>
              {tension.resolvedBy.name}
              <span className={`${isDesktop ? 'text-[13px]' : 'text-[12px]'} font-normal ml-1.5`} style={{ color: COLOR.navy }}>
                {tension.resolvedBy.location}
              </span>
            </p>
            <p
              className={`${isDesktop ? 'text-[14px]' : 'text-[13px]'} leading-relaxed m-0`}
              style={{ color: COLOR.navy }}
            >
              {tension.resolvedBy.how}
            </p>
          </div>
        )}
      </div>
    </SafeFadeIn>
  );
}

export default TasteTensionCard;

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { COLOR, FONT, INK, TEXT } from '@/constants/theme';
import type { HeritageData } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface HeritageCardProps {
  heritage: HeritageData;
  variant?: 'compact' | 'full';
  layout?: 'desktop' | 'mobile';
  className?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Build the headline: "Built 1924 · Marcel Breuer" or "Est. 1887" */
function buildHeadline(h: HeritageData): string | null {
  const parts: string[] = [];
  if (h.yearEstablished) {
    parts.push(h.yearEstablished.length === 4 ? `Est. ${h.yearEstablished}` : h.yearEstablished);
  }
  if (h.architect) {
    parts.push(h.architect);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Build the renovation subtitle: "Restored 2019" */
function buildRenovationLine(h: HeritageData): string | null {
  if (!h.yearRenovated) return null;
  return `Restored ${h.yearRenovated}`;
}

/** Check if heritage data has enough substance to render */
function hasSubstance(h: HeritageData): boolean {
  return !!(
    h.architect ||
    h.yearEstablished ||
    h.significance ||
    h.restorationPhilosophy ||
    (h.previousUses && h.previousUses.length > 0)
  );
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const HERITAGE_COLOR = COLOR.periwinkle; // Character domain — heritage is about soul

// ─── Component ──────────────────────────────────────────────────────────────────

export function HeritageCard({
  heritage,
  variant = 'full',
  layout = 'desktop',
  className,
}: HeritageCardProps) {
  const isDesktop = layout === 'desktop';

  if (!hasSubstance(heritage)) return null;

  const headline = buildHeadline(heritage);
  const renovationLine = buildRenovationLine(heritage);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-2xl overflow-hidden ${className || ''}`}
      style={{
        background: 'white',
        border: `1px solid ${HERITAGE_COLOR}14`,
        boxShadow: `0 1px 3px rgba(0,0,0,0.03)`,
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{
          background: `${HERITAGE_COLOR}06`,
          borderBottom: `1px solid ${HERITAGE_COLOR}10`,
        }}
      >
        <div
          className="w-5 h-5 rounded-md flex items-center justify-center"
          style={{ background: `${HERITAGE_COLOR}12` }}
        >
          <PerriandIcon name="character" size={11} color={HERITAGE_COLOR} />
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{
            color: HERITAGE_COLOR,
            fontFamily: FONT.mono,
            letterSpacing: '1px',
          }}
        >
          Heritage
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {/* Headline: year + architect */}
        {headline && (
          <p
            className={`${isDesktop ? 'text-[14px]' : 'text-[13px]'} font-semibold leading-snug`}
            style={{ color: TEXT.primary, fontFamily: FONT.serif }}
          >
            {headline}
          </p>
        )}

        {/* Renovation line */}
        {renovationLine && (
          <p
            className="text-[11px] mt-0.5"
            style={{ color: TEXT.secondary, fontFamily: FONT.mono }}
          >
            {renovationLine}
          </p>
        )}

        {/* Previous uses */}
        {heritage.previousUses && heritage.previousUses.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {heritage.previousUses.map((use, i) => (
              <span
                key={i}
                className="text-[10px] px-2 py-0.5 rounded-md"
                style={{
                  background: `${HERITAGE_COLOR}08`,
                  color: TEXT.secondary,
                  fontFamily: FONT.mono,
                }}
              >
                {use}
              </span>
            ))}
          </div>
        )}

        {/* Significance */}
        {heritage.significance && variant === 'full' && (
          <p
            className={`${isDesktop ? 'text-[12px]' : 'text-[11px]'} leading-relaxed mt-2`}
            style={{ color: TEXT.secondary, fontFamily: FONT.sans }}
          >
            {heritage.significance}
          </p>
        )}

        {/* Restoration philosophy */}
        {heritage.restorationPhilosophy && variant === 'full' && (
          <div
            className="mt-2 pl-3 py-1"
            style={{ borderLeft: `2px solid ${HERITAGE_COLOR}25` }}
          >
            <p
              className={`${isDesktop ? 'text-[11px]' : 'text-[10px]'} leading-relaxed italic`}
              style={{ color: TEXT.secondary, fontFamily: FONT.sans }}
            >
              {heritage.restorationPhilosophy}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default HeritageCard;

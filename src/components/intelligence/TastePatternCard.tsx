'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { COLOR, FONT, INK, TEXT } from '@/constants/theme';
import { DOMAIN_COLORS, DOMAIN_ICONS } from '@/types';
import type { TasteDomain } from '@/types';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface TastePattern {
  label: string;
  domain: TasteDomain;
  strength: number;
  placeCount: number;
  topClusters: string[];
  examplePlaces: string[];
  isHiddenPreference: boolean;
}

interface TastePatternCardProps {
  patterns: TastePattern[];
  totalPlaces: number;
  analyzedPlaces: number;
  layout?: 'desktop' | 'mobile';
  className?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function TastePatternCard({
  patterns,
  totalPlaces,
  analyzedPlaces,
  layout = 'desktop',
  className,
}: TastePatternCardProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const isDesktop = layout === 'desktop';

  if (patterns.length === 0) return null;

  // Separate hidden preferences
  const hiddenPatterns = patterns.filter(p => p.isHiddenPreference);
  const knownPatterns = patterns.filter(p => !p.isHiddenPreference);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-2xl overflow-hidden ${className || ''}`}
      style={{
        background: 'white',
        border: `1px solid ${COLOR.periwinkle}10`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{
          background: `${COLOR.periwinkle}06`,
          borderBottom: `1px solid ${COLOR.periwinkle}10`,
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{ background: `${COLOR.periwinkle}12` }}
          >
            <PerriandIcon name="character" size={11} color={COLOR.periwinkle} />
          </div>
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: COLOR.periwinkle, fontFamily: FONT.mono, letterSpacing: '1px' }}
          >
            Your Taste Patterns
          </span>
        </div>
        <span
          className="text-[9px]"
          style={{ color: TEXT.secondary, fontFamily: FONT.mono }}
        >
          {analyzedPlaces} of {totalPlaces} places analyzed
        </span>
      </div>

      <div className="px-4 py-3">
        {/* Known patterns */}
        <div className="space-y-2">
          {knownPatterns.slice(0, 5).map((pattern, i) => (
            <PatternRow
              key={`known-${i}`}
              pattern={pattern}
              isExpanded={expandedIdx === i}
              onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
              isDesktop={isDesktop}
            />
          ))}
        </div>

        {/* Hidden preferences — special callout */}
        {hiddenPatterns.length > 0 && (
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${INK['95']}06` }}>
            <div className="flex items-center gap-1.5 mb-2">
              <PerriandIcon name="sparkle" size={10} color={COLOR.ochre} />
              <span
                className="text-[9px] font-bold uppercase tracking-wider"
                style={{ color: COLOR.ochre, fontFamily: FONT.mono }}
              >
                Hidden Preferences
              </span>
            </div>
            <p
              className="text-[11px] mb-2"
              style={{ color: TEXT.secondary, fontFamily: FONT.sans }}
            >
              Patterns in your saves that go beyond your stated profile:
            </p>
            <div className="space-y-2">
              {hiddenPatterns.slice(0, 3).map((pattern, i) => (
                <PatternRow
                  key={`hidden-${i}`}
                  pattern={pattern}
                  isExpanded={expandedIdx === knownPatterns.length + i}
                  onToggle={() => setExpandedIdx(expandedIdx === knownPatterns.length + i ? null : knownPatterns.length + i)}
                  isDesktop={isDesktop}
                  isHidden
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Pattern Row Sub-component ──────────────────────────────────────────────────

function PatternRow({
  pattern,
  isExpanded,
  onToggle,
  isDesktop,
  isHidden,
}: {
  pattern: TastePattern;
  isExpanded: boolean;
  onToggle: () => void;
  isDesktop: boolean;
  isHidden?: boolean;
}) {
  const color = DOMAIN_COLORS[pattern.domain];

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all"
        style={{
          background: isExpanded ? `${color}08` : 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <PerriandIcon
          name={DOMAIN_ICONS[pattern.domain]}
          size={isDesktop ? 12 : 11}
          color={color}
        />
        <div className="flex-1 text-left min-w-0">
          <span
            className={`${isDesktop ? 'text-[12px]' : 'text-[11px]'} font-semibold`}
            style={{ color: TEXT.primary, fontFamily: FONT.sans }}
          >
            {pattern.label}
          </span>
          {isHidden && (
            <span
              className="ml-1.5 text-[8px] font-bold uppercase px-1 py-0.5 rounded"
              style={{ background: `${COLOR.ochre}15`, color: COLOR.ochre, fontFamily: FONT.mono }}
            >
              New
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className="text-[10px] font-bold"
            style={{ color, fontFamily: FONT.mono }}
          >
            {pattern.strength}
          </span>
          <div
            className="w-12 h-1 rounded-full overflow-hidden"
            style={{ background: `${color}12` }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pattern.strength}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="h-full rounded-full"
              style={{ background: color }}
            />
          </div>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2 ml-5">
              {/* Top clusters */}
              <div className="flex flex-wrap gap-1 mb-1.5">
                {pattern.topClusters.map((cluster, j) => (
                  <span
                    key={j}
                    className="text-[10px] px-2 py-0.5 rounded-md"
                    style={{
                      background: `${color}08`,
                      color: TEXT.secondary,
                      fontFamily: FONT.mono,
                    }}
                  >
                    {cluster}
                  </span>
                ))}
              </div>
              {/* Example places */}
              <p
                className="text-[10px]"
                style={{ color: TEXT.secondary, fontFamily: FONT.sans }}
              >
                Seen in: {pattern.examplePlaces.join(', ')}
                {pattern.placeCount > pattern.examplePlaces.length && (
                  <span> +{pattern.placeCount - pattern.examplePlaces.length} more</span>
                )}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TastePatternCard;

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { COLOR, FONT, INK, TEXT } from '@/constants/theme';
import { DOMAIN_COLORS, DOMAIN_ICONS } from '@/types';
import type { TasteDomain } from '@/types';
import { formatDomain } from '@/constants/profile';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ComparisonData {
  similarity: number;
  domainComparison: Record<TasteDomain, { placeA: number; placeB: number; delta: number }>;
  differentiators: {
    placeAStronger: Array<{ domain: TasteDomain; cluster: string; delta: number }>;
    placeBStronger: Array<{ domain: TasteDomain; cluster: string; delta: number }>;
  };
  userFit: {
    placeA: number | null;
    placeB: number | null;
  };
}

interface ComparativeCardProps {
  placeAName: string;
  placeBName: string;
  comparison: ComparisonData;
  layout?: 'desktop' | 'mobile';
  className?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function humanizeCluster(raw: string): string {
  const stripped = raw.includes(':') ? raw.split(':')[1] : raw;
  return stripped
    .replace(/-/g, ' ')
    .replace(/\b(format|style|emphasis|preference|level)\b/gi, '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function similarityLabel(score: number): string {
  if (score >= 80) return 'Very similar';
  if (score >= 60) return 'Somewhat similar';
  if (score >= 40) return 'Moderately different';
  return 'Quite different';
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function ComparativeCard({
  placeAName,
  placeBName,
  comparison,
  layout = 'desktop',
  className,
}: ComparativeCardProps) {
  const isDesktop = layout === 'desktop';
  const domains = Object.entries(comparison.domainComparison)
    .filter(([, v]) => v.placeA > 0 || v.placeB > 0)
    .sort(([, a], [, b]) => Math.abs(b.delta) - Math.abs(a.delta));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-2xl overflow-hidden ${className || ''}`}
      style={{
        background: 'white',
        border: `1px solid ${INK['95']}08`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3"
        style={{
          background: `${COLOR.ochre}06`,
          borderBottom: `1px solid ${COLOR.ochre}10`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PerriandIcon name="discover" size={12} color={COLOR.ochre} />
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: COLOR.ochre, fontFamily: FONT.mono, letterSpacing: '1px' }}
            >
              Comparison
            </span>
          </div>
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-md"
            style={{
              background: `${COLOR.ochre}0a`,
              color: COLOR.ochre,
              fontFamily: FONT.mono,
            }}
          >
            {comparison.similarity}% similar · {similarityLabel(comparison.similarity)}
          </span>
        </div>
      </div>

      <div className="px-4 py-3">
        {/* Place names header */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className={`${isDesktop ? 'text-[13px]' : 'text-[12px]'} font-semibold truncate`} style={{ color: TEXT.primary, fontFamily: FONT.serif }}>
              {placeAName}
            </p>
            {comparison.userFit.placeA != null && (
              <span className="text-[10px]" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
                {comparison.userFit.placeA}% match
              </span>
            )}
          </div>
          <div className="text-right">
            <p className={`${isDesktop ? 'text-[13px]' : 'text-[12px]'} font-semibold truncate`} style={{ color: TEXT.primary, fontFamily: FONT.serif }}>
              {placeBName}
            </p>
            {comparison.userFit.placeB != null && (
              <span className="text-[10px]" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
                {comparison.userFit.placeB}% match
              </span>
            )}
          </div>
        </div>

        {/* Domain comparison bars */}
        <div className="space-y-2">
          {domains.slice(0, 6).map(([domain, values]) => {
            const color = DOMAIN_COLORS[domain as TasteDomain];
            const maxVal = Math.max(values.placeA, values.placeB, 1);
            return (
              <div key={domain}>
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1">
                    <PerriandIcon name={DOMAIN_ICONS[domain as TasteDomain]} size={9} color={color} />
                    <span className="text-[9px] font-bold uppercase" style={{ color, fontFamily: FONT.mono }}>
                      {formatDomain(domain)}
                    </span>
                  </div>
                  <span className="text-[9px]" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
                    {values.placeA} vs {values.placeB}
                  </span>
                </div>
                <div className="flex gap-1 h-1.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(values.placeA / maxVal) * 50}%` }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                    className="rounded-full"
                    style={{ background: color, opacity: 0.7 }}
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(values.placeB / maxVal) * 50}%` }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                    className="rounded-full"
                    style={{ background: color, opacity: 0.35 }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Key differentiators */}
        {(comparison.differentiators.placeAStronger.length > 0 || comparison.differentiators.placeBStronger.length > 0) && (
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${INK['95']}06` }}>
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
              Key Differences
            </span>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <div>
                {comparison.differentiators.placeAStronger.slice(0, 3).map((d, i) => (
                  <div key={i} className="flex items-center gap-1 py-0.5">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{
                        background: `${DOMAIN_COLORS[d.domain]}08`,
                        color: DOMAIN_COLORS[d.domain],
                        fontFamily: FONT.mono,
                      }}
                    >
                      {humanizeCluster(d.cluster)}
                    </span>
                  </div>
                ))}
              </div>
              <div>
                {comparison.differentiators.placeBStronger.slice(0, 3).map((d, i) => (
                  <div key={i} className="flex items-center gap-1 py-0.5 justify-end">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{
                        background: `${DOMAIN_COLORS[d.domain]}08`,
                        color: DOMAIN_COLORS[d.domain],
                        fontFamily: FONT.mono,
                      }}
                    >
                      {humanizeCluster(d.cluster)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default ComparativeCard;

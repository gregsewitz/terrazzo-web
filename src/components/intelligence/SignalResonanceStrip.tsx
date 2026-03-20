'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TasteDomain, DOMAIN_COLORS, DOMAIN_ICONS } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT } from '@/constants/theme';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ResonanceCluster {
  /** Humanized cluster label, e.g. "warm minimalism", "communal dining" */
  label: string;
  /** Parent taste domain */
  domain: TasteDomain;
  /** Match contribution strength 0-100 */
  score: number;
  /** Top 2-3 micro-signals in this cluster */
  signals: string[];
}

interface SignalResonanceStripProps {
  /** Top clusters from the match explanation (max 5 shown) */
  clusters: ResonanceCluster[];
  /** Optional narrative connection — shown when expanded */
  narrative?: string;
  /** Compact mode for place cards (no expand), full mode for detail view */
  variant?: 'compact' | 'full';
  /** Desktop or mobile layout */
  layout?: 'desktop' | 'mobile';
  className?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Title-case a string: "communal dining" → "Communal Dining" */
function titleCase(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

/** Humanize a cluster label: "atmosphere-communal-dining" → "Communal Dining" */
function humanizeLabel(raw: string): string {
  // Strip domain prefix if present (e.g. "Atmosphere:communal-dining-format")
  const stripped = raw.includes(':') ? raw.split(':')[1] : raw;
  const cleaned = stripped
    .replace(/-/g, ' ')
    .replace(/\b(format|style|emphasis|preference|level)\b/gi, '')
    .trim()
    .replace(/\s+/g, ' ');
  return titleCase(cleaned);
}

// ─── Component ──────────────────────────────────────────────────────────────────

export function SignalResonanceStrip({
  clusters,
  narrative,
  variant = 'compact',
  layout = 'desktop',
  className,
}: SignalResonanceStripProps) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const shown = variant === 'compact' ? clusters.slice(0, 3) : clusters.slice(0, 5);
  const isDesktop = layout === 'desktop';

  // Normalize scores to 0-100 relative to the strongest cluster
  const maxScore = Math.max(...shown.map(c => c.score), 1);
  const normalizedScores = shown.map(c => Math.round((c.score / maxScore) * 100));

  if (shown.length === 0) return null;

  return (
    <div className={className}>
      {/* Resonance pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {shown.map((cluster, i) => {
          const color = DOMAIN_COLORS[cluster.domain];
          const isOpen = expanded === i;
          const label = humanizeLabel(cluster.label);

          return (
            <div key={`${cluster.domain}-${i}`} className="relative">
              <button
                onClick={() => variant === 'full' ? setExpanded(isOpen ? null : i) : undefined}
                className="flex items-center gap-1 border-none rounded-lg transition-all"
                style={{
                  background: isOpen ? `${color}18` : `${color}0a`,
                  border: `1px solid ${isOpen ? `${color}30` : `${color}14`}`,
                  padding: isDesktop ? '5px 10px' : '4px 8px',
                  cursor: variant === 'full' ? 'pointer' : 'default',
                }}
              >
                <PerriandIcon
                  name={DOMAIN_ICONS[cluster.domain]}
                  size={isDesktop ? 11 : 10}
                  color={color}
                />
                <span
                  className={`${isDesktop ? 'text-[11px]' : 'text-[10px]'} font-semibold`}
                  style={{ color, fontFamily: FONT.sans, letterSpacing: '-0.01em' }}
                >
                  {label}
                </span>
              </button>

              {/* Expanded detail — only in full variant */}
              <AnimatePresence>
                {isOpen && variant === 'full' && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -4, height: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute left-0 top-full mt-1.5 z-10 rounded-xl overflow-hidden"
                    style={{
                      background: 'white',
                      border: `1px solid ${color}20`,
                      boxShadow: `0 8px 24px ${INK['08']}`,
                      minWidth: isDesktop ? 220 : 180,
                      maxWidth: 280,
                    }}
                  >
                    <div className="p-3">
                      {/* Domain label */}
                      <div
                        className="text-[9px] font-bold uppercase tracking-wider mb-1.5"
                        style={{ color, fontFamily: FONT.mono }}
                      >
                        {cluster.domain}
                      </div>
                      {/* Signal tags */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {cluster.signals.map((sig, j) => (
                          <span
                            key={j}
                            className="text-[10px] px-2 py-0.5 rounded-md"
                            style={{
                              background: `${color}08`,
                              color: TEXT.primary,
                              fontFamily: FONT.mono,
                            }}
                          >
                            {titleCase(sig.replace(/-/g, ' '))}
                          </span>
                        ))}
                      </div>
                      {/* Strength bar */}
                      <div className="flex items-center">
                        <div
                          className="flex-1 h-1 rounded-full overflow-hidden"
                          style={{ background: `${color}12` }}
                        >
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${normalizedScores[i]}%` }}
                            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                            className="h-full rounded-full"
                            style={{ background: color }}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Narrative connection — shown below pills in full variant */}
      {variant === 'full' && narrative && (
        <p
          className={`${isDesktop ? 'text-[12px]' : 'text-[11px]'} leading-relaxed mt-2.5`}
          style={{ color: TEXT.secondary, fontFamily: FONT.sans }}
        >
          {narrative}
        </p>
      )}
    </div>
  );
}

export default SignalResonanceStrip;

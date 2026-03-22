'use client';

import { FONT } from '@/constants/theme';
import { getMatchTier } from '@/lib/match-tier';

interface ScoreArcProps {
  score: number;
  size?: number;
  color?: string;
}

/**
 * Small tier badge indicator — replaces the old numeric percentage arc.
 * Shows the tier short label with the tier's own color scheme.
 * Kept as ScoreArc export for backward compatibility with existing imports.
 */
export default function ScoreArc({ score, size = 52 }: ScoreArcProps) {
  const tier = getMatchTier(score);
  // Scale font based on container size
  const fontSize = Math.max(Math.round(size * 0.22), 9);

  return (
    <div
      className="flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: tier.bg,
      }}
    >
      <span
        className="font-semibold text-center leading-tight"
        style={{
          color: tier.color,
          fontFamily: FONT.mono,
          fontSize,
        }}
      >
        {tier.shortLabel}
      </span>
    </div>
  );
}

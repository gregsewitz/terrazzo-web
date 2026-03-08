'use client';

import { DOMAIN_COLORS, type TasteDomain } from '@/types';
import { FONT, INK } from '@/constants/theme';

interface ClusterInsightCardProps {
  label: string;
  domain: string;
  score: number;
  signals: string[];
  index: number;
}

/**
 * Compact card showing a single cluster contribution to a match.
 * Used in the "Why this matches" section of BriefingView.
 */
export function ClusterInsightCard({ label, domain, score, signals, index }: ClusterInsightCardProps) {
  const color = DOMAIN_COLORS[domain as TasteDomain] || 'var(--t-ink)';
  // Strength indicator — map raw score to a qualitative label
  const strength = score >= 500 ? 'Strong' : score >= 200 ? 'Good' : 'Moderate';

  return (
    <div
      className="p-3 rounded-xl transition-all"
      style={{
        background: `${color}08`,
        borderLeft: `2px solid ${color}`,
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="text-[10px] font-bold"
          style={{ color, fontFamily: FONT.mono }}
        >
          {label}
        </span>
        <span
          className="text-[8px] px-1.5 py-0.5 rounded-full font-semibold"
          style={{ background: `${color}15`, color, fontFamily: FONT.mono }}
        >
          {strength}
        </span>
      </div>
      {signals.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {signals.slice(0, 3).map((signal, i) => (
            <span
              key={i}
              className="text-[9px] px-1.5 py-0.5 rounded-md"
              style={{ background: INK['05'], color: INK['70'], fontFamily: FONT.mono }}
            >
              {signal}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

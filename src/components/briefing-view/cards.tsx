'use client';

import { useMemo } from 'react';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';
import { BriefingSignal, BriefingAntiSignal } from '@/types';
import { FONT, INK, TEXT } from '@/constants/theme';

// ─── TrustBadge Component ───
export function TrustBadge({ score, reviewCount }: { score: number | null; reviewCount: number }) {
  const level = score == null ? 0 : score >= 0.75 ? 3 : score >= 0.5 ? 2 : 1;
  const labels = ['Low', 'Fair', 'Good', 'Strong'];
  const colors = ['var(--t-signal-red)', 'var(--t-amber)', 'var(--t-dark-teal)', 'var(--t-dark-teal)'];
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="rounded-full"
            style={{
              width: 6, height: 6,
              background: i <= level ? colors[level] : INK['12'],
              transition: 'background 0.3s ease',
            }}
          />
        ))}
      </div>
      <span className="text-[10px] font-semibold" style={{ color: colors[level], fontFamily: FONT.mono }}>
        {labels[level]}
      </span>
      {reviewCount > 0 && (
        <span className="text-[9px]" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
          · {reviewCount} reviews
        </span>
      )}
    </div>
  );
}

// ─── SourceProvenanceStrip Component ───
export function SourceProvenanceStrip({ signals }: { signals: BriefingSignal[] }) {
  // Normalize pipeline source_type values into display categories
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    signals.forEach(s => {
      const raw = s.source_type || 'analysis';
      // Map pipeline source types to display categories
      let src: string;
      if (raw === 'editorial' || raw === 'editorial_extraction') {
        src = 'editorial';
      } else if (raw === 'review_consensus' || raw === 'review_intelligence' || raw === 'review_taste_mismatch' || raw === 'review_bad_fit') {
        src = 'review';
      } else if (raw === 'instagram_vision' || raw === 'instagram') {
        src = 'instagram';
      } else if (raw === 'design_analysis') {
        src = 'design';
      } else if (raw === 'atmosphere_analysis') {
        src = 'atmosphere';
      } else if (raw === 'service_analysis') {
        src = 'service';
      } else if (raw === 'fooddrink_analysis') {
        src = 'food_drink';
      } else if (raw === 'character_analysis') {
        src = 'character';
      } else if (raw === 'setting_analysis') {
        src = 'setting';
      } else if (raw === 'wellness_analysis') {
        src = 'wellness';
      } else if (raw === 'sustainability_analysis') {
        src = 'sustainability';
      } else {
        src = raw;
      }
      counts[src] = (counts[src] || 0) + 1;
    });
    return counts;
  }, [signals]);

  const corroboratedCount = signals.filter(s => s.review_corroborated).length;
  const sourceLabels: Record<string, { iconName: string; label: string }> = {
    editorial: { iconName: 'article', label: 'Editorial' },
    review: { iconName: 'quote', label: 'Reviews' },
    instagram: { iconName: 'discover', label: 'Instagram' },
    design: { iconName: 'lightbulb', label: 'Design' },
    atmosphere: { iconName: 'lightbulb', label: 'Atmosphere' },
    service: { iconName: 'lightbulb', label: 'Service' },
    food_drink: { iconName: 'restaurant', label: 'Food & Drink' },
    character: { iconName: 'lightbulb', label: 'Character' },
    setting: { iconName: 'lightbulb', label: 'Setting' },
    wellness: { iconName: 'lightbulb', label: 'Wellness' },
    sustainability: { iconName: 'lightbulb', label: 'Sustainability' },
    menu: { iconName: 'restaurant', label: 'Menu' },
    awards: { iconName: 'sparkle', label: 'Awards' },
    analysis: { iconName: 'lightbulb', label: 'Analysis' },
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {Object.entries(sourceCounts).map(([src, count]) => {
        const meta = sourceLabels[src] || sourceLabels.analysis;
        return (
          <span
            key={src}
            className="text-[9px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1"
            style={{ background: INK['04'], color: TEXT.primary, fontFamily: FONT.mono }}
          >
            <PerriandIcon name={meta.iconName as PerriandIconName} size={10} color={TEXT.secondary} />
            {count} {meta.label}
          </span>
        );
      })}
      {corroboratedCount > 0 && (
        <span
          className="text-[9px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1"
          style={{ background: 'rgba(58,128,136,0.08)', color: 'var(--t-dark-teal)', fontFamily: FONT.mono }}
        >
          <PerriandIcon name="check" size={9} color="var(--t-dark-teal)" />
          {corroboratedCount} corroborated
        </span>
      )}
    </div>
  );
}

// ─── ConfidenceSpectrum Component ───
export function ConfidenceSpectrum({ signals, color }: { signals: BriefingSignal[]; color: string }) {
  // Plot signal confidences as dots on a 0-1 spectrum
  return (
    <div className="relative h-3 rounded-full overflow-hidden" style={{ background: `${color}08` }}>
      {/* Track line */}
      <div className="absolute top-1/2 left-0 right-0 h-px" style={{ background: `${color}20`, transform: 'translateY(-50%)' }} />
      {/* Signal dots */}
      {signals.map((sig, i) => (
        <div
          key={i}
          className="absolute top-1/2 rounded-full"
          title={`${sig.signal} (${Math.round(sig.confidence * 100)}%)`}
          style={{
            width: sig.review_corroborated ? 7 : 5,
            height: sig.review_corroborated ? 7 : 5,
            background: sig.review_corroborated ? color : `${color}90`,
            border: sig.review_corroborated ? `1px solid white` : 'none',
            left: `${Math.max(2, Math.min(98, sig.confidence * 100))}%`,
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 2px rgba(0,0,0,0.15)',
          }}
        />
      ))}
      {/* Scale labels */}
      <span className="absolute left-1 top-full text-[7px] mt-0.5" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>0</span>
      <span className="absolute right-1 top-full text-[7px] mt-0.5" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>100</span>
    </div>
  );
}

// ─── HeadlineSignal Component ───
export function HeadlineSignal({ signal, color }: { signal: BriefingSignal; color: string }) {
  return (
    <div
      className="p-4 rounded-xl mb-2"
      style={{
        background: `${color}06`,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div className="text-[13px] leading-relaxed font-medium" style={{ color: TEXT.primary }}>
        {signal.signal}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${color}15`, color, fontFamily: FONT.mono }}>
          {Math.round(signal.confidence * 100)}% confidence
        </span>
        {signal.source_type && (
          <span className="text-[8px]" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
            via {signal.source_type}
          </span>
        )}
        {signal.review_corroborated && (
          <span className="flex items-center gap-0.5 text-[8px]" style={{ color: 'var(--t-dark-teal)', fontFamily: FONT.mono }}>
            <PerriandIcon name="check" size={9} color="var(--t-dark-teal)" /> verified
          </span>
        )}
      </div>
    </div>
  );
}

// ─── CompactSignal Component ───
export function CompactSignal({ signal }: { signal: BriefingSignal }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-[9px] font-semibold w-7 text-right flex-shrink-0 mt-0.5" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
        {Math.round(signal.confidence * 100)}
      </span>
      <span className="text-[11px] leading-snug" style={{ color: TEXT.primary }}>
        {signal.signal}
        {signal.review_corroborated && (
          <PerriandIcon name="check" size={9} color="var(--t-dark-teal)" style={{ display: 'inline', marginLeft: 3, verticalAlign: 'middle' }} />
        )}
      </span>
    </div>
  );
}

// ─── InlineAntiSignal Component ───
export function InlineAntiSignal({ signal }: { signal: BriefingAntiSignal }) {
  return (
    <div className="flex items-start gap-2 py-1.5 px-3 rounded-lg mt-1.5" style={{ background: 'rgba(160,108,40,0.05)' }}>
      <PerriandIcon name="alert" size={12} color="var(--t-amber)" />
      <span className="text-[11px] leading-snug italic" style={{ color: TEXT.secondary }}>
        {signal.signal}
      </span>
    </div>
  );
}

// ─── getFactIconName Helper Function ───
const FACT_ICON_MAP: Record<string, string> = {
  cuisine: 'restaurant', cuisinetype: 'restaurant', type: 'restaurant',
  pricerange: 'currency', price: 'currency', pricetier: 'currency',
  michelinstars: 'star', michelin: 'star', awards: 'sparkle',
  yearopened: 'calendar', established: 'calendar', opened: 'calendar',
  capacity: 'person', seats: 'person', seating: 'person',
  chef: 'person', headchef: 'person',
  neighborhood: 'pin', area: 'pin', district: 'pin',
  style: 'design', ambiance: 'design', vibe: 'design',
  reservations: 'bookmark', booking: 'bookmark',
  dresscode: 'profile', attire: 'profile',
};

export function getFactIconName(key: string): string {
  const lower = key.toLowerCase();
  for (const [k, iconName] of Object.entries(FACT_ICON_MAP)) {
    if (lower.includes(k)) return iconName;
  }
  return 'sparkle';
}

'use client';

import { useState } from 'react';
import type { PropertyExemplar } from '@/types';
import { DOMAIN_DISPLAY } from '@/constants/profile';

/** Reaction sentiments the user can choose — mapped to blend weights */
const REACTIONS = [
  { key: 'love', label: 'Love it', blendWeight: 0.8 },
  { key: 'like', label: 'Nice', blendWeight: 0.5 },
  { key: 'meh', label: 'Meh', blendWeight: 0.0 },
  { key: 'not-me', label: 'Not me', blendWeight: -0.3 },
] as const;

type ReactionKey = typeof REACTIONS[number]['key'];

const REACTION_COLORS: Record<ReactionKey, { bg: string; border: string }> = {
  love: { bg: 'rgba(200, 146, 58, 0.15)', border: 'rgba(200, 146, 58, 0.3)' },
  like: { bg: 'rgba(42, 122, 86, 0.12)', border: 'rgba(42, 122, 86, 0.25)' },
  meh: { bg: 'rgba(232, 220, 200, 0.5)', border: 'rgba(232, 220, 200, 0.8)' },
  'not-me': { bg: 'rgba(214, 48, 32, 0.08)', border: 'rgba(214, 48, 32, 0.2)' },
};

interface PropertyReactionCardProps {
  exemplar: PropertyExemplar;
  domain: string;
  /** Called when user taps a reaction — provides sentiment + blendWeight */
  onReact: (
    googlePlaceId: string,
    sentiment: string,
    blendWeight: number,
    propertyName: string,
    placeType: string | null,
  ) => void;
  /** Optional dismiss handler — when provided, shows an × button to skip this card */
  onDismiss?: (googlePlaceId: string) => void;
}

/** Extract a short location hint from a full address, e.g. "London, UK" from "192a Brick Ln, London E1 6SA, UK" */
function shortLocation(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 2) return address;
  // Take last 2 meaningful parts (typically city/region + country)
  return parts.slice(-2).join(', ');
}

export default function PropertyReactionCard({
  exemplar,
  domain,
  onReact,
  onDismiss,
}: PropertyReactionCardProps) {
  const [selected, setSelected] = useState<ReactionKey | null>(null);

  const handleReact = (reaction: typeof REACTIONS[number]) => {
    if (selected) return; // already reacted
    setSelected(reaction.key);
    onReact(
      exemplar.googlePlaceId,
      reaction.key === 'not-me' ? 'dislike' : reaction.key === 'meh' ? 'visited' : reaction.key,
      reaction.blendWeight,
      exemplar.propertyName,
      exemplar.placeType,
    );
  };

  return (
    <div
      className={`
        w-full rounded-2xl px-5 py-4 mb-3 relative
        transition-all duration-500
        ${selected ? 'opacity-70' : ''}
      `}
      style={{
        backgroundColor: 'var(--t-warm-white)',
        border: selected
          ? `1.5px solid ${REACTION_COLORS[selected].border}`
          : '1px solid rgba(28, 26, 23, 0.06)',
      }}
    >
      {/* Dismiss button — only shown when onDismiss is provided and card not yet reacted to */}
      {onDismiss && !selected && (
        <button
          onClick={() => onDismiss(exemplar.googlePlaceId)}
          className="absolute top-3 right-3 flex items-center justify-center w-6 h-6 rounded-full hover:bg-[rgba(0,42,85,0.06)] transition-colors"
          style={{ color: 'var(--t-ink)', opacity: 0.25 }}
          aria-label={`Dismiss ${exemplar.propertyName}`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}

      {/* Domain chip */}
      <p
        className="font-mono text-[9px] uppercase tracking-widest mb-2"
        style={{ color: 'var(--t-ink)' }}
      >
        {DOMAIN_DISPLAY[domain] || domain}
      </p>

      {/* Property name */}
      <h3
        className="text-[18px] leading-tight mb-1"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--t-ink)' }}
      >
        {exemplar.propertyName}
      </h3>

      {/* Metadata row */}
      <div className="flex items-center gap-2 mb-4">
        {exemplar.placeType && (
          <span
            className="text-[11px] tracking-wide uppercase"
            style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--t-ink)' }}
          >
            {exemplar.placeType}
          </span>
        )}
        {exemplar.placeType && shortLocation(exemplar.locationHint) && (
          <span style={{ color: 'var(--t-ink)', opacity: 0.2 }}>·</span>
        )}
        {shortLocation(exemplar.locationHint) && (
          <span
            className="text-[11px]"
            style={{ color: 'var(--t-ink)' }}
          >
            {shortLocation(exemplar.locationHint)}
          </span>
        )}
      </div>

      {/* Reaction buttons */}
      <div className="flex gap-2">
        {REACTIONS.map((reaction) => {
          const isSelected = selected === reaction.key;
          const colors = REACTION_COLORS[reaction.key];
          return (
            <button
              key={reaction.key}
              onClick={() => handleReact(reaction)}
              disabled={!!selected}
              className={`
                flex-1 py-2 rounded-xl text-[13px] font-medium
                transition-all duration-300
                ${isSelected ? 'scale-[1.02]' : ''}
                ${selected && !isSelected ? 'opacity-30' : ''}
                hover:scale-[1.02] active:scale-[0.97]
              `}
              style={{
                backgroundColor: isSelected ? colors.bg : 'transparent',
                border: `1px solid ${isSelected ? colors.border : 'rgba(28, 26, 23, 0.08)'}`,
                color: 'var(--t-ink)',
              }}
            >
              {reaction.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

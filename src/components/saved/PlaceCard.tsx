'use client';

import { memo, useRef, useCallback } from 'react';
import { ImportedPlace, REACTIONS, SOURCE_STYLES } from '@/types';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';
import { TYPE_ICONS, THUMB_GRADIENTS, TYPE_BRAND_COLORS } from '@/constants/placeTypes';
import { FONT, INK, TEXT } from '@/constants/theme';
import { getDisplayLocation } from '@/lib/place-display';
import { smartTruncate } from '@/lib/smart-truncate';
import { getMatchTier } from '@/lib/match-tier';

interface PlaceCardProps {
  place: ImportedPlace;
  onTap: () => void;
  onToggleCollections: () => void;
  onLongPress: () => void;
  /** How many collections this place belongs to */
  collectionCount: number;
}

function PlaceCard({ place, onTap, onToggleCollections, onLongPress, collectionCount }: PlaceCardProps) {
  const typeIcon = TYPE_ICONS[place.type] || 'location';
  const typeColor = TYPE_BRAND_COLORS[place.type] || TEXT.secondary;
  const google = place.google;
  const priceStr = google?.priceLevel ? '$'.repeat(google.priceLevel) : null;
  const ratingReaction = place.rating ? REACTIONS.find(r => r.id === place.rating!.reaction) : null;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayLocation = getDisplayLocation(place.location, place.name, place.google?.address);

  // Narrative: prefer match explanation, then personal note / insight / taste note
  const narrative = place.matchExplanation?.narrative
    || place.friendAttribution?.note
    || place.rating?.personalNote
    || place.terrazzoInsight?.why
    || place.enrichment?.description
    || '';
  const smartNarrative = smartTruncate(narrative, 320);

  const handlePointerDown = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      onLongPress();
      longPressTimer.current = null;
    }, 500);
  }, [onLongPress]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  return (
    <div
      onClick={onTap}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className="rounded-xl cursor-pointer transition-all overflow-hidden card-hover flex flex-col"
      style={{ background: 'white', border: `1px solid ${INK['10']}`, height: '100%' }}
    >
      {/* ── Primary tier: icon + name + score ── */}
      <div
        className="flex items-center gap-2.5 px-3 py-2.5"
        style={{ borderBottom: `1px solid ${INK['06']}` }}
      >
        {/* Type icon thumbnail */}
        <div
          className="rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            width: 40, height: 40,
            background: THUMB_GRADIENTS[place.type] || THUMB_GRADIENTS.restaurant,
          }}
        >
          <PerriandIcon name={typeIcon as PerriandIconName} size={18} color={typeColor} />
        </div>

        {/* Name + location */}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold truncate" style={{ color: TEXT.primary, fontFamily: FONT.sans }}>
            {place.name}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span style={{ fontFamily: FONT.sans, fontSize: 10, color: TEXT.secondary }}>
              {place.type.charAt(0).toUpperCase() + place.type.slice(1)}
            </span>
            {displayLocation && (
              <span style={{ fontSize: 10, color: TEXT.secondary }}>· {displayLocation}</span>
            )}
          </div>
        </div>

        {/* Match tier — qualitative label */}
        {(() => {
          const tier = getMatchTier(place.matchScore);
          return (
            <div
              className="flex-shrink-0 px-2 py-1 rounded-lg"
              style={{ background: tier.bg }}
            >
              <div style={{ fontFamily: FONT.mono, fontSize: 10, fontWeight: 700, lineHeight: 1.3, color: tier.color, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                {tier.shortLabel}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Secondary tier: narrative + metadata ── */}
      <div className="px-3 pt-2 pb-2.5 flex flex-col flex-1">
        {/* Narrative — smart-truncated at sentence boundaries */}
        {smartNarrative && (
          <p
            style={{
              fontFamily: FONT.sans,
              fontSize: 11,
              lineHeight: 1.5,
              color: TEXT.secondary,
              margin: 0,
              marginBottom: 8,
            }}
          >
            {smartNarrative}
          </p>
        )}

        {/* Pills: reaction, friend, Google rating, price, bookmark */}
        <div className="flex items-center gap-1.5 flex-wrap mt-auto">
          {ratingReaction && (() => {
            // Use coral for 'myPlace' so it's visually distinct from the teal bookmark
            const rxColor = place.rating?.reaction === 'myPlace' ? '#ee716d' : ratingReaction.color;
            return (
              <span
                className="px-1.5 py-0.5 rounded flex items-center gap-1"
                style={{ fontSize: 9, fontWeight: 600, background: `${rxColor}12`, color: rxColor, fontFamily: FONT.mono }}
              >
                <PerriandIcon name={ratingReaction.icon} size={10} color={rxColor} /> {ratingReaction.label}
              </span>
            );
          })()}
          {place.friendAttribution && (
            <span
              className="px-1.5 py-0.5 rounded flex items-center gap-1"
              style={{ fontSize: 9, fontWeight: 600, background: 'rgba(58,128,136,0.06)', color: 'var(--t-dark-teal)', fontFamily: FONT.mono }}
            >
              <PerriandIcon name="friend" size={10} color="var(--t-dark-teal)" /> {place.friendAttribution.name}
            </span>
          )}
          {google?.rating && (
            <span
              className="px-1.5 py-0.5 rounded flex items-center gap-1"
              style={{ fontFamily: FONT.mono, fontSize: 9, color: TEXT.secondary, background: INK['04'] }}
            >
              <PerriandIcon name="star" size={10} color={TEXT.secondary} /> {google.rating} Google Rating
            </span>
          )}
          {priceStr && (
            <span
              className="px-1.5 py-0.5 rounded"
              style={{ fontFamily: FONT.mono, fontSize: 9, color: TEXT.secondary, background: INK['04'] }}
            >
              {priceStr}
            </span>
          )}

          {/* Bookmark — pushed to the right */}
          <button
            aria-label={collectionCount > 0 ? `In ${collectionCount} collections` : 'Add to collection'}
            onClick={(e) => { e.stopPropagation(); onToggleCollections(); }}
            className="flex items-center gap-1 rounded-full px-2 py-0.5 transition-all flex-shrink-0 ml-auto"
            style={{
              background: collectionCount > 0 ? 'rgba(58,128,136,0.10)' : INK['06'],
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <PerriandIcon name="bookmark" size={11} color={collectionCount > 0 ? 'var(--t-dark-teal)' : INK['40']} />
            {collectionCount > 0 && (
              <span style={{ fontFamily: FONT.mono, fontSize: 9, fontWeight: 700, color: 'var(--t-dark-teal)' }}>
                {collectionCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders in grid of saved places (potentially hundreds of items).
// Parent should stabilize onTap, onToggleCollections, onLongPress callback references.
export default memo(PlaceCard);

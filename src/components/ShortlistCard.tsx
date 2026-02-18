'use client';

import { useMemo } from 'react';
import { Shortlist, ImportedPlace } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';

const THUMB_GRADIENTS: Record<string, string> = {
  restaurant: 'linear-gradient(135deg, #d8c8ae, #c0ab8e)',
  hotel: 'linear-gradient(135deg, #d0c8d8, #b8b0c0)',
  bar: 'linear-gradient(135deg, #c0d0c8, #a8c0b0)',
  cafe: 'linear-gradient(135deg, #d8d0c0, #c8c0b0)',
  museum: 'linear-gradient(135deg, #c0c8d0, #a8b0b8)',
  activity: 'linear-gradient(135deg, #c0d0c8, #a8b8a8)',
  neighborhood: 'linear-gradient(135deg, #d0d8c8, #b8c0a8)',
  shop: 'linear-gradient(135deg, #d8c8b8, #c0b0a0)',
};

function getPlaceImage(place: ImportedPlace): string | null {
  // Use Google photo if available
  if (place.google?.photoUrl) return place.google.photoUrl;
  return null;
}

export default function ShortlistCard({
  shortlist,
  places,
  onClick,
}: {
  shortlist: Shortlist;
  places: ImportedPlace[];
  onClick: () => void;
}) {
  // Get first 4 places for thumbnail grid
  const previewPlaces = useMemo(() => {
    return shortlist.placeIds
      .slice(0, 4)
      .map(id => places.find(p => p.id === id))
      .filter(Boolean) as ImportedPlace[];
  }, [shortlist.placeIds, places]);

  const placeCount = shortlist.placeIds.length;
  const cityLabel = shortlist.cities.length > 0
    ? shortlist.cities.slice(0, 2).join(', ') + (shortlist.cities.length > 2 ? ` +${shortlist.cities.length - 2}` : '')
    : '';

  // Is the emoji a PerriandIcon name or an actual emoji?
  const isPerriandIcon = shortlist.emoji && !shortlist.emoji.match(/[\u{1F000}-\u{1FFFF}]/u) && shortlist.emoji.length > 2;

  return (
    <div
      onClick={onClick}
      className="rounded-xl cursor-pointer transition-all hover:scale-[1.01] overflow-hidden"
      style={{
        background: 'white',
        border: shortlist.isDefault ? '1.5px solid var(--t-verde)' : '1px solid var(--t-linen)',
        boxSizing: 'border-box',
      }}
    >
      {/* Thumbnail grid — terrazzo tile + grout motif */}
      <div
        className="grid overflow-hidden"
        style={{
          gridTemplateColumns: previewPlaces.length > 1 ? '1fr 1fr' : '1fr',
          height: previewPlaces.length > 0 ? 100 : 48,
          background: '#ddd5c5', // travertine grout — matches Terrazzo Mosaic
          gap: 2,
          padding: 2,
          borderRadius: '11px 11px 0 0', // match outer card rounding minus border
          boxShadow: 'inset 0 0 0 1px rgba(28,26,23,0.04)', // subtle depth like Mosaic grout
        }}
      >
        {previewPlaces.length > 0 ? (
          previewPlaces.map((place, i) => {
            const imgUrl = getPlaceImage(place);
            // Tile corner radii: outer corners get more rounding, inner corners stay tight
            const isTop = i < 2 || previewPlaces.length === 1;
            const isLeft = i % 2 === 0;
            const isRight = i % 2 === 1 || previewPlaces.length === 1;
            const outerR = 9; // subtle rounding on outer corners
            const innerR = 2; // tight grout corners like real tile
            const borderRadius = previewPlaces.length === 1
              ? `${outerR}px`
              : [
                  isTop && isLeft ? outerR : innerR,
                  isTop && isRight ? outerR : innerR,
                  !isTop && isRight ? innerR : innerR,
                  !isTop && isLeft ? innerR : innerR,
                ].map(r => `${r}px`).join(' ');

            return (
              <div
                key={place.id}
                style={{
                  background: imgUrl
                    ? `url(${imgUrl}) center/cover`
                    : THUMB_GRADIENTS[place.type] || THUMB_GRADIENTS.restaurant,
                  minHeight: 0,
                  borderRadius,
                }}
              />
            );
          })
        ) : (
          <div
            className="flex items-center justify-center"
            style={{ background: 'var(--t-linen)', borderRadius: 9 }}
          >
            <PerriandIcon name="saved" size={24} color="rgba(28,26,23,0.2)" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1">
          {shortlist.emoji && (
            <span style={{ fontSize: isPerriandIcon ? 14 : 16 }}>
              {isPerriandIcon ? (
                <PerriandIcon name={shortlist.emoji as any} size={14} color="var(--t-ink)" />
              ) : (
                shortlist.emoji
              )}
            </span>
          )}
          <span
            className="text-[14px] font-semibold truncate"
            style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}
          >
            {shortlist.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: 'rgba(28,26,23,0.6)' }}>
            {placeCount} {placeCount === 1 ? 'place' : 'places'}
          </span>
          {cityLabel && (
            <>
              <span style={{ color: 'rgba(28,26,23,0.15)', fontSize: 10 }}>·</span>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: 'rgba(28,26,23,0.5)' }}>
                {cityLabel}
              </span>
            </>
          )}
          {shortlist.isSmartCollection && (
            <>
              <span style={{ color: 'rgba(28,26,23,0.15)', fontSize: 10 }}>·</span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: 'var(--t-verde)' }}>
                Auto-updating
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

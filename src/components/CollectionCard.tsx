'use client';

import React from 'react';
import { Collection, ImportedPlace } from '@/types';
import { PerriandIcon, isPerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK, COLORS } from '@/constants/theme';

interface CollectionCardProps {
  collection: Collection;
  places: ImportedPlace[];
  onClick: () => void;
}

function CollectionCardInner({
  collection,
  places,
  onClick,
}: CollectionCardProps) {
  const placeCount = collection.placeIds.length;
  const isPerriandIcon = collection.emoji ? isPerriandIconName(collection.emoji) : false;

  return (
    <div
      onClick={onClick}
      className="cursor-pointer transition-all hover:scale-[1.01] card-hover"
      style={{
        background: 'white',
        border: `2px solid ${COLORS.navy}`,
        boxSizing: 'border-box',
        padding: '14px 16px',
        overflow: 'hidden',
        minWidth: 0,
        borderRadius: 0,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 32,
            height: 32,
            borderRadius: 0,
            background: COLORS.peach,
          }}
        >
          {collection.emoji && (
            <span style={{ fontSize: isPerriandIcon ? 14 : 16 }}>
              {isPerriandIcon ? (
                <PerriandIcon name={collection.emoji as any} size={14} color={COLORS.coral} />
              ) : (
                collection.emoji
              )}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="truncate"
            style={{ fontFamily: FONT.display, fontSize: 14, color: COLORS.navy, lineHeight: 1.2, letterSpacing: '0.03em', textTransform: 'uppercase' }}
          >
            {collection.name}
          </div>
          <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['50'], whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
              {placeCount} {placeCount === 1 ? 'place' : 'places'}
            </span>
            {collection.isSmartCollection && (
              <>
                <span style={{ color: INK['20'], fontSize: 8 }}>·</span>
                <span style={{ fontFamily: FONT.mono, fontSize: 9, color: COLORS.mint, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Auto
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const CollectionCard = React.memo(CollectionCardInner);
CollectionCard.displayName = 'CollectionCard';
export default CollectionCard;

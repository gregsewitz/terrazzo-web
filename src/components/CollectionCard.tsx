'use client';

import React from 'react';
import { Collection, ImportedPlace } from '@/types';
import { PerriandIcon, isPerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';

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
      className="rounded-xl cursor-pointer transition-all hover:scale-[1.01]"
      style={{
        background: 'white',
        border: '1px solid var(--t-linen)',
        boxSizing: 'border-box',
        padding: '10px 12px',
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: INK['04'],
          }}
        >
          {collection.emoji && (
            <span style={{ fontSize: isPerriandIcon ? 13 : 15 }}>
              {isPerriandIcon ? (
                <PerriandIcon name={collection.emoji as any} size={13} color={INK['70']} />
              ) : (
                collection.emoji
              )}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="text-[12px] font-semibold truncate"
            style={{ fontFamily: FONT.sans, color: 'var(--t-ink)', lineHeight: 1.3 }}
          >
            {collection.name}
          </div>
          <div className="flex items-center gap-1.5" style={{ marginTop: 2 }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['50'], whiteSpace: 'nowrap' }}>
              {placeCount} {placeCount === 1 ? 'place' : 'places'}
            </span>
            {collection.isSmartCollection && (
              <>
                <span style={{ color: INK['15'], fontSize: 8 }}>·</span>
                <span style={{ fontFamily: FONT.mono, fontSize: 9, color: 'var(--t-verde)', whiteSpace: 'nowrap' }}>
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

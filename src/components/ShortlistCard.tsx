'use client';

import React from 'react';
import { Shortlist, ImportedPlace } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';

interface ShortlistCardProps {
  shortlist: Shortlist;
  places: ImportedPlace[];
  onClick: () => void;
}

function ShortlistCardInner({
  shortlist,
  places,
  onClick,
}: ShortlistCardProps) {
  const placeCount = shortlist.placeIds.length;
  const isPerriandIcon = shortlist.emoji && !shortlist.emoji.match(/[\u{1F000}-\u{1FFFF}]/u) && shortlist.emoji.length > 2;

  return (
    <div
      onClick={onClick}
      className="rounded-xl cursor-pointer transition-all hover:scale-[1.01]"
      style={{
        background: 'white',
        border: shortlist.isDefault ? '1.5px solid var(--t-verde)' : '1px solid var(--t-linen)',
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
            background: shortlist.isDefault ? 'rgba(42,122,86,0.08)' : INK['04'],
          }}
        >
          {shortlist.emoji && (
            <span style={{ fontSize: isPerriandIcon ? 13 : 15 }}>
              {isPerriandIcon ? (
                <PerriandIcon name={shortlist.emoji as any} size={13} color={shortlist.isDefault ? 'var(--t-verde)' : INK['70']} />
              ) : (
                shortlist.emoji
              )}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="text-[12px] font-semibold truncate"
            style={{ fontFamily: FONT.sans, color: 'var(--t-ink)', lineHeight: 1.3 }}
          >
            {shortlist.name}
          </div>
          <div className="flex items-center gap-1.5" style={{ marginTop: 2 }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['50'], whiteSpace: 'nowrap' }}>
              {placeCount} {placeCount === 1 ? 'place' : 'places'}
            </span>
            {shortlist.isSmartCollection && (
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

const ShortlistCard = React.memo(ShortlistCardInner);
ShortlistCard.displayName = 'ShortlistCard';
export default ShortlistCard;

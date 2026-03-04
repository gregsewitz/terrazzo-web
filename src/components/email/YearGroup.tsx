'use client';

import React from 'react';
import { FONT, INK } from '@/constants/theme';
import { ReservationRow } from './ReservationRow';
import type { YearGroupData } from '@/lib/email-reservations-helpers';
import type { ReactionId } from '@/types';

// ─── Component ──────────────────────────────────────────────────────────────

interface YearGroupProps {
  group: YearGroupData;
  selectedIds: Set<string>;
  ratings: Map<string, ReactionId>;
  onToggleSelect: (id: string) => void;
  onRate: (reservationId: string, reactionId: ReactionId) => void;
}

export const YearGroup = React.memo(function YearGroup({
  group,
  selectedIds,
  ratings,
  onToggleSelect,
  onRate,
}: YearGroupProps) {
  const placeCount = group.reservations.length;

  return (
    <div>
      {/* Year header */}
      <div className="flex items-center gap-2 mb-2 mt-1">
        <span className="text-[18px]" style={{ color: 'var(--t-ink)', fontFamily: FONT.serif }}>
          {group.year}
        </span>
        <span className="text-[10px]" style={{ color: INK['40'] }}>
          {placeCount} place{placeCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Rows */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
        {group.reservations.map((r, idx) => (
          <ReservationRow
            key={r.id}
            reservation={r}
            isSelected={selectedIds.has(r.id)}
            onToggle={() => onToggleSelect(r.id)}
            showReactions
            reaction={ratings.get(r.id)}
            onReaction={(reactionId) => onRate(r.id, reactionId)}
            isLast={idx === group.reservations.length - 1}
          />
        ))}
      </div>
    </div>
  );
});

YearGroup.displayName = 'YearGroup';

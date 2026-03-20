'use client';

import React from 'react';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT, COLOR } from '@/constants/theme';
import { formatCompactDetails, type StagedReservation } from '@/lib/email-reservations-helpers';
import type { PerriandIconName, ReactionId } from '@/types';

// ─── Constants ──────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, PerriandIconName> = {
  restaurant: 'restaurant',
  hotel: 'hotel',
  flight: 'transport',
  activity: 'activity',
  bar: 'bar',
  cafe: 'cafe',
};

const REACTIONS: { id: ReactionId; icon: PerriandIconName; label: string; color: string }[] = [
  { id: 'myPlace', icon: 'myPlace', label: 'Obsessed', color: COLOR.darkTeal },
  { id: 'enjoyed', icon: 'enjoyed', label: 'Enjoyed', color: COLOR.coral },
  { id: 'mixed', icon: 'mixed', label: 'Mixed', color: COLOR.ochre },
  { id: 'notMe', icon: 'notMe', label: 'Not me', color: COLOR.signalRed },
];

// ─── Component ──────────────────────────────────────────────────────────────

interface ReservationRowProps {
  reservation: StagedReservation;
  isSelected: boolean;
  onToggle: () => void;
  showReactions?: boolean;
  reaction?: ReactionId;
  onReaction?: (reactionId: ReactionId) => void;
  isLast?: boolean;
  /** Trip name if this reservation has been individually assigned */
  assignedTripName?: string;
  /** Open the trip picker for this reservation */
  onTripPillClick?: () => void;
  /** Remove this reservation's trip assignment */
  onRemoveTripAssignment?: () => void;
}

export const ReservationRow = React.memo(function ReservationRow({
  reservation: r,
  isSelected,
  onToggle,
  showReactions = false,
  reaction,
  onReaction,
  isLast = false,
  assignedTripName,
  onTripPillClick,
  onRemoveTripAssignment,
}: ReservationRowProps) {
  const icon = TYPE_ICONS[r.placeType] || 'discover';
  const details = formatCompactDetails(r);

  return (
    <div
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--t-linen)' }}
    >
      {/* Main row */}
      <div
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); }
        }}
        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors"
        style={{ background: isSelected ? 'rgba(58,128,136,0.03)' : 'transparent' }}
      >
        {/* Checkbox */}
        <div
          className="w-[18px] h-[18px] rounded flex items-center justify-center flex-shrink-0 transition-all"
          style={{
            background: isSelected ? 'var(--t-dark-teal)' : 'white',
            border: isSelected ? 'none' : '1.5px solid var(--t-linen)',
          }}
        >
          {isSelected && <PerriandIcon name="check" size={12} color="white" />}
        </div>

        {/* Icon */}
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: INK['06'] }}
        >
          <PerriandIcon name={icon} size={12} color={INK['50']} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold truncate" style={{ color: TEXT.primary, fontFamily: FONT.sans }}>
            {r.placeName}
          </div>
          {(r.location || details) && (
            <div className="text-[10px] truncate mt-0.5" style={{ color: TEXT.secondary }}>
              {r.location}{r.location && details ? ' · ' : ''}{details}
            </div>
          )}
        </div>

        {/* Trip assignment pill (unmatched reservations) */}
        {onTripPillClick && (
          assignedTripName ? (
            <button
              onClick={(e) => { e.stopPropagation(); }}
              className="flex items-center gap-1 px-2 py-1 rounded-full flex-shrink-0 border-none cursor-default max-w-[140px]"
              style={{ background: 'rgba(58,128,136,0.08)' }}
            >
              <PerriandIcon name="trips" size={9} color="var(--t-dark-teal)" />
              <span
                className="text-[9px] font-medium truncate"
                style={{ color: 'var(--t-dark-teal)' }}
              >
                {assignedTripName}
              </span>
              {onRemoveTripAssignment && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); onRemoveTripAssignment(); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onRemoveTripAssignment(); } }}
                  className="cursor-pointer ml-0.5 flex-shrink-0"
                  style={{ color: 'var(--t-dark-teal)', opacity: 0.5 }}
                >
                  ✕
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onTripPillClick(); }}
              className="flex items-center gap-1 px-2 py-1 rounded-full flex-shrink-0 border-none cursor-pointer transition-all"
              style={{ background: INK['06'], color: TEXT.secondary }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(58,128,136,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = INK['06']; }}
            >
              <PerriandIcon name="trips" size={9} color={INK['30']} />
              <span className="text-[9px] font-medium">Trip</span>
            </button>
          )
        )}

        {/* Confirmation number */}
        {r.confirmationNumber && (
          <span
            className="text-[10px] px-2 py-1 rounded-md flex-shrink-0"
            style={{
              background: 'var(--t-linen)',
              color: TEXT.secondary,
              fontFamily: FONT.mono,
              letterSpacing: '0.02em',
            }}
          >
            {r.confirmationNumber}
          </span>
        )}
      </div>

      {/* Reaction row (History tab) */}
      {showReactions && (
        <div className="flex items-center gap-1 px-3 pb-2.5 pl-[54px]">
          {REACTIONS.map(({ id, icon: reactionIcon, label, color }) => {
            const isActive = reaction === id;
            return (
              <button
                key={id}
                onClick={(e) => {
                  e.stopPropagation();
                  onReaction?.(id);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-full border-none cursor-pointer transition-all"
                style={{
                  background: isActive ? `${color}14` : 'transparent',
                  border: isActive ? `1px solid ${color}30` : '1px solid transparent',
                }}
                title={label}
              >
                <PerriandIcon name={reactionIcon} size={12} color={isActive ? color : INK['30']} />
                <span
                  className="text-[9px] font-medium"
                  style={{ color: isActive ? color : TEXT.secondary }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

ReservationRow.displayName = 'ReservationRow';

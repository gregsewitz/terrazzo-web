'use client';

import React, { useState, useRef, useEffect } from 'react';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import { ReservationRow } from './ReservationRow';
import type { TripGroupData } from '@/lib/email-reservations-helpers';

// ─── Component ──────────────────────────────────────────────────────────────

interface TripGroupProps {
  group: TripGroupData;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  isLinked: boolean;
  onToggleTripLink: () => void;
  onCreateTrip?: (name: string, reservationIds: string[]) => Promise<string | null>;
  isCreatingTrip?: boolean;
}

export const TripGroup = React.memo(function TripGroup({
  group,
  selectedIds,
  onToggleSelect,
  isLinked,
  onToggleTripLink,
  onCreateTrip,
  isCreatingTrip,
}: TripGroupProps) {
  const isMatched = group.tripId !== null;
  const placeCount = group.reservations.length;

  // Inline trip creation state
  const [showNameInput, setShowNameInput] = useState(false);
  const [tripName, setTripName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when shown
  useEffect(() => {
    if (showNameInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showNameInput]);

  // Derive a suggested name from locations
  const suggestedName = React.useMemo(() => {
    const locations = [...new Set(group.reservations.map(r => r.location).filter(Boolean))];
    if (locations.length === 1) return locations[0]!;
    if (locations.length > 1) return locations.slice(0, 2).join(' & ');
    return '';
  }, [group.reservations]);

  const handleCreateTrip = async () => {
    const name = tripName.trim() || suggestedName || 'New Trip';
    if (!onCreateTrip) return;
    const ids = group.reservations.map(r => r.id);
    const tripId = await onCreateTrip(name, ids);
    if (tripId) {
      setShowNameInput(false);
      setTripName('');
    }
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
      {/* Group header */}
      <div className="flex items-center gap-2.5 px-3 py-3" style={{ borderBottom: '1px solid var(--t-linen)' }}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: isMatched ? 'rgba(42,122,86,0.06)' : INK['06'] }}
        >
          <PerriandIcon
            name={isMatched ? 'trips' : 'discover'}
            size={14}
            color={isMatched ? 'var(--t-verde)' : INK['50']}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold" style={{ color: 'var(--t-ink)', fontFamily: FONT.serif }}>
            {group.tripName}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {group.dateRange && (
              <span className="text-[9px]" style={{ color: INK['50'], fontFamily: FONT.mono }}>
                {group.dateRange}
              </span>
            )}
            <span className="text-[9px]" style={{ color: INK['40'] }}>
              {placeCount} place{placeCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Trip link toggle (matched trips only) */}
      {isMatched && (
        <div
          onClick={onToggleTripLink}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleTripLink(); }
          }}
          className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-all"
          style={{
            background: isLinked ? 'rgba(42,122,86,0.04)' : INK['04'],
            borderBottom: '1px solid var(--t-linen)',
          }}
        >
          {/* Mini checkbox */}
          <div
            className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
            style={{
              background: isLinked ? 'var(--t-verde)' : 'white',
              border: isLinked ? 'none' : `1.5px solid ${INK['20']}`,
            }}
          >
            {isLinked && (
              <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </div>
          <PerriandIcon name="trips" size={12} color={isLinked ? 'var(--t-verde)' : INK['30']} />
          <span
            className="text-[10px]"
            style={{
              color: isLinked ? INK['70'] : INK['40'],
              textDecoration: isLinked ? 'none' : 'line-through',
            }}
          >
            {isLinked ? (
              <>Also add to <strong>{group.tripName}</strong> itinerary</>
            ) : (
              <>Import places only — not linked to <strong>{group.tripName}</strong></>
            )}
          </span>
        </div>
      )}

      {/* Unmatched group: Create trip CTA or inline form */}
      {!isMatched && !showNameInput && (
        <div
          onClick={() => setShowNameInput(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowNameInput(true); }
          }}
          className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-[rgba(200,146,58,0.08)] transition-colors"
          style={{ background: 'rgba(200,146,58,0.04)', borderBottom: '1px solid var(--t-linen)' }}
        >
          <PerriandIcon name="add" size={12} color="var(--t-honey)" />
          <span className="text-[10px] font-medium" style={{ color: 'var(--t-honey-text, #8a6a2a)' }}>
            Create a trip from these places
          </span>
        </div>
      )}

      {/* Inline trip name input */}
      {!isMatched && showNameInput && (
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ background: 'rgba(200,146,58,0.04)', borderBottom: '1px solid var(--t-linen)' }}
        >
          <PerriandIcon name="trips" size={12} color="var(--t-honey)" />
          <input
            ref={inputRef}
            type="text"
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleCreateTrip(); }
              if (e.key === 'Escape') { setShowNameInput(false); setTripName(''); }
            }}
            placeholder={suggestedName || 'Trip name...'}
            className="flex-1 text-[11px] bg-transparent outline-none placeholder:text-[#b8a070]"
            style={{ color: 'var(--t-ink)', fontFamily: FONT.sans }}
            disabled={isCreatingTrip}
          />
          <button
            onClick={handleCreateTrip}
            disabled={isCreatingTrip}
            className="text-[10px] font-semibold px-2.5 py-1 rounded-md transition-all"
            style={{
              background: isCreatingTrip ? INK['10'] : 'var(--t-honey)',
              color: 'white',
              opacity: isCreatingTrip ? 0.6 : 1,
            }}
          >
            {isCreatingTrip ? 'Creating...' : 'Create'}
          </button>
          <button
            onClick={() => { setShowNameInput(false); setTripName(''); }}
            className="text-[10px] px-1.5 py-1 rounded transition-all"
            style={{ color: INK['40'] }}
            disabled={isCreatingTrip}
          >
            ✕
          </button>
        </div>
      )}

      {/* Reservation rows */}
      {group.reservations.map((r, idx) => (
        <ReservationRow
          key={r.id}
          reservation={r}
          isSelected={selectedIds.has(r.id)}
          onToggle={() => onToggleSelect(r.id)}
          isLast={idx === group.reservations.length - 1}
        />
      ))}
    </div>
  );
});

TripGroup.displayName = 'TripGroup';

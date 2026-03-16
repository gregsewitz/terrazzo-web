'use client';

import React, { useState, useRef, useEffect } from 'react';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT } from '@/constants/theme';
import { ReservationRow } from './ReservationRow';
import type { TripGroupData } from '@/lib/email-reservations-helpers';
import type { TripOption } from '@/hooks/useEmailReservations';

// ─── Component ──────────────────────────────────────────────────────────────

type UnmatchedMode = 'idle' | 'pick' | 'create';

interface TripGroupProps {
  group: TripGroupData;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  isLinked: boolean;
  onToggleTripLink: () => void;
  onCreateTrip?: (name: string, reservationIds: string[]) => Promise<string | null>;
  onAddToExistingTrip?: (tripId: string, tripName: string, reservationIds: string[]) => void;
  isCreatingTrip?: boolean;
  existingTrips?: TripOption[];
}

export const TripGroup = React.memo(function TripGroup({
  group,
  selectedIds,
  onToggleSelect,
  isLinked,
  onToggleTripLink,
  onCreateTrip,
  onAddToExistingTrip,
  isCreatingTrip,
  existingTrips = [],
}: TripGroupProps) {
  const isMatched = group.tripId !== null;
  const placeCount = group.reservations.length;

  // Unmatched group interaction state
  const [mode, setMode] = useState<UnmatchedMode>('idle');
  const [tripName, setTripName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when entering create mode
  useEffect(() => {
    if (mode === 'create' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [mode]);

  // Derive a suggested name from locations
  const suggestedName = React.useMemo(() => {
    const locations = [...new Set(group.reservations.map(r => r.location).filter(Boolean))];
    if (locations.length === 1) return locations[0]!;
    if (locations.length > 1) return locations.slice(0, 2).join(' & ');
    return '';
  }, [group.reservations]);

  const reservationIds = React.useMemo(
    () => group.reservations.map(r => r.id),
    [group.reservations]
  );

  const handleCreateTrip = async () => {
    const name = tripName.trim() || suggestedName || 'New Trip';
    if (!onCreateTrip) return;
    const tripId = await onCreateTrip(name, reservationIds);
    if (tripId) {
      setMode('idle');
      setTripName('');
    }
  };

  const handlePickTrip = (trip: TripOption) => {
    if (!onAddToExistingTrip) return;
    onAddToExistingTrip(trip.id, trip.name, reservationIds);
    setMode('idle');
  };

  // ── Smart trip matching: score & sort trips by location relevance ──

  /** Normalize a location string for fuzzy matching */
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

  /** Extract individual location tokens (city names, regions, etc.) */
  const tokenize = (s: string) =>
    normalize(s)
      .split(/[\s,&·—–-]+/)
      .filter(t => t.length > 2); // skip "uk", "us" etc. (too ambiguous short)

  const availableTrips = React.useMemo(() => {
    const filtered = existingTrips.filter(t =>
      !group.reservations.some(r => r.matchedTripId === t.id)
    );

    // Collect all location tokens from the unmatched reservations
    const reservationLocations = group.reservations
      .map(r => r.location)
      .filter(Boolean) as string[];
    const reservationTokens = reservationLocations.flatMap(tokenize);
    const reservationNorms = reservationLocations.map(normalize);

    if (reservationTokens.length === 0) return filtered.map(t => ({ ...t, score: 0 }));

    // Score each trip based on location overlap
    return filtered
      .map(trip => {
        let score = 0;
        const tripNorm = normalize(trip.location || '');
        const tripTokens = tokenize(trip.location || '');

        // Full location substring match (strongest signal)
        for (const resNorm of reservationNorms) {
          if (tripNorm.includes(resNorm) || resNorm.includes(tripNorm)) {
            score += 10;
          }
        }

        // Token overlap (city/region name matching)
        for (const rToken of reservationTokens) {
          for (const tToken of tripTokens) {
            if (rToken === tToken) score += 5;
            else if (rToken.includes(tToken) || tToken.includes(rToken)) score += 2;
          }
        }

        // Date proximity bonus — if trip overlaps reservation dates, it's likely relevant
        if (trip.startDate) {
          const tripStart = new Date(trip.startDate).getTime();
          const resDates = group.reservations
            .map(r => r.reservationDate || r.checkInDate)
            .filter(Boolean)
            .map(d => new Date(d!).getTime());
          for (const rd of resDates) {
            const daysDiff = Math.abs(rd - tripStart) / (1000 * 60 * 60 * 24);
            if (daysDiff < 14) score += 3; // within 2 weeks
            else if (daysDiff < 60) score += 1; // within 2 months
          }
        }

        return { ...trip, score };
      })
      .sort((a, b) => b.score - a.score);
  }, [existingTrips, group.reservations]);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
      {/* Group header */}
      <div className="flex items-center gap-2.5 px-3 py-3" style={{ borderBottom: '1px solid var(--t-linen)' }}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: isMatched ? 'rgba(58,128,136,0.06)' : INK['06'] }}
        >
          <PerriandIcon
            name={isMatched ? 'trips' : 'discover'}
            size={14}
            color={isMatched ? 'var(--t-dark-teal)' : INK['50']}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold" style={{ color: TEXT.primary, fontFamily: FONT.serif }}>
            {group.tripName}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {group.dateRange && (
              <span className="text-[9px]" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
                {group.dateRange}
              </span>
            )}
            <span className="text-[9px]" style={{ color: TEXT.secondary }}>
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
            background: isLinked ? 'rgba(58,128,136,0.04)' : INK['04'],
            borderBottom: '1px solid var(--t-linen)',
          }}
        >
          {/* Mini checkbox */}
          <div
            className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
            style={{
              background: isLinked ? 'var(--t-dark-teal)' : 'white',
              border: isLinked ? 'none' : `1.5px solid ${INK['20']}`,
            }}
          >
            {isLinked && (
              <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </div>
          <PerriandIcon name="trips" size={12} color={isLinked ? 'var(--t-dark-teal)' : INK['30']} />
          <span
            className="text-[10px]"
            style={{
              color: isLinked ? TEXT.primary : TEXT.secondary,
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

      {/* ── Unmatched group: trip assignment ── */}
      {!isMatched && mode === 'idle' && (
        <div
          className="flex items-center gap-2 px-3 py-2.5"
          style={{ background: 'rgba(238,113,109,0.04)', borderBottom: '1px solid var(--t-linen)' }}
        >
          <PerriandIcon name="trips" size={12} color="var(--t-honey)" />
          <span className="text-[10px]" style={{ color: TEXT.secondary }}>Add to a trip?</span>
          <div className="flex-1" />
          {availableTrips.length > 0 && (
            <button
              onClick={() => setMode('pick')}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-md border-none cursor-pointer transition-all"
              style={{ background: INK['06'], color: TEXT.primary }}
            >
              Existing trip
            </button>
          )}
          <button
            onClick={() => setMode('create')}
            className="text-[10px] font-semibold px-2.5 py-1 rounded-md border-none cursor-pointer transition-all"
            style={{ background: 'var(--t-honey)', color: 'white' }}
          >
            New trip
          </button>
        </div>
      )}

      {/* ── Pick an existing trip ── */}
      {!isMatched && mode === 'pick' && (
        <div style={{ background: 'rgba(238,113,109,0.04)', borderBottom: '1px solid var(--t-linen)' }}>
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
            <span className="text-[10px] font-medium" style={{ color: TEXT.secondary }}>
              Choose a trip
            </span>
            <button
              onClick={() => setMode('idle')}
              className="text-[10px] bg-transparent border-none cursor-pointer"
              style={{ color: TEXT.secondary }}
            >
              Cancel
            </button>
          </div>
          <div className="max-h-[180px] overflow-y-auto px-1.5 pb-2" style={{ scrollbarWidth: 'thin' }}>
            {availableTrips.map((trip, idx) => {
              const isRecommended = trip.score >= 5;
              const isFirstNonRecommended = !isRecommended && idx > 0 && availableTrips[idx - 1].score >= 5;
              return (
                <React.Fragment key={trip.id}>
                  {isFirstNonRecommended && (
                    <div className="mx-2 my-1.5" style={{ borderTop: `1px solid ${INK['08']}` }} />
                  )}
                  <button
                    onClick={() => handlePickTrip(trip)}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left border-none cursor-pointer transition-all"
                    style={{
                      background: isRecommended ? 'rgba(58,128,136,0.05)' : 'transparent',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = isRecommended ? 'rgba(58,128,136,0.10)' : 'rgba(58,128,136,0.06)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = isRecommended ? 'rgba(58,128,136,0.05)' : 'transparent'; }}
                  >
                    <PerriandIcon name="trips" size={12} color={isRecommended ? 'var(--t-dark-teal)' : INK['40']} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium truncate" style={{ color: TEXT.primary }}>
                          {trip.name}
                        </span>
                        {isRecommended && (
                          <span
                            className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{
                              background: 'rgba(58,128,136,0.10)',
                              color: 'var(--t-dark-teal)',
                              fontFamily: FONT.mono,
                              letterSpacing: '0.03em',
                            }}
                          >
                            Suggested
                          </span>
                        )}
                      </div>
                      {trip.location && (
                        <div className="text-[9px] truncate" style={{ color: isRecommended ? 'var(--t-dark-teal)' : TEXT.secondary, opacity: isRecommended ? 0.7 : 1 }}>
                          {trip.location}
                        </div>
                      )}
                    </div>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Create a new trip ── */}
      {!isMatched && mode === 'create' && (
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ background: 'rgba(238,113,109,0.04)', borderBottom: '1px solid var(--t-linen)' }}
        >
          <PerriandIcon name="trips" size={12} color="var(--t-honey)" />
          <input
            ref={inputRef}
            type="text"
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleCreateTrip(); }
              if (e.key === 'Escape') { setMode('idle'); setTripName(''); }
            }}
            placeholder={suggestedName ? `e.g. ${suggestedName}` : 'Trip name'}
            className="flex-1 text-[11px] bg-transparent outline-none placeholder:text-[#b8a070]"
            style={{ color: TEXT.primary, fontFamily: FONT.sans }}
            disabled={isCreatingTrip}
          />
          <button
            onClick={handleCreateTrip}
            disabled={isCreatingTrip}
            className="text-[10px] font-semibold px-2.5 py-1 rounded-md border-none cursor-pointer transition-all"
            style={{
              background: isCreatingTrip ? INK['10'] : 'var(--t-honey)',
              color: 'white',
              opacity: isCreatingTrip ? 0.6 : 1,
            }}
          >
            {isCreatingTrip ? 'Creating…' : 'Create'}
          </button>
          <button
            onClick={() => { setMode('idle'); setTripName(''); }}
            className="text-[10px] px-1.5 py-1 rounded bg-transparent border-none cursor-pointer transition-all"
            style={{ color: TEXT.secondary }}
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

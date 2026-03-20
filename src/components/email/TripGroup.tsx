'use client';

import React, { useState, useRef, useEffect } from 'react';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT } from '@/constants/theme';
import { ReservationRow } from './ReservationRow';
import type { TripGroupData, StagedReservation } from '@/lib/email-reservations-helpers';
import type { TripOption } from '@/hooks/useEmailReservations';

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Normalize a location string for fuzzy matching */
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

/** Extract individual location tokens (city names, regions, etc.) */
const tokenize = (s: string) =>
  normalize(s)
    .split(/[\s,&·—–-]+/)
    .filter(t => t.length > 2);

type ScoredTrip = TripOption & { score: number; hasLocationMatch: boolean };

/** Score trips against a single reservation's location + dates */
function scoreTripForReservation(
  trips: TripOption[],
  reservation: StagedReservation,
): ScoredTrip[] {
  const resLocation = reservation.location || '';
  const resTokens = tokenize(resLocation);
  const resNorm = normalize(resLocation);

  return trips
    .map(trip => {
      let score = 0;
      let hasLocationMatch = false;
      const tripNorm = normalize(trip.location || '');
      const tripTokens = tokenize(trip.location || '');
      const tripNameTokens = tokenize(trip.name || '');

      // Full location substring match (strongest signal)
      if (tripNorm && resNorm && (tripNorm.includes(resNorm) || resNorm.includes(tripNorm))) {
        score += 10;
        hasLocationMatch = true;
      }

      // Token overlap — check trip location AND trip name
      const allTripTokens = [...tripTokens, ...tripNameTokens];
      for (const rToken of resTokens) {
        for (const tToken of allTripTokens) {
          if (rToken === tToken) { score += 5; hasLocationMatch = true; }
          else if (rToken.length > 3 && tToken.length > 3 && (rToken.includes(tToken) || tToken.includes(rToken))) {
            score += 2;
            hasLocationMatch = true;
          }
        }
      }

      // Date proximity bonus
      if (trip.startDate) {
        const tripStart = new Date(trip.startDate).getTime();
        const tripEnd = trip.endDate ? new Date(trip.endDate).getTime() : tripStart + 7 * 86400000;
        const resDate = reservation.reservationDate || reservation.checkInDate;
        if (resDate) {
          const rd = new Date(resDate).getTime();
          if (rd >= tripStart && rd <= tripEnd) { score += 4; }
          else {
            const daysDiff = Math.abs(rd - tripStart) / 86400000;
            if (daysDiff < 14) score += 2;
            else if (daysDiff < 60) score += 1;
          }
        }
      }

      return { ...trip, score, hasLocationMatch };
    })
    .sort((a, b) => b.score - a.score);
}

// ─── Inline Trip Picker ──────────────────────────────────────────────────

interface InlineTripPickerProps {
  trips: ScoredTrip[];
  onPick: (trip: TripOption) => void;
  onCancel: () => void;
}

function InlineTripPicker({ trips, onPick, onCancel }: InlineTripPickerProps) {
  return (
    <div
      style={{
        background: 'rgba(58,128,136,0.03)',
        borderBottom: '1px solid var(--t-linen)',
      }}
    >
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <span className="text-[9px] font-medium" style={{ color: TEXT.secondary }}>
          Assign to trip
        </span>
        <button
          onClick={onCancel}
          className="text-[9px] bg-transparent border-none cursor-pointer"
          style={{ color: TEXT.secondary }}
        >
          Cancel
        </button>
      </div>
      <div className="max-h-[160px] overflow-y-auto px-1.5 pb-1.5" style={{ scrollbarWidth: 'thin' }}>
        {trips.map((trip, idx) => {
          const isRecommended = trip.score >= 5 && trip.hasLocationMatch;
          const isFirstNonRecommended = !isRecommended && idx > 0 && trips[idx - 1].score >= 5 && trips[idx - 1].hasLocationMatch;
          return (
            <React.Fragment key={trip.id}>
              {isFirstNonRecommended && (
                <div className="mx-2 my-1" style={{ borderTop: `1px solid ${INK['08']}` }} />
              )}
              <button
                onClick={() => onPick(trip)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left border-none cursor-pointer transition-all"
                style={{ background: isRecommended ? 'rgba(58,128,136,0.05)' : 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = isRecommended ? 'rgba(58,128,136,0.10)' : 'rgba(58,128,136,0.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = isRecommended ? 'rgba(58,128,136,0.05)' : 'transparent'; }}
              >
                <PerriandIcon name="trips" size={11} color={isRecommended ? 'var(--t-dark-teal)' : INK['40']} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-medium truncate" style={{ color: TEXT.primary }}>
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
                    <div className="text-[8px] truncate" style={{ color: isRecommended ? 'var(--t-dark-teal)' : TEXT.secondary, opacity: isRecommended ? 0.7 : 1 }}>
                      {trip.location}
                    </div>
                  )}
                </div>
              </button>
            </React.Fragment>
          );
        })}
        {trips.length === 0 && (
          <div className="px-3 py-2 text-[9px]" style={{ color: TEXT.secondary }}>
            No trips available
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

type UnmatchedMode = 'idle' | 'pick-all' | 'create';

interface TripGroupProps {
  group: TripGroupData;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  isLinked: boolean;
  onToggleTripLink: () => void;
  onCreateTrip?: (name: string, reservationIds: string[]) => Promise<string | null>;
  onAddToExistingTrip?: (tripId: string, tripName: string, reservationIds: string[]) => void;
  onRemoveTripAssignment?: (reservationIds: string[]) => void;
  isCreatingTrip?: boolean;
  existingTrips?: TripOption[];
  /** Whether this group was manually assigned to a trip (vs. auto-matched from email parse) */
  isManuallyAssigned?: boolean;
  /** Per-reservation trip assignments: reservationId → { tripId, tripName } */
  perReservationTrips?: Map<string, { tripId: string; tripName: string }>;
  /** Assign a single reservation to a trip */
  onAssignReservationToTrip?: (reservationId: string, tripId: string, tripName: string) => void;
  /** Remove a single reservation's trip assignment */
  onRemoveReservationTrip?: (reservationId: string) => void;
}

export const TripGroup = React.memo(function TripGroup({
  group,
  selectedIds,
  onToggleSelect,
  isLinked,
  onToggleTripLink,
  onCreateTrip,
  onAddToExistingTrip,
  onRemoveTripAssignment,
  isCreatingTrip,
  existingTrips = [],
  isManuallyAssigned = false,
  perReservationTrips = new Map(),
  onAssignReservationToTrip,
  onRemoveReservationTrip,
}: TripGroupProps) {
  const isMatched = group.tripId !== null;
  const placeCount = group.reservations.length;

  // Group-level interaction state (for "add all" and "create new trip")
  const [mode, setMode] = useState<UnmatchedMode>('idle');
  const [tripName, setTripName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Per-reservation trip picker — which reservation's picker is open
  const [activePickerResId, setActivePickerResId] = useState<string | null>(null);

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

  // Check if every reservation in this group has a per-reservation trip assignment
  const allAssigned = React.useMemo(
    () => group.reservations.length > 0 && group.reservations.every(r => perReservationTrips.has(r.id)),
    [group.reservations, perReservationTrips]
  );
  const someAssigned = React.useMemo(
    () => group.reservations.some(r => perReservationTrips.has(r.id)),
    [group.reservations, perReservationTrips]
  );

  const handleCreateTrip = async () => {
    const name = tripName.trim() || suggestedName || 'New Trip';
    if (!onCreateTrip) return;
    // Only include unassigned reservations
    const unassignedIds = reservationIds.filter(id => !perReservationTrips.has(id));
    const tripId = await onCreateTrip(name, unassignedIds.length > 0 ? unassignedIds : reservationIds);
    if (tripId) {
      setMode('idle');
      setTripName('');
    }
  };

  const handlePickTripForAll = (trip: TripOption) => {
    if (!onAddToExistingTrip) return;
    // Only include unassigned reservations
    const unassignedIds = reservationIds.filter(id => !perReservationTrips.has(id));
    onAddToExistingTrip(trip.id, trip.name, unassignedIds.length > 0 ? unassignedIds : reservationIds);
    setMode('idle');
  };

  const handlePickTripForReservation = (trip: TripOption) => {
    if (!onAssignReservationToTrip || !activePickerResId) return;
    onAssignReservationToTrip(activePickerResId, trip.id, trip.name);
    setActivePickerResId(null);
  };

  // ── Score trips for the group-level picker (uses all reservation locations) ──

  const groupScoredTrips = React.useMemo(() => {
    const filtered = existingTrips.filter(t =>
      !group.reservations.some(r => r.matchedTripId === t.id)
    );

    const reservationLocations = group.reservations
      .map(r => r.location)
      .filter(Boolean) as string[];
    const reservationTokens = reservationLocations.flatMap(tokenize);
    const reservationNorms = reservationLocations.map(normalize);

    if (reservationTokens.length === 0) return filtered.map(t => ({ ...t, score: 0, hasLocationMatch: false }));

    return filtered
      .map(trip => {
        let score = 0;
        let hasLocationMatch = false;
        const tripNorm = normalize(trip.location || '');
        const tripTokens = tokenize(trip.location || '');
        const tripNameTokens = tokenize(trip.name || '');

        for (const resNorm of reservationNorms) {
          if (tripNorm && resNorm && (tripNorm.includes(resNorm) || resNorm.includes(tripNorm))) {
            score += 10;
            hasLocationMatch = true;
          }
        }

        const allTripTokens = [...tripTokens, ...tripNameTokens];
        for (const rToken of reservationTokens) {
          for (const tToken of allTripTokens) {
            if (rToken === tToken) { score += 5; hasLocationMatch = true; }
            else if (rToken.length > 3 && tToken.length > 3 && (rToken.includes(tToken) || tToken.includes(rToken))) {
              score += 2;
              hasLocationMatch = true;
            }
          }
        }

        if (trip.startDate) {
          const tripStart = new Date(trip.startDate).getTime();
          const tripEnd = trip.endDate ? new Date(trip.endDate).getTime() : tripStart + 7 * 86400000;
          const resDates = group.reservations
            .map(r => r.reservationDate || r.checkInDate)
            .filter(Boolean)
            .map(d => new Date(d!).getTime());
          for (const rd of resDates) {
            if (rd >= tripStart && rd <= tripEnd) { score += 4; }
            else {
              const daysDiff = Math.abs(rd - tripStart) / 86400000;
              if (daysDiff < 14) score += 2;
              else if (daysDiff < 60) score += 1;
            }
          }
        }

        return { ...trip, score, hasLocationMatch };
      })
      .sort((a, b) => b.score - a.score);
  }, [existingTrips, group.reservations]);

  // ── Score trips for the active per-reservation picker ──

  const perResScoredTrips = React.useMemo(() => {
    if (!activePickerResId) return [];
    const reservation = group.reservations.find(r => r.id === activePickerResId);
    if (!reservation) return [];

    const filtered = existingTrips.filter(t =>
      !group.reservations.some(r => r.matchedTripId === t.id)
    );
    return scoreTripForReservation(filtered, reservation);
  }, [activePickerResId, existingTrips, group.reservations]);

  // Count how many unassigned reservations remain
  const unassignedCount = React.useMemo(
    () => group.reservations.filter(r => !perReservationTrips.has(r.id)).length,
    [group.reservations, perReservationTrips]
  );

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
          className="flex items-center gap-2.5 px-3 py-2.5 transition-all"
          style={{
            background: isLinked ? 'rgba(58,128,136,0.04)' : INK['04'],
            borderBottom: '1px solid var(--t-linen)',
          }}
        >
        <div
          onClick={onToggleTripLink}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleTripLink(); }
          }}
          className="flex items-center gap-2.5 flex-1 cursor-pointer"
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
          {isManuallyAssigned && onRemoveTripAssignment && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveTripAssignment(reservationIds);
              }}
              className="text-[9px] px-2 py-0.5 rounded border-none cursor-pointer flex-shrink-0"
              style={{ background: INK['06'], color: TEXT.secondary }}
            >
              Change
            </button>
          )}
        </div>
      )}

      {/* ── Unmatched group: bulk trip assignment bar ── */}
      {!isMatched && mode === 'idle' && (
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ background: 'rgba(238,113,109,0.04)', borderBottom: '1px solid var(--t-linen)' }}
        >
          <PerriandIcon name="trips" size={12} color="var(--t-honey)" />
          <span className="text-[10px]" style={{ color: TEXT.secondary }}>
            {someAssigned && !allAssigned
              ? `${unassignedCount} unassigned — add remaining to a trip?`
              : allAssigned
                ? 'All places assigned to trips'
                : 'Use the Trip button on each place, or add all:'}
          </span>
          <div className="flex-1" />
          {!allAssigned && (
            <>
              {groupScoredTrips.length > 0 && (
                <button
                  onClick={() => setMode('pick-all')}
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
            </>
          )}
        </div>
      )}

      {/* ── Pick an existing trip for all unassigned ── */}
      {!isMatched && mode === 'pick-all' && (
        <div style={{ background: 'rgba(238,113,109,0.04)', borderBottom: '1px solid var(--t-linen)' }}>
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
            <span className="text-[10px] font-medium" style={{ color: TEXT.secondary }}>
              Add {unassignedCount > 0 ? `${unassignedCount} places` : 'all'} to:
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
            {groupScoredTrips.map((trip, idx) => {
              const isRecommended = trip.score >= 5 && trip.hasLocationMatch;
              const isFirstNonRecommended = !isRecommended && idx > 0 && groupScoredTrips[idx - 1].score >= 5 && groupScoredTrips[idx - 1].hasLocationMatch;
              return (
                <React.Fragment key={trip.id}>
                  {isFirstNonRecommended && (
                    <div className="mx-2 my-1.5" style={{ borderTop: `1px solid ${INK['08']}` }} />
                  )}
                  <button
                    onClick={() => handlePickTripForAll(trip)}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left border-none cursor-pointer transition-all"
                    style={{ background: isRecommended ? 'rgba(58,128,136,0.05)' : 'transparent' }}
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

      {/* Reservation rows — with per-reservation trip assignment for unmatched groups */}
      {group.reservations.map((r, idx) => {
        const assignment = perReservationTrips.get(r.id);
        const isUnmatched = !isMatched;

        return (
          <React.Fragment key={r.id}>
            <ReservationRow
              reservation={r}
              isSelected={selectedIds.has(r.id)}
              onToggle={() => onToggleSelect(r.id)}
              isLast={idx === group.reservations.length - 1 && activePickerResId !== r.id}
              // Per-reservation trip assignment (only for unmatched groups)
              assignedTripName={isUnmatched ? assignment?.tripName : undefined}
              onTripPillClick={isUnmatched && onAssignReservationToTrip ? () => {
                setActivePickerResId(prev => prev === r.id ? null : r.id);
              } : undefined}
              onRemoveTripAssignment={isUnmatched && assignment && onRemoveReservationTrip ? () => {
                onRemoveReservationTrip(r.id);
              } : undefined}
            />
            {/* Inline trip picker — appears below the active row */}
            {activePickerResId === r.id && (
              <InlineTripPicker
                trips={perResScoredTrips}
                onPick={handlePickTripForReservation}
                onCancel={() => setActivePickerResId(null)}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
});

TripGroup.displayName = 'TripGroup';

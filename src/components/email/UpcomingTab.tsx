'use client';

import React from 'react';
import { INK, TEXT } from '@/constants/theme';
import { TripGroup } from './TripGroup';
import type { TripGroupData } from '@/lib/email-reservations-helpers';
import type { TripOption, CollectionOption } from '@/hooks/useEmailReservations';

// ─── Component ──────────────────────────────────────────────────────────────

interface UpcomingTabProps {
  tripGroups: TripGroupData[];
  selectedIds: Set<string>;
  tripLinkEnabled: Map<string, boolean>;
  selectedCount: number;
  totalCount: number;
  onToggleSelect: (id: string) => void;
  onToggleTripLink: (tripId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onCreateTrip?: (name: string, reservationIds: string[]) => Promise<string | null>;
  onAddToExistingTrip?: (tripId: string, tripName: string, reservationIds: string[]) => void;
  onRemoveTripAssignment?: (reservationIds: string[]) => void;
  createdTrips?: Array<{ tripId: string; tripName: string; reservationIds: string[] }>;
  isCreatingTrip?: boolean;
  existingTrips?: TripOption[];
  /** Per-reservation trip assignments */
  perReservationTrips?: Map<string, { tripId: string; tripName: string }>;
  onAssignReservationToTrip?: (reservationId: string, tripId: string, tripName: string) => void;
  onRemoveReservationTrip?: (reservationId: string) => void;
  /** Per-reservation collection assignments */
  collections?: CollectionOption[];
  perReservationCollections?: Map<string, { collectionId: string; collectionName: string }>;
  onAssignReservationToCollection?: (reservationId: string, collectionId: string, collectionName: string) => void;
  onRemoveReservationCollection?: (reservationId: string) => void;
}

export const UpcomingTab = React.memo(function UpcomingTab({
  tripGroups,
  selectedIds,
  tripLinkEnabled,
  selectedCount,
  totalCount,
  onToggleSelect,
  onToggleTripLink,
  onSelectAll,
  onDeselectAll,
  onCreateTrip,
  onAddToExistingTrip,
  onRemoveTripAssignment,
  createdTrips = [],
  isCreatingTrip,
  existingTrips = [],
  perReservationTrips = new Map(),
  onAssignReservationToTrip,
  onRemoveReservationTrip,
  collections = [],
  perReservationCollections = new Map(),
  onAssignReservationToCollection,
  onRemoveReservationCollection,
}: UpcomingTabProps) {
  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[13px]" style={{ color: TEXT.secondary }}>
          No upcoming reservations found
        </p>
        <p className="text-[11px] mt-1" style={{ color: TEXT.secondary }}>
          Future bookings from your email will appear here
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Bulk controls */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px]" style={{ color: TEXT.secondary }}>
          {selectedCount} of {totalCount} selected
        </span>
        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            className="text-[10px] font-semibold bg-transparent border-none cursor-pointer"
            style={{ color: 'var(--t-dark-teal)' }}
          >
            Select all
          </button>
          <button
            onClick={onDeselectAll}
            className="text-[10px] font-semibold bg-transparent border-none cursor-pointer"
            style={{ color: TEXT.secondary }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Trip groups */}
      <div className="flex flex-col gap-4">
        {tripGroups.map((group) => (
          <TripGroup
            key={group.tripId || 'unmatched'}
            group={group}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            isLinked={group.tripId ? (tripLinkEnabled.get(group.tripId) ?? true) : false}
            onToggleTripLink={() => group.tripId && onToggleTripLink(group.tripId)}
            onCreateTrip={onCreateTrip}
            onAddToExistingTrip={onAddToExistingTrip}
            onRemoveTripAssignment={onRemoveTripAssignment}
            isManuallyAssigned={!!createdTrips.find(ct => group.reservations.some(r => ct.reservationIds.includes(r.id)))}
            isCreatingTrip={isCreatingTrip}
            existingTrips={existingTrips}
            perReservationTrips={perReservationTrips}
            onAssignReservationToTrip={onAssignReservationToTrip}
            onRemoveReservationTrip={onRemoveReservationTrip}
            collections={collections}
            perReservationCollections={perReservationCollections}
            onAssignReservationToCollection={onAssignReservationToCollection}
            onRemoveReservationCollection={onRemoveReservationCollection}
          />
        ))}
      </div>
    </div>
  );
});

UpcomingTab.displayName = 'UpcomingTab';

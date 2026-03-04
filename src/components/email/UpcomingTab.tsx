'use client';

import React from 'react';
import { INK } from '@/constants/theme';
import { TripGroup } from './TripGroup';
import type { TripGroupData } from '@/lib/email-reservations-helpers';

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
  isCreatingTrip?: boolean;
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
  isCreatingTrip,
}: UpcomingTabProps) {
  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[13px]" style={{ color: INK['50'] }}>
          No upcoming reservations found
        </p>
        <p className="text-[11px] mt-1" style={{ color: INK['30'] }}>
          Future bookings from your email will appear here
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Bulk controls */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px]" style={{ color: INK['50'] }}>
          {selectedCount} of {totalCount} selected
        </span>
        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            className="text-[10px] font-semibold bg-transparent border-none cursor-pointer"
            style={{ color: 'var(--t-verde)' }}
          >
            Select all
          </button>
          <button
            onClick={onDeselectAll}
            className="text-[10px] font-semibold bg-transparent border-none cursor-pointer"
            style={{ color: INK['50'] }}
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
            isCreatingTrip={isCreatingTrip}
          />
        ))}
      </div>
    </div>
  );
});

UpcomingTab.displayName = 'UpcomingTab';

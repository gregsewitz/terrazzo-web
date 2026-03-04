'use client';

import React from 'react';
import { INK } from '@/constants/theme';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { YearGroup } from './YearGroup';
import { TYPE_FILTER_OPTIONS } from '@/lib/email-reservations-helpers';
import type { YearGroupData } from '@/lib/email-reservations-helpers';
import type { ReactionId } from '@/types';

// ─── Component ──────────────────────────────────────────────────────────────

interface HistoryTabProps {
  yearGroups: YearGroupData[];
  selectedIds: Set<string>;
  ratings: Map<string, ReactionId>;
  typeFilter: string;
  selectedCount: number;
  /** Count of items visible after filtering */
  totalCount: number;
  /** Total history items before any type filter — used to distinguish "no history" from "filter empty" */
  unfilteredCount: number;
  onToggleSelect: (id: string) => void;
  onRate: (reservationId: string, reactionId: ReactionId) => void;
  onTypeFilterChange: (filter: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export const HistoryTab = React.memo(function HistoryTab({
  yearGroups,
  selectedIds,
  ratings,
  typeFilter,
  selectedCount,
  totalCount,
  unfilteredCount,
  onToggleSelect,
  onRate,
  onTypeFilterChange,
  onSelectAll,
  onDeselectAll,
}: HistoryTabProps) {
  // Truly no history at all
  if (unfilteredCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <PerriandIcon name="discover" size={32} color={INK['20']} />
        <p className="text-[13px] mt-3" style={{ color: INK['50'] }}>
          No past reservations found
        </p>
        <p className="text-[11px] mt-1" style={{ color: INK['30'] }}>
          Historical bookings from your email will appear here
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter chips — always visible when there's history data */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        {TYPE_FILTER_OPTIONS.map(({ value, label }) => {
          const isActive = typeFilter === value;
          return (
            <button
              key={value}
              onClick={() => onTypeFilterChange(value)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-medium border-none cursor-pointer transition-all whitespace-nowrap"
              style={{
                background: isActive ? 'var(--t-ink)' : INK['06'],
                color: isActive ? 'white' : INK['60'],
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Filter yielded no results */}
      {totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-[12px]" style={{ color: INK['40'] }}>
            No {TYPE_FILTER_OPTIONS.find(o => o.value === typeFilter)?.label?.toLowerCase() || 'results'} found
          </p>
          <button
            onClick={() => onTypeFilterChange('all')}
            className="text-[11px] font-semibold mt-2 bg-transparent border-none cursor-pointer"
            style={{ color: 'var(--t-verde)' }}
          >
            Show all
          </button>
        </div>
      ) : (
        <>
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

          {/* Year groups */}
          <div className="flex flex-col gap-5">
            {yearGroups.map((group) => (
              <YearGroup
                key={group.year}
                group={group}
                selectedIds={selectedIds}
                ratings={ratings}
                onToggleSelect={onToggleSelect}
                onRate={onRate}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
});

HistoryTab.displayName = 'HistoryTab';

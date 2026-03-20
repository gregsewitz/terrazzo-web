'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { usePoolStore, FilterType, SLOT_TYPE_AFFINITY } from '@/stores/poolStore';
import { useSavedStore } from '@/stores/savedStore';
import { ImportedPlace, PlaceType, SOURCE_STYLES, PerriandIconName, getSourceStyle, getSourceLabel } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT } from '@/constants/theme';
import FilterSortBar from '../ui/FilterSortBar';
import type { SortDirection } from '../ui/FilterSortBar';
import { sortPlaces, defaultDirectionFor } from '@/lib/sort-helpers';
import { getMatchTier, shouldShowTierBadge } from '@/lib/match-tier';

interface PoolTrayProps {
  onTapDetail: (item: ImportedPlace) => void;
  onCurateMore: () => void;
  onOpenExport?: () => void;
  onDragStart?: (item: ImportedPlace, e: React.PointerEvent) => void;
  dragItemId?: string | null;
}

type SourceFilterType = 'all' | 'friends' | 'google-maps' | 'url' | 'email' | 'manual' | 'text' | 'terrazzo' | 'file';

const SOURCE_FILTER_TABS: { value: SourceFilterType; label: string; icon?: PerriandIconName }[] = [
  { value: 'all', label: 'All' },
  { value: 'friends', label: 'Friends', icon: 'friend' },
  { value: 'google-maps', label: 'Maps', icon: 'maps' },
  { value: 'url', label: 'Articles', icon: 'article' },
  { value: 'email', label: 'Email', icon: 'email' },
  { value: 'manual', label: 'Added', icon: 'manual' },
];

const TYPE_FILTER_CHIPS: { value: FilterType; label: string; icon: PerriandIconName }[] = [
  { value: 'all', label: 'All types', icon: 'discover' },
  { value: 'restaurant', label: 'Restaurant', icon: 'restaurant' },
  { value: 'cafe', label: 'Cafe', icon: 'cafe' },
  { value: 'bar', label: 'Bar', icon: 'bar' },
  { value: 'museum', label: 'Museum', icon: 'museum' },
  { value: 'activity', label: 'Activity', icon: 'activity' },
  { value: 'hotel', label: 'Hotel', icon: 'hotel' },
  { value: 'neighborhood', label: 'Area', icon: 'neighborhood' },
  { value: 'shop', label: 'Shop', icon: 'shop' },
];

const HOLD_DELAY = 180; // ms before drag activates

function PoolTray({ onTapDetail, onCurateMore, onOpenExport, onDragStart, dragItemId }: PoolTrayProps) {
  const tripDestinations = useTripStore(s => {
    const trip = s.trips.find(t => t.id === s.currentTripId);
    return trip?.destinations || [trip?.location?.split(',')[0]?.trim()].filter(Boolean);
  });
  const { isExpanded, setExpanded, filterType, setFilterType, slotContext } = usePoolStore();
  const [sourceFilter, setSourceFilter] = useState<SourceFilterType>('all');
  const [sortBy, setSortBy] = useState<'match' | 'name' | 'source'>('match');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Library places geo-filtered to trip destinations
  const myPlaces = useSavedStore(s => s.myPlaces);
  const starredPlaces = useMemo(() => {
    if (!tripDestinations || tripDestinations.length === 0) return [];
    const destLower = (tripDestinations as string[]).map(d => d.toLowerCase());
    return myPlaces.filter(place => {
      return destLower.some(dest => place.location.toLowerCase().includes(dest));
    });
  }, [myPlaces, tripDestinations]);

  // Apply source filter
  const sourceFiltered = useMemo(() => {
    if (sourceFilter === 'all') return starredPlaces;
    return starredPlaces.filter(item => (item.source?.type || 'manual') === sourceFilter);
  }, [starredPlaces, sourceFilter]);

  // Apply type filter
  const typeFiltered = useMemo(() => {
    if (filterType === 'all') return sourceFiltered;
    return sourceFiltered.filter(item => item.type === filterType);
  }, [sourceFiltered, filterType]);

  // Smart sorting: if slot context exists, boost items matching suggested types
  const sortedItems = useMemo(() => {
    const sorted = sortPlaces(typeFiltered, sortBy, sortDirection);
    if (slotContext && slotContext.suggestedTypes.length > 0) {
      const suggestedSet = new Set(slotContext.suggestedTypes);
      return sorted.sort((a, b) => {
        const aMatch = suggestedSet.has(a.type) ? 1 : 0;
        const bMatch = suggestedSet.has(b.type) ? 1 : 0;
        // Only re-sort when one matches and the other doesn't
        return bMatch - aMatch;
      });
    }
    return sorted;
  }, [typeFiltered, slotContext, sortBy, sortDirection]);

  // Count items by type (for chip badges)
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    sourceFiltered.forEach(item => {
      counts[item.type] = (counts[item.type] || 0) + 1;
    });
    return counts;
  }, [sourceFiltered]);

  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    starredPlaces.forEach(item => {
      const src = item.source?.type || 'manual';
      counts[src] = (counts[src] || 0) + 1;
    });
    return counts;
  }, [starredPlaces]);

  // Hold-to-drag state
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdItem = useRef<ImportedPlace | null>(null);

  const handlePointerDown = useCallback((item: ImportedPlace, e: React.PointerEvent) => {
    if (!onDragStart) return;
    holdItem.current = item;
    const pointerEvent = e;
    holdTimer.current = setTimeout(() => {
      if (holdItem.current) {
        onDragStart(holdItem.current, pointerEvent);
        holdItem.current = null;
      }
    }, HOLD_DELAY);
  }, [onDragStart]);

  const handlePointerUp = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    holdItem.current = null;
  }, []);

  const handleTap = useCallback((item: ImportedPlace) => {
    // Only fire tap if not dragging
    if (!dragItemId) {
      onTapDetail(item);
    }
  }, [dragItemId, onTapDetail]);

  if (!isExpanded) {
    return (
      <div
        className="fixed left-0 right-0 z-40"
        style={{ bottom: 52, maxWidth: 480, margin: '0 auto' }}
      >
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center justify-between px-4 py-3 cursor-pointer transition-all"
          style={{
            background: 'white',
            border: 'none',
            borderTopWidth: '1px',
            borderTopStyle: 'solid',
            borderTopColor: 'var(--t-linen)',
            fontFamily: FONT.sans,
          }}
        >
          <div className="flex items-center gap-2">
            <span
              style={{
                fontFamily: FONT.serif,
                fontSize: '14px',
                fontWeight: 600,
                color: TEXT.primary,
              }}
            >
              Everywhere you want to go
            </span>
            <span
              className="inline-flex items-center justify-center rounded-full text-[10px] font-bold"
              style={{
                background: 'rgba(238,113,109,0.12)',
                color: TEXT.accent,
                padding: '2px 8px',
                fontFamily: FONT.mono,
              }}
            >
              {starredPlaces.length}
            </span>
            <span style={{ fontSize: '10px', color: TEXT.secondary }}>▲</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onCurateMore(); }}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-full border-2 cursor-pointer transition-colors hover:opacity-80"
            style={{
              background: 'transparent',
              color: TEXT.accent,
              borderColor: TEXT.accent,
              fontFamily: FONT.mono,
            }}
          >
            + Add more
          </button>
        </button>
      </div>
    );
  }

  // Expanded state
  return (
    <div
      className="fixed left-0 right-0 z-40"
      style={{
        bottom: 52,
        maxWidth: 480,
        margin: '0 auto',
        maxHeight: '88dvh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        className="flex flex-col overflow-hidden"
        style={{
          background: 'white',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.1)',
          maxHeight: '88dvh',
        }}
      >
        {/* Handle bar */}
        <div className="flex items-center justify-center pt-2 pb-1">
          <div style={{ width: 40, height: 4, background: 'var(--t-linen)', borderRadius: 2 }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2">
          <button
            onClick={() => setExpanded(false)}
            className="flex items-center gap-2 bg-transparent border-none cursor-pointer"
            style={{
              fontFamily: FONT.serif,
              fontSize: '18px',
              fontWeight: 600,
              color: TEXT.primary,
            }}
          >
            Everywhere you want to go
            <span style={{ fontSize: '10px', color: TEXT.secondary }}>▼</span>
          </button>
          <div className="flex items-center gap-2">
            {onOpenExport && starredPlaces.length > 0 && (
              <button
                onClick={onOpenExport}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-full border-2 cursor-pointer transition-colors hover:opacity-80 flex items-center gap-1"
                style={{
                  background: 'transparent',
                  color: TEXT.accent,
                  borderColor: TEXT.accent,
                  fontFamily: FONT.mono,
                }}
              >
                <PerriandIcon name="pin" size={12} color={TEXT.accent} />
                Export
              </button>
            )}
            <button
              onClick={onCurateMore}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-full border-2 cursor-pointer transition-colors hover:opacity-80"
              style={{
                background: 'transparent',
                color: TEXT.accent,
                borderColor: TEXT.accent,
                fontFamily: FONT.mono,
              }}
            >
              + Add more
            </button>
          </div>
        </div>

        {/* Slot Context Banner — shown when opened from a specific slot */}
        {slotContext && (
          <div
            className="mx-4 mb-2 px-3 py-2.5 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, rgba(58,128,136,0.06) 0%, rgba(58,128,136,0.02) 100%)',
              border: '1px solid rgba(58,128,136,0.15)',
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className="text-[12px] font-semibold"
                style={{ color: 'var(--t-dark-teal)', fontFamily: FONT.sans }}
              >
                Picking for {slotContext.slotLabel} · Day {slotContext.dayNumber}
              </span>
              <button
                onClick={() => usePoolStore.getState().setSlotContext(null)}
                className="text-[10px] px-2 py-0.5 rounded-full border-none cursor-pointer"
                style={{ background: INK['06'], color: TEXT.secondary }}
              >
                Clear
              </button>
            </div>
            {(slotContext.adjacentPlaces.before || slotContext.adjacentPlaces.after) && (
              <div className="text-[11px]" style={{ color: TEXT.secondary }}>
                {slotContext.adjacentPlaces.before && (
                  <span>After {slotContext.adjacentPlaces.before.name}</span>
                )}
                {slotContext.adjacentPlaces.before && slotContext.adjacentPlaces.after && ' · '}
                {slotContext.adjacentPlaces.after && (
                  <span>Before {slotContext.adjacentPlaces.after.name}</span>
                )}
              </div>
            )}
            {slotContext.suggestedTypes.length > 0 && (
              <div className="flex gap-1.5 mt-1.5">
                {slotContext.suggestedTypes.map(t => {
                  const chip = TYPE_FILTER_CHIPS.find(c => c.value === t);
                  return (
                    <button
                      key={t}
                      onClick={() => setFilterType(filterType === t ? 'all' : t as FilterType)}
                      className="text-[10px] px-2 py-0.5 rounded-full cursor-pointer transition-all flex items-center gap-1"
                      style={{
                        background: filterType === t ? 'var(--t-dark-teal)' : 'rgba(58,128,136,0.08)',
                        color: filterType === t ? 'white' : 'var(--t-dark-teal)',
                        border: 'none',
                        fontFamily: FONT.mono,
                        fontWeight: 600,
                      }}
                    >
                      {chip && <PerriandIcon name={chip.icon} size={11} color={filterType === t ? 'white' : 'var(--t-dark-teal)'} />}
                      {t}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Subtitle */}
        <div className="px-4 pb-2 text-xs" style={{ color: TEXT.secondary }}>
          {sortedItems.length} place{sortedItems.length !== 1 ? 's' : ''}
          {filterType !== 'all' && ` · ${filterType}`}
          {sourceFilter !== 'all' && ` · ${SOURCE_FILTER_TABS.find(t => t.value === sourceFilter)?.label}`}
          {' '}· hold &amp; drag to assign
        </div>

        {/* Filter & Sort */}
        <div className="px-4 pb-2" style={{ borderBottom: '1px solid var(--t-linen)' }}>
          <FilterSortBar
            filterGroups={[
              {
                key: 'type',
                label: 'Type',
                options: TYPE_FILTER_CHIPS.map(c => ({ value: c.value, label: c.label, icon: c.icon })),
                value: filterType,
                onChange: (v) => setFilterType(v as FilterType),
              },
              {
                key: 'source',
                label: 'Source',
                options: SOURCE_FILTER_TABS.filter(t => t.value === 'all' || (sourceCounts[t.value] || 0) > 0).map(t => ({ value: t.value, label: t.label, icon: t.icon })),
                value: sourceFilter,
                onChange: (v) => setSourceFilter(v as SourceFilterType),
              },
            ]}
            sortOptions={[
              { value: 'match', label: 'Match Tier' },
              { value: 'name', label: 'A–Z' },
              { value: 'source', label: 'Source' },
            ]}
            sortValue={sortBy}
            onSortChange={(v) => { setSortBy(v as 'match' | 'name' | 'source'); setSortDirection(defaultDirectionFor(v)); }}
            sortDirection={sortDirection}
            onSortDirectionChange={setSortDirection}
            onResetAll={() => { setFilterType('all'); setSourceFilter('all'); setSortBy('match'); setSortDirection('desc'); }}
          />
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: 'thin' }}>
          {sortedItems.map(item => {
            const sourceStyle = getSourceStyle(item);
            const note = item.source?.type === 'google-maps' ? item.savedAt : undefined;
            const isDragging = dragItemId === item.id;
            const isSuggestedType = slotContext?.suggestedTypes.includes(item.type);
            const typeChip = TYPE_FILTER_CHIPS.find(c => c.value === item.type);

            return (
              <div
                key={item.id}
                className="flex items-start rounded-lg mb-2.5 cursor-pointer transition-all select-none"
                style={{
                  background: isSuggestedType ? 'rgba(58,128,136,0.03)' : 'var(--t-cream)',
                  border: isSuggestedType ? '1.5px solid rgba(58,128,136,0.15)' : '1.5px solid var(--t-linen)',
                  borderLeft: '3px solid var(--t-dark-teal)',
                  opacity: isDragging ? 0.35 : 1,
                  transform: isDragging ? 'scale(0.97)' : 'none',
                  transition: 'opacity 0.2s, transform 0.2s',
                }}
                onPointerDown={(e) => handlePointerDown(item, e)}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClick={() => handleTap(item)}
              >
                {/* Drag grip */}
                <div
                  className="flex flex-col items-center justify-center px-1.5 self-stretch"
                  style={{
                    color: TEXT.secondary,
                    fontSize: '10px',
                    letterSpacing: '2px',
                    touchAction: 'none',
                    userSelect: 'none',
                  }}
                >
                  ⋮⋮
                </div>

                <div className="flex-1 min-w-0 py-3 pr-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="text-[13px] font-medium truncate" style={{ color: TEXT.primary }}>
                      {item.name}
                    </div>
                    {typeChip && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1"
                        style={{
                          background: isSuggestedType ? 'rgba(58,128,136,0.1)' : INK['05'],
                          color: isSuggestedType ? 'var(--t-dark-teal)' : INK['95'],
                          fontFamily: FONT.mono,
                          fontWeight: 600,
                        }}
                      >
                        <PerriandIcon name={typeChip.icon} size={11} color={isSuggestedType ? 'var(--t-dark-teal)' : INK['95']} />
                        {item.type}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] mb-1 flex items-center gap-1" style={{ color: TEXT.secondary }}>
                    <PerriandIcon name={sourceStyle.icon} size={12} color={TEXT.secondary} />
                    {item.source?.name || sourceStyle.label}
                  </div>
                  {note && (
                    <div className="text-[11px] italic" style={{ color: TEXT.secondary }}>
                      {note}
                    </div>
                  )}
                </div>

                {/* Match score */}
                <div className="flex items-center gap-2 flex-shrink-0 pr-3 pt-3">
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: 'rgba(58,128,136,0.08)',
                      color: 'var(--t-dark-teal)',
                      fontFamily: FONT.mono,
                    }}
                  >
                    {getMatchTier(item.matchScore).shortLabel}
                  </span>
                </div>
              </div>
            );
          })}

          {sortedItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center" style={{ color: TEXT.secondary }}>
              <div className="text-2xl mb-3 flex justify-center">
                <PerriandIcon name="star" size={28} color={TEXT.secondary} />
              </div>
              <p className="text-[12px] mb-1" style={{ fontFamily: FONT.sans, color: TEXT.primary }}>
                {filterType !== 'all'
                  ? `No ${filterType} places starred`
                  : sourceFilter !== 'all'
                    ? 'No starred places from this source'
                    : 'No starred places yet'}
              </p>
              <p className="text-[11px]" style={{ color: TEXT.secondary }}>
                {filterType !== 'all'
                  ? <button onClick={() => setFilterType('all')} className="underline cursor-pointer bg-transparent border-none" style={{ color: 'var(--t-dark-teal)', fontSize: '11px' }}>Show all types</button>
                  : 'Star places in My Places or Collect to add them here'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(PoolTray);

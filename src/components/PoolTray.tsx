'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { usePoolStore, FilterType, SLOT_TYPE_AFFINITY } from '@/stores/poolStore';
import { useSavedStore } from '@/stores/savedStore';
import { ImportedPlace, PlaceType, GhostSourceType, SOURCE_STYLES } from '@/types';

interface PoolTrayProps {
  onTapDetail: (item: ImportedPlace) => void;
  onCurateMore: () => void;
  onOpenExport?: () => void;
  onDragStart?: (item: ImportedPlace, e: React.PointerEvent) => void;
  dragItemId?: string | null;
}

type SourceFilterType = GhostSourceType | 'all';

const SOURCE_FILTER_TABS: { value: SourceFilterType; label: string; icon?: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'friend', label: 'Friends', icon: '👤' },
  { value: 'maps', label: 'Maps', icon: '📍' },
  { value: 'article', label: 'Articles', icon: '📰' },
  { value: 'email', label: 'Email', icon: '✉' },
  { value: 'manual', label: 'Added', icon: '✎' },
];

const TYPE_FILTER_CHIPS: { value: FilterType; label: string; icon: string }[] = [
  { value: 'all', label: 'All types', icon: '◎' },
  { value: 'restaurant', label: 'Restaurant', icon: '🍽' },
  { value: 'cafe', label: 'Cafe', icon: '☕' },
  { value: 'bar', label: 'Bar', icon: '🍷' },
  { value: 'museum', label: 'Museum', icon: '🏛' },
  { value: 'activity', label: 'Activity', icon: '✦' },
  { value: 'hotel', label: 'Hotel', icon: '🏨' },
  { value: 'neighborhood', label: 'Area', icon: '🏘' },
  { value: 'shop', label: 'Shop', icon: '🛍' },
];

const HOLD_DELAY = 180; // ms before drag activates

export default function PoolTray({ onTapDetail, onCurateMore, onOpenExport, onDragStart, dragItemId }: PoolTrayProps) {
  const tripDestinations = useTripStore(s => {
    const trip = s.trips.find(t => t.id === s.currentTripId);
    return trip?.destinations || [trip?.location?.split(',')[0]?.trim()].filter(Boolean);
  });
  const { isExpanded, setExpanded, filterType, setFilterType, slotContext } = usePoolStore();
  const [sourceFilter, setSourceFilter] = useState<SourceFilterType>('all');

  // Starred places from savedStore, geo-filtered to trip destinations
  const myPlaces = useSavedStore(s => s.myPlaces);
  const starredPlaces = useMemo(() => {
    if (!tripDestinations || tripDestinations.length === 0) return [];
    const destLower = (tripDestinations as string[]).map(d => d.toLowerCase());
    return myPlaces.filter(place => {
      if (place.rating?.reaction !== 'myPlace') return false;
      return destLower.some(dest => place.location.toLowerCase().includes(dest));
    });
  }, [myPlaces, tripDestinations]);

  // Apply source filter
  const sourceFiltered = useMemo(() => {
    if (sourceFilter === 'all') return starredPlaces;
    return starredPlaces.filter(item => (item.ghostSource || 'manual') === sourceFilter);
  }, [starredPlaces, sourceFilter]);

  // Apply type filter
  const typeFiltered = useMemo(() => {
    if (filterType === 'all') return sourceFiltered;
    return sourceFiltered.filter(item => item.type === filterType);
  }, [sourceFiltered, filterType]);

  // Smart sorting: if slot context exists, boost items matching suggested types
  const sortedItems = useMemo(() => {
    const items = [...typeFiltered];
    if (slotContext && slotContext.suggestedTypes.length > 0) {
      const suggestedSet = new Set(slotContext.suggestedTypes);
      return items.sort((a, b) => {
        const aMatch = suggestedSet.has(a.type) ? 1 : 0;
        const bMatch = suggestedSet.has(b.type) ? 1 : 0;
        if (bMatch !== aMatch) return bMatch - aMatch;
        return b.matchScore - a.matchScore;
      });
    }
    return items.sort((a, b) => b.matchScore - a.matchScore);
  }, [typeFiltered, slotContext]);

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
      const src = item.ghostSource || 'manual';
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
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <div className="flex items-center gap-2">
            <span
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--t-ink)',
              }}
            >
              Everywhere you want to go
            </span>
            <span
              className="inline-flex items-center justify-center rounded-full text-[10px] font-bold"
              style={{
                background: 'rgba(200,146,58,0.12)',
                color: 'var(--t-honey)',
                padding: '2px 8px',
                fontFamily: "'Space Mono', monospace",
              }}
            >
              {starredPlaces.length}
            </span>
            <span style={{ fontSize: '10px', color: 'rgba(28,26,23,0.4)' }}>▲</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onCurateMore(); }}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-full border-2 cursor-pointer transition-colors hover:opacity-80"
            style={{
              background: 'transparent',
              color: 'var(--t-panton-orange)',
              borderColor: 'var(--t-panton-orange)',
              fontFamily: "'Space Mono', monospace",
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
        maxHeight: '75vh',
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
          maxHeight: '75vh',
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
              fontFamily: "'DM Serif Display', serif",
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--t-ink)',
            }}
          >
            Everywhere you want to go
            <span style={{ fontSize: '10px', color: 'rgba(28,26,23,0.4)' }}>▼</span>
          </button>
          <div className="flex items-center gap-2">
            {onOpenExport && starredPlaces.length > 0 && (
              <button
                onClick={onOpenExport}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-full border-2 cursor-pointer transition-colors hover:opacity-80"
                style={{
                  background: 'transparent',
                  color: 'var(--t-honey)',
                  borderColor: 'var(--t-honey)',
                  fontFamily: "'Space Mono', monospace",
                }}
              >
                📍 Export
              </button>
            )}
            <button
              onClick={onCurateMore}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-full border-2 cursor-pointer transition-colors hover:opacity-80"
              style={{
                background: 'transparent',
                color: 'var(--t-panton-orange)',
                borderColor: 'var(--t-panton-orange)',
                fontFamily: "'Space Mono', monospace",
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
              background: 'linear-gradient(135deg, rgba(42,122,86,0.06) 0%, rgba(42,122,86,0.02) 100%)',
              border: '1px solid rgba(42,122,86,0.15)',
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className="text-[12px] font-semibold"
                style={{ color: 'var(--t-verde)', fontFamily: "'DM Sans', sans-serif" }}
              >
                Picking for {slotContext.slotLabel} · Day {slotContext.dayNumber}
              </span>
              <button
                onClick={() => usePoolStore.getState().setSlotContext(null)}
                className="text-[10px] px-2 py-0.5 rounded-full border-none cursor-pointer"
                style={{ background: 'rgba(28,26,23,0.06)', color: 'rgba(28,26,23,0.5)' }}
              >
                Clear
              </button>
            </div>
            {(slotContext.adjacentPlaces.before || slotContext.adjacentPlaces.after) && (
              <div className="text-[11px]" style={{ color: 'rgba(28,26,23,0.5)' }}>
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
                {slotContext.suggestedTypes.map(t => (
                  <button
                    key={t}
                    onClick={() => setFilterType(filterType === t ? 'all' : t as FilterType)}
                    className="text-[10px] px-2 py-0.5 rounded-full cursor-pointer transition-all"
                    style={{
                      background: filterType === t ? 'var(--t-verde)' : 'rgba(42,122,86,0.08)',
                      color: filterType === t ? 'white' : 'var(--t-verde)',
                      border: 'none',
                      fontFamily: "'Space Mono', monospace",
                      fontWeight: 600,
                    }}
                  >
                    {TYPE_FILTER_CHIPS.find(c => c.value === t)?.icon} {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Subtitle */}
        <div className="px-4 pb-2 text-xs" style={{ color: 'rgba(28,26,23,0.5)' }}>
          {sortedItems.length} place{sortedItems.length !== 1 ? 's' : ''}
          {filterType !== 'all' && ` · ${filterType}`}
          {sourceFilter !== 'all' && ` · ${SOURCE_FILTER_TABS.find(t => t.value === sourceFilter)?.label}`}
          {' '}· hold &amp; drag to assign
        </div>

        {/* Type Filter Chips — scrollable row */}
        <div
          className="flex gap-1.5 px-4 pb-2 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {TYPE_FILTER_CHIPS.map(chip => {
            const count = chip.value === 'all' ? sourceFiltered.length : (typeCounts[chip.value] || 0);
            if (chip.value !== 'all' && count === 0) return null;
            const isActive = filterType === chip.value;
            const isSuggested = slotContext?.suggestedTypes.includes(chip.value as PlaceType);
            return (
              <button
                key={chip.value}
                onClick={() => setFilterType(isActive ? 'all' : chip.value)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap cursor-pointer transition-all flex-shrink-0"
                style={{
                  background: isActive
                    ? 'var(--t-ink)'
                    : isSuggested
                      ? 'rgba(42,122,86,0.08)'
                      : 'var(--t-cream)',
                  color: isActive
                    ? 'white'
                    : isSuggested
                      ? 'var(--t-verde)'
                      : 'rgba(28,26,23,0.6)',
                  border: isActive
                    ? '1px solid var(--t-ink)'
                    : isSuggested
                      ? '1px solid rgba(42,122,86,0.2)'
                      : '1px solid var(--t-linen)',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <span>{chip.icon}</span>
                {chip.label}
                <span
                  className="text-[9px] font-bold"
                  style={{
                    opacity: 0.6,
                    fontFamily: "'Space Mono', monospace",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Source Filter Tabs */}
        <div
          className="flex overflow-x-auto"
          style={{ borderBottom: '1px solid var(--t-linen)', scrollbarWidth: 'none' }}
        >
          {SOURCE_FILTER_TABS.map(tab => {
            const isActive = sourceFilter === tab.value;
            const count = tab.value === 'all' ? starredPlaces.length : (sourceCounts[tab.value] || 0);
            if (tab.value !== 'all' && count === 0) return null;
            return (
              <button
                key={tab.value}
                onClick={() => setSourceFilter(tab.value)}
                className="flex-1 min-w-fit px-4 py-2.5 text-[11px] font-medium whitespace-nowrap cursor-pointer transition-all"
                style={{
                  background: 'transparent',
                  color: isActive ? 'var(--t-ink)' : 'rgba(28,26,23,0.5)',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--t-ink)' : '2px solid transparent',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {tab.icon && <span className="mr-1">{tab.icon}</span>}
                {tab.label} · {count}
              </button>
            );
          })}
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: 'thin' }}>
          {sortedItems.map(item => {
            const sourceStyle = SOURCE_STYLES[item.ghostSource as GhostSourceType] || SOURCE_STYLES.manual;
            const note = item.ghostSource === 'friend' ? item.friendAttribution?.note
              : item.ghostSource === 'maps' ? item.savedDate
              : undefined;
            const isDragging = dragItemId === item.id;
            const isSuggestedType = slotContext?.suggestedTypes.includes(item.type);
            const typeChip = TYPE_FILTER_CHIPS.find(c => c.value === item.type);

            return (
              <div
                key={item.id}
                className="flex items-start rounded-lg mb-2.5 cursor-pointer transition-all select-none"
                style={{
                  background: isSuggestedType ? 'rgba(42,122,86,0.03)' : 'var(--t-cream)',
                  border: isSuggestedType ? '1.5px solid rgba(42,122,86,0.15)' : '1.5px solid var(--t-linen)',
                  borderLeft: '3px solid var(--t-verde)',
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
                    color: 'rgba(28,26,23,0.2)',
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
                    <div className="text-[13px] font-medium truncate" style={{ color: 'var(--t-ink)' }}>
                      {item.name}
                    </div>
                    {typeChip && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          background: isSuggestedType ? 'rgba(42,122,86,0.1)' : 'rgba(28,26,23,0.05)',
                          color: isSuggestedType ? 'var(--t-verde)' : 'rgba(28,26,23,0.45)',
                          fontFamily: "'Space Mono', monospace",
                          fontWeight: 600,
                        }}
                      >
                        {typeChip.icon} {item.type}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] mb-1" style={{ color: 'rgba(28,26,23,0.5)' }}>
                    {sourceStyle.icon} {item.ghostSource === 'friend'
                      ? item.friendAttribution?.name
                      : item.ghostSource === 'maps' ? 'Google Maps'
                      : item.source?.name || sourceStyle.label}
                  </div>
                  {note && (
                    <div className="text-[11px] italic" style={{ color: 'rgba(28,26,23,0.5)' }}>
                      {item.ghostSource === 'friend' ? `"${note}"` : note}
                    </div>
                  )}
                </div>

                {/* Match score */}
                <div className="flex items-center gap-2 flex-shrink-0 pr-3 pt-3">
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: 'rgba(42,122,86,0.08)',
                      color: 'var(--t-verde)',
                      fontFamily: "'Space Mono', monospace",
                    }}
                  >
                    {item.matchScore}%
                  </span>
                </div>
              </div>
            );
          })}

          {sortedItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center" style={{ color: 'rgba(28,26,23,0.5)' }}>
              <span className="text-2xl mb-3">★</span>
              <p className="text-[12px] mb-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {filterType !== 'all'
                  ? `No ${filterType} places starred`
                  : sourceFilter !== 'all'
                    ? 'No starred places from this source'
                    : 'No starred places yet'}
              </p>
              <p className="text-[11px]" style={{ color: 'rgba(28,26,23,0.35)' }}>
                {filterType !== 'all'
                  ? <button onClick={() => setFilterType('all')} className="underline cursor-pointer bg-transparent border-none" style={{ color: 'var(--t-verde)', fontSize: '11px' }}>Show all types</button>
                  : 'Star places in My Places or Collect to add them here'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

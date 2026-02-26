'use client';

import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { useSavedStore } from '@/stores/savedStore';
import { ImportedPlace, PlaceType } from '@/types';
import { PerriandIcon, PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import { useTypeFilter, type FilterType } from '@/hooks/useTypeFilter';
import { usePicksFilter } from '@/hooks/usePicksFilter';
import PlaceSearchInput, { type PlaceSearchResult } from './PlaceSearchInput';
import FilterSortBar from './ui/FilterSortBar';
import { TYPE_ICONS, TYPE_COLORS_MUTED } from '@/constants/placeTypes';

// ─── Gesture thresholds ───
const HOLD_DELAY = 300;            // ms before drag activates (longer = more forgiving for scrollers)
const SCROLL_THRESHOLD = 8;        // px horizontal movement to cancel drag & allow scroll
const DRAG_ACTIVATE_THRESHOLD = 4; // px total movement to ignore (jitter tolerance)

const TYPE_CHIPS: { value: FilterType; label: string; icon: PerriandIconName }[] = [
  { value: 'restaurant', label: 'Eat', icon: 'restaurant' },
  { value: 'cafe', label: 'Cafe', icon: 'cafe' },
  { value: 'bar', label: 'Drink', icon: 'bar' },
  { value: 'museum', label: 'See', icon: 'museum' },
  { value: 'activity', label: 'Do', icon: 'activity' },
  { value: 'hotel', label: 'Stay', icon: 'hotel' },
  { value: 'shop', label: 'Shop', icon: 'shop' },
  { value: 'neighborhood', label: 'Walk', icon: 'location' },
];

const SOURCE_FILTERS = [
  { value: 'all', label: 'All sources' },
  { value: 'article', label: 'Articles' },
  { value: 'friend', label: 'Friends' },
  { value: 'email', label: 'Email' },
  { value: 'maps', label: 'Maps' },
] as const;

type SortOption = 'match' | 'name' | 'source' | 'recent';
type SourceFilter = typeof SOURCE_FILTERS[number]['value'];

interface PicksStripProps {
  onTapDetail: (item: ImportedPlace) => void;
  onBrowseAll: () => void;
  onDragStart: (item: ImportedPlace, e: React.PointerEvent) => void;
  dragItemId: string | null;
  /** When true, strip shows a "drop here" visual — items spread apart */
  isDropTarget?: boolean;
  /** Callback so the parent page can hit-test the strip's bounding rect */
  onRegisterRect?: (rect: DOMRect | null) => void;
  /** ID of a place that just returned — used for the "land" animation */
  returningPlaceId?: string | null;
}

function PicksStrip({ onTapDetail, onBrowseAll, onDragStart, dragItemId, isDropTarget, onRegisterRect, returningPlaceId }: PicksStripProps) {
  const { filter: activeFilter, setFilter: setActiveFilter, toggle: toggleFilter } = useTypeFilter();
  const [sortBy, setSortBy] = useState<SortOption>('match');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [holdingId, setHoldingId] = useState<string | null>(null); // visual "about to drag" feedback
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const trip = useTripStore(s => s.trips.find(t => t.id === s.currentTripId));
  const currentDay = useTripStore(s => s.currentDay);
  const addPlace = useSavedStore(s => s.addPlace);

  // ─── Shared filtering logic ───
  const {
    activeDestination,
    destinationPicks,
    filteredPicks,
    allUnplacedPicks,
  } = usePicksFilter({
    selectedDay: currentDay,
    typeFilter: activeFilter,
    sourceFilter,
    searchQuery,
  });

  const stripPlaces = useMemo(() => {
    const sorted = [...filteredPicks];
    switch (sortBy) {
      case 'match': sorted.sort((a, b) => b.matchScore - a.matchScore); break;
      case 'name': sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'source': sorted.sort((a, b) => (a.ghostSource || '').localeCompare(b.ghostSource || '')); break;
      case 'recent': sorted.sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || '')); break;
    }
    return sorted;
  }, [filteredPicks, sortBy]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    destinationPicks.forEach(p => { counts[p.type] = (counts[p.type] || 0) + 1; });
    return counts;
  }, [destinationPicks]);

  // ─── Drop target rect reporting ───
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onRegisterRect || !containerRef.current) return;
    const update = () => {
      if (containerRef.current) onRegisterRect(containerRef.current.getBoundingClientRect());
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      onRegisterRect(null);
    };
  }, [onRegisterRect]);

  // ─── Gesture detection refs ───
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdItem = useRef<ImportedPlace | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const gestureDecided = useRef(false);
  const stripScrollRef = useRef<HTMLDivElement>(null);

  const clearHold = useCallback(() => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    holdItem.current = null;
    pointerStart.current = null;
    gestureDecided.current = false;
    setHoldingId(null);
  }, []);

  const handlePointerDown = useCallback((item: ImportedPlace, e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
    holdItem.current = item;
    gestureDecided.current = false;

    const pointerEvent = e;
    holdTimer.current = setTimeout(() => {
      if (holdItem.current && !gestureDecided.current) {
        gestureDecided.current = true;
        onDragStart(holdItem.current, pointerEvent);
        holdItem.current = null;
        setHoldingId(null);
      }
    }, HOLD_DELAY);

    setTimeout(() => {
      if (holdItem.current?.id === item.id && !gestureDecided.current) {
        setHoldingId(item.id);
      }
    }, 150);
  }, [onDragStart]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerStart.current || gestureDecided.current) return;

    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;

    if (Math.abs(dx) > SCROLL_THRESHOLD) {
      gestureDecided.current = true;
      if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
      holdItem.current = null;
      setHoldingId(null);
      return;
    }

    if (Math.abs(dy) > SCROLL_THRESHOLD && holdItem.current) {
      gestureDecided.current = true;
      if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
      onDragStart(holdItem.current, e);
      holdItem.current = null;
      setHoldingId(null);
    }
  }, [onDragStart]);

  const handlePointerUp = useCallback(() => {
    clearHold();
  }, [clearHold]);

  const handleTap = useCallback((item: ImportedPlace) => {
    if (!dragItemId) onTapDetail(item);
  }, [dragItemId, onTapDetail]);

  const hasActiveFilters = activeFilter !== 'all' || sourceFilter !== 'all' || sortBy !== 'match' || searchQuery.trim() !== '';

  if (destinationPicks.length === 0 && !searchQuery.trim()) {
    return (
      <div
        className="px-4 py-2"
        style={{ background: 'white', borderTop: '1px solid var(--t-linen)' }}
      >
        <div className="flex items-center justify-between">
          <span
            className="text-[11px]"
            style={{ color: INK['85'], fontFamily: FONT.sans }}
          >
            No picks for this destination yet
          </span>
          <button
            onClick={onBrowseAll}
            className="text-[10px] font-semibold px-2.5 py-1 rounded-full cursor-pointer"
            style={{
              background: 'rgba(42,122,86,0.08)',
              color: 'var(--t-verde)',
              border: 'none',
              fontFamily: FONT.mono,
            }}
          >
            Browse all →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        background: isDropTarget ? 'rgba(42,122,86,0.04)' : 'white',
        borderTop: isDropTarget ? '2px solid var(--t-verde)' : '1px solid var(--t-linen)',
        minWidth: 0,
        maxWidth: '100%',
        overflow: 'hidden',
        transition: 'background 0.2s, border-top 0.2s',
      }}
    >
      {/* Header row: FilterSortBar + count + browse all */}
      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1">
        <div className="flex-1 min-w-0">
          <FilterSortBar
            compact
            filterGroups={[
              {
                key: 'type',
                label: 'Type',
                options: TYPE_CHIPS.filter(c => typeCounts[c.value as string] > 0).map(c => ({ value: c.value, label: c.label, icon: c.icon })),
                value: activeFilter,
                onChange: (v) => setActiveFilter(v as FilterType),
              },
              {
                key: 'source',
                label: 'Source',
                options: SOURCE_FILTERS.map(s => ({ value: s.value, label: s.label })),
                value: sourceFilter,
                onChange: (v) => setSourceFilter(v as SourceFilter),
              },
            ]}
            sortOptions={[
              { value: 'match', label: 'Match %' },
              { value: 'recent', label: 'Most recent' },
              { value: 'name', label: 'A–Z' },
              { value: 'source', label: 'Source' },
            ]}
            sortValue={sortBy}
            onSortChange={(v) => setSortBy(v as SortOption)}
            onResetAll={() => { setActiveFilter('all'); setSortBy('match'); setSourceFilter('all'); setSearchQuery(''); }}
          />
        </div>

        {/* Count badge */}
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{
            background: 'rgba(42,122,86,0.08)',
            color: 'var(--t-verde)',
            fontFamily: FONT.mono,
          }}
        >
          {activeFilter !== 'all' ? `${stripPlaces.length}/${destinationPicks.length}` : destinationPicks.length}
        </span>

        {/* Browse all */}
        <button
          onClick={onBrowseAll}
          className="text-[9px] font-semibold px-2 py-0.5 rounded-full cursor-pointer flex-shrink-0"
          style={{
            background: 'transparent',
            color: 'var(--t-verde)',
            border: '1px solid rgba(42,122,86,0.2)',
            fontFamily: FONT.mono,
          }}
        >
          All →
        </button>
      </div>

      {/* Search bar */}
      <div className="px-3 pb-1">
        <div className="relative">
          <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
            <PerriandIcon name="discover" size={12} color={INK['40']} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search picks…"
            style={{
              width: '100%',
              fontFamily: FONT.sans,
              fontSize: 10,
              color: 'var(--t-ink)',
              background: INK['04'],
              border: `1px solid var(--t-linen)`,
              borderRadius: 6,
              padding: '4px 8px 4px 24px',
              outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <PerriandIcon name="close" size={10} color={INK['50']} />
            </button>
          )}
        </div>
      </div>

      {/* Hint label */}
      <div className="px-3 pb-1">
        <span style={{
          fontFamily: FONT.mono,
          fontSize: 8,
          color: isDropTarget ? 'var(--t-verde)' : INK['70'],
          letterSpacing: '0.3px',
          fontWeight: isDropTarget ? 700 : undefined,
          transition: 'color 0.2s',
        }}>
          {isDropTarget ? '↓ DROP HERE TO RETURN' : 'HOLD + DRAG UP TO PLAN · TAP FOR DETAILS'}
        </span>
      </div>

      {/* Horizontal scroll strip — taller cards with better touch targets */}
      <div
        ref={stripScrollRef}
        className="flex gap-2.5 px-3 pb-3 pt-0.5 overflow-x-auto"
        style={{
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          minWidth: 0,
          touchAction: 'pan-x',
        }}
      >
        {stripPlaces.length === 0 && !showAddPlace ? (
          <div className="flex items-center justify-center w-full py-1">
            <span className="text-[10px]" style={{ color: INK['80'] }}>
              No picks match this filter
            </span>
          </div>
        ) : (
          <>
          {stripPlaces.map((place, idx) => {
            const typeIcon = TYPE_ICONS[place.type] || 'location';
            const typeColor = TYPE_COLORS_MUTED[place.type] || '#c0ab8e';
            const isDragging = dragItemId === place.id;
            const isHolding = holdingId === place.id;
            const isReturning = returningPlaceId === place.id;

            return (
              <div
                key={place.id}
                className="flex flex-col items-center flex-shrink-0 cursor-pointer select-none"
                style={{
                  width: 68,
                  opacity: isDragging ? 0.25 : 1,
                  animation: isReturning ? 'stripLand 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards' : undefined,
                  transform: isDragging
                    ? 'scale(0.85)'
                    : isHolding
                      ? 'scale(0.92) translateY(-2px)'
                      : 'none',
                  transition: 'opacity 0.2s, transform 0.2s ease-out',
                  touchAction: 'pan-x',
                }}
                onPointerDown={(e) => handlePointerDown(place, e)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClick={() => handleTap(place)}
              >
                {/* Drag grip dots — subtle affordance */}
                <div
                  className="flex gap-px mb-0.5"
                  style={{ opacity: 0.2 }}
                >
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--t-ink)' }} />
                  ))}
                </div>

                {/* Icon thumbnail — larger for better touch */}
                <div
                  className="rounded-xl flex items-center justify-center relative"
                  style={{
                    width: 50,
                    height: 50,
                    background: `linear-gradient(135deg, ${typeColor}40, ${typeColor}25)`,
                    border: isHolding
                      ? `2px solid var(--t-verde)`
                      : `1px solid ${typeColor}50`,
                    boxShadow: isHolding
                      ? '0 4px 12px rgba(42,122,86,0.2)'
                      : '0 1px 3px rgba(0,0,0,0.04)',
                    transition: 'border 0.15s, box-shadow 0.15s',
                  }}
                >
                  <PerriandIcon name={typeIcon} size={18} />
                  {/* Match score pip */}
                  <div
                    className="absolute -top-1 -right-1 flex items-center justify-center rounded-full"
                    style={{
                      width: 18,
                      height: 18,
                      background: 'white',
                      border: '1px solid var(--t-linen)',
                      fontSize: 8,
                      fontWeight: 700,
                      color: 'var(--t-verde)',
                      fontFamily: FONT.mono,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                    }}
                  >
                    {place.matchScore}
                  </div>
                </div>

                {/* Name */}
                <span
                  className="text-[9px] font-medium text-center leading-tight mt-1"
                  style={{
                    color: 'var(--t-ink)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    fontFamily: FONT.sans,
                    maxWidth: '100%',
                    lineHeight: '1.15',
                  }}
                >
                  {place.name}
                </span>
              </div>
            );
          })}

          {/* + Add place card */}
          {showAddPlace ? (
            <div
              className="flex-shrink-0 rounded-xl overflow-hidden"
              style={{
                minWidth: 220,
                background: 'white',
                border: '1.5px dashed var(--t-verde)',
                boxShadow: '0 2px 8px rgba(42,122,86,0.1)',
              }}
            >
              <PlaceSearchInput
                compact
                destination={activeDestination || undefined}
                placeholder="Search place…"
                onSelect={(result: PlaceSearchResult) => {
                  const newPlace: ImportedPlace = {
                    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    name: result.name,
                    type: result.type,
                    location: result.address || activeDestination || '',
                    source: { type: 'text', name: 'Manual' },
                    matchScore: 0,
                    matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0 },
                    tasteNote: '',
                    status: 'available',
                    isFavorited: true,
                    ...(result.placeId && {
                      google: {
                        placeId: result.placeId,
                        lat: result.lat,
                        lng: result.lng,
                        address: result.address,
                      },
                    }),
                  };
                  addPlace(newPlace);
                  setShowAddPlace(false);
                }}
                onCancel={() => setShowAddPlace(false)}
              />
            </div>
          ) : (
            <div
              className="flex flex-col items-center flex-shrink-0 cursor-pointer select-none"
              style={{ width: 68 }}
              onClick={() => setShowAddPlace(true)}
            >
              {/* Spacer to align with grip dots */}
              <div style={{ height: 7 }} />
              {/* Icon */}
              <div
                className="rounded-xl flex items-center justify-center"
                style={{
                  width: 50,
                  height: 50,
                  border: `1.5px dashed ${INK['20']}`,
                  background: INK['04'],
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <PerriandIcon name="add" size={18} color={INK['35']} />
              </div>
              {/* Label */}
              <span
                className="text-[9px] font-medium text-center leading-tight mt-1"
                style={{
                  color: INK['35'],
                  fontFamily: FONT.sans,
                  maxWidth: '100%',
                  lineHeight: '1.15',
                }}
              >
                Add place
              </span>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}

export default React.memo(PicksStrip);

'use client';

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { ImportedPlace } from '@/types';
import { PerriandIcon, PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import { useTypeFilter, type FilterType } from '@/hooks/useTypeFilter';
import { usePicksFilter } from '@/hooks/usePicksFilter';
import { useDragGesture } from '@/hooks/useDragGesture';
import FilterSortBar from './ui/FilterSortBar';
import AddPlaceInline from './AddPlaceInline';
import { TYPE_ICONS, TYPE_COLORS_MUTED } from '@/constants/placeTypes';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPE CHIP + SOURCE FILTER CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Minimum swipe distance (px) to trigger expand/collapse */
const SWIPE_THRESHOLD = 40;
/** Grid column count */
const GRID_COLS = 3;
/** Expanded sheet takes this fraction of viewport height */
const EXPANDED_VH = 0.6;

/* ═══════════════════════════════════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════════════════════════════════ */

interface PicksStripProps {
  onTapDetail: (item: ImportedPlace) => void;
  onDragStart: (item: ImportedPlace, e: React.PointerEvent) => void;
  dragItemId: string | null;
  isDropTarget?: boolean;
  onRegisterRect?: (rect: DOMRect | null) => void;
  returningPlaceId?: string | null;
  /** Imperative expand with optional pre-set type filter (used by DayPlanner empty slot tap) */
  expandRef?: React.MutableRefObject<((filter?: FilterType) => void) | null>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

function PicksStrip({
  onTapDetail, onDragStart, dragItemId,
  isDropTarget, onRegisterRect, returningPlaceId,
  expandRef,
}: PicksStripProps) {
  const { filter: activeFilter, setFilter: setActiveFilter, toggle: toggleFilter } = useTypeFilter();
  const [sortBy, setSortBy] = useState<SortOption>('match');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const trip = useTripStore(s => s.trips.find(t => t.id === s.currentTripId));
  const currentDay = useTripStore(s => s.currentDay);

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

  // ─── Pointer drag gesture (shared hook) ───
  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    holdingId,
  } = useDragGesture({
    onDragActivate: onDragStart,
    onTap: onTapDetail,
    layout: expanded ? 'vertical' : 'horizontal',
    isDragging: !!dragItemId,
  });

  const stripPlaces = useMemo(() => {
    const sorted = [...filteredPicks];
    switch (sortBy) {
      case 'match': sorted.sort((a, b) => b.matchScore - a.matchScore); break;
      case 'name': sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'source': sorted.sort((a, b) => (a.ghostSource || '').localeCompare(b.ghostSource || '')); break;
      case 'recent': sorted.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || '')); break;
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

  // ─── Swipe-to-expand gesture on handle ───
  const swipeRef = useRef<{ startY: number; active: boolean }>({ startY: 0, active: false });

  const onHandleTouchStart = useCallback((e: React.TouchEvent) => {
    swipeRef.current = { startY: e.touches[0].clientY, active: true };
  }, []);

  const onHandleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!swipeRef.current.active) return;
    const deltaY = swipeRef.current.startY - e.changedTouches[0].clientY;
    swipeRef.current.active = false;
    if (deltaY > SWIPE_THRESHOLD) setExpanded(true);   // swipe up → expand
    if (deltaY < -SWIPE_THRESHOLD) setExpanded(false);  // swipe down → collapse
  }, []);

  // ─── Imperative expand (used by DayPlanner empty-slot tap) ───
  useEffect(() => {
    if (expandRef) {
      expandRef.current = (filter?: FilterType) => {
        if (filter) setActiveFilter(filter);
        setExpanded(true);
      };
      return () => { expandRef.current = null; };
    }
  }, [expandRef, setActiveFilter]);

  // ─── Close expanded on drag start ───
  useEffect(() => {
    if (dragItemId && expanded) setExpanded(false);
  }, [dragItemId, expanded]);

  const hasActiveFilters = activeFilter !== 'all' || sourceFilter !== 'all' || sortBy !== 'match' || searchQuery.trim() !== '';

  // ─── Empty state ───
  if (destinationPicks.length === 0 && !searchQuery.trim()) {
    return (
      <div
        className="px-4 pt-2 pb-3"
        style={{ background: 'white', borderTop: '1px solid var(--t-linen)' }}
      >
        <span className="text-[11px]" style={{ color: INK['85'], fontFamily: FONT.sans }}>
          No picks for this destination yet
        </span>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     RENDER — shared header + conditional body (strip vs grid)
     ═══════════════════════════════════════════════════════════════════════════ */

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        background: isDropTarget ? 'rgba(42,122,86,0.04)' : 'white',
        borderTop: isDropTarget ? '2px solid var(--t-verde)' : '1px solid var(--t-linen)',
        minWidth: 0,
        maxWidth: '100%',
        overflow: 'hidden',
        transition: 'background 0.2s, border-top 0.2s, max-height 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
        maxHeight: expanded ? `${EXPANDED_VH * 100}vh` : 260,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Swipe handle ── */}
      <div
        className="flex items-center justify-center pt-1.5 pb-0.5 cursor-grab"
        onTouchStart={onHandleTouchStart}
        onTouchEnd={onHandleTouchEnd}
        onClick={() => setExpanded(prev => !prev)}
        style={{ touchAction: 'none' }}
      >
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: INK['15'],
            transition: 'width 0.2s',
          }}
        />
      </div>

      {/* ── Header row: FilterSortBar + count + expand toggle ── */}
      <div className="flex items-center gap-1.5 px-3 pt-0.5 pb-1">
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

        {/* Expand/collapse toggle */}
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: expanded ? 'var(--t-verde)' : 'transparent',
            border: expanded ? 'none' : '1px solid rgba(42,122,86,0.2)',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          aria-label={expanded ? 'Collapse picks' : 'Expand picks'}
        >
          <svg
            width={10} height={10} viewBox="0 0 10 10"
            style={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
            }}
          >
            <path
              d="M1 7 L5 3 L9 7"
              fill="none"
              stroke={expanded ? 'white' : 'var(--t-verde)'}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* ── Search bar ── */}
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
              border: '1px solid var(--t-linen)',
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

      {/* ── Hint label ── */}
      <div className="px-3 pb-1">
        <span style={{
          fontFamily: FONT.mono,
          fontSize: 8,
          color: isDropTarget ? 'var(--t-verde)' : INK['70'],
          letterSpacing: '0.3px',
          fontWeight: isDropTarget ? 700 : undefined,
          transition: 'color 0.2s',
        }}>
          {isDropTarget
            ? '↓ DROP HERE TO RETURN'
            : expanded
              ? 'TAP FOR DETAILS · SWIPE DOWN TO COLLAPSE'
              : 'HOLD + DRAG UP TO PLAN · SWIPE UP FOR MORE'}
        </span>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
         BODY: horizontal strip (collapsed) or thumbnail grid (expanded)
         ═══════════════════════════════════════════════════════════════════════ */}

      {expanded ? (
        /* ── EXPANDED: thumbnail grid ── */
        <div
          className="flex-1 overflow-y-auto px-3 pb-3 pt-0.5"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
              gap: 10,
            }}
          >
            {stripPlaces.map((place) => {
              const typeIcon = TYPE_ICONS[place.type] || 'location';
              const typeColor = TYPE_COLORS_MUTED[place.type] || '#c0ab8e';
              const isDragging = dragItemId === place.id;
              const isHolding = holdingId === place.id;
              const isReturning = returningPlaceId === place.id;

              return (
                <div
                  key={place.id}
                  className="flex flex-col items-center select-none"
                  style={{
                    opacity: isDragging ? 0.25 : 1,
                    animation: isReturning ? 'stripLand 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards' : undefined,
                    transform: isDragging ? 'scale(0.85)' : isHolding ? 'scale(0.95) translateY(-2px)' : 'none',
                    transition: 'opacity 0.2s, transform 0.2s ease-out',
                    touchAction: 'none',
                    cursor: 'grab',
                  }}
                  onPointerDown={(e) => handlePointerDown(place, e)}
                >
                  {/* Icon thumbnail */}
                  <div
                    className="rounded-xl flex items-center justify-center relative w-full"
                    style={{
                      aspectRatio: '1',
                      background: `linear-gradient(135deg, ${typeColor}40, ${typeColor}25)`,
                      border: isHolding ? '2px solid var(--t-verde)' : `1px solid ${typeColor}50`,
                      boxShadow: isHolding ? '0 4px 12px rgba(42,122,86,0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
                      transition: 'border 0.15s, box-shadow 0.15s',
                    }}
                  >
                    <PerriandIcon name={typeIcon} size={22} />
                    {/* Match score pip */}
                    <div
                      className="absolute -top-1 -right-1 flex items-center justify-center rounded-full"
                      style={{
                        width: 20,
                        height: 20,
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
                    className="text-[10px] font-medium text-center leading-tight mt-1.5"
                    style={{
                      color: 'var(--t-ink)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      fontFamily: FONT.sans,
                      maxWidth: '100%',
                      lineHeight: '1.2',
                    }}
                  >
                    {place.name}
                  </span>

                  {/* Location hint */}
                  <span
                    className="text-[8px] text-center mt-0.5"
                    style={{
                      color: INK['50'],
                      fontFamily: FONT.mono,
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      maxWidth: '100%',
                    }}
                  >
                    {place.location?.split(',')[0]?.trim() || ''}
                  </span>
                </div>
              );
            })}

            {/* + Add place — grid cell */}
            <div className="flex flex-col items-center justify-center">
              <AddPlaceInline variant="strip" destination={activeDestination || undefined} />
            </div>
          </div>

          {stripPlaces.length === 0 && (
            <div className="flex items-center justify-center w-full py-6">
              <span className="text-[10px]" style={{ color: INK['80'] }}>
                No picks match this filter
              </span>
            </div>
          )}
        </div>
      ) : (
        /* ── COLLAPSED: horizontal scroll strip ── */
        <div
          className="flex gap-2.5 px-3 pb-3 pt-0.5 overflow-x-auto"
          style={{
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
            minWidth: 0,
            touchAction: 'pan-x',
          }}
        >
          {stripPlaces.length === 0 ? (
            <div className="flex items-center justify-center w-full py-1">
              <span className="text-[10px]" style={{ color: INK['80'] }}>
                No picks match this filter
              </span>
            </div>
          ) : (
            <>
              {stripPlaces.map((place) => {
                const typeIcon = TYPE_ICONS[place.type] || 'location';
                const typeColor = TYPE_COLORS_MUTED[place.type] || '#c0ab8e';
                const isDragging = dragItemId === place.id;
                const isHolding = holdingId === place.id;
                const isReturning = returningPlaceId === place.id;

                return (
                  <div
                    key={place.id}
                    className="flex flex-col items-center flex-shrink-0 select-none"
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
                      cursor: 'grab',
                    }}
                    onPointerDown={(e) => handlePointerDown(place, e)}
                  >
                    {/* Drag grip dots */}
                    <div className="flex gap-px mb-0.5" style={{ opacity: 0.2 }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--t-ink)' }} />
                      ))}
                    </div>

                    {/* Icon thumbnail */}
                    <div
                      className="rounded-xl flex items-center justify-center relative"
                      style={{
                        width: 50,
                        height: 50,
                        background: `linear-gradient(135deg, ${typeColor}40, ${typeColor}25)`,
                        border: isHolding ? '2px solid var(--t-verde)' : `1px solid ${typeColor}50`,
                        boxShadow: isHolding ? '0 4px 12px rgba(42,122,86,0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
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

              {/* + Add place */}
              <AddPlaceInline variant="strip" destination={activeDestination || undefined} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default React.memo(PicksStrip);

'use client';

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { ImportedPlace } from '@/types';
import { PerriandIcon, PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import { useTypeFilter, type FilterType } from '@/hooks/useTypeFilter';
import { usePicksFilter } from '@/hooks/usePicksFilter';
import { useDragGesture } from '@/hooks/useDragGesture';
import FilterSortBar from './ui/FilterSortBar';
import { TYPE_ICONS, TYPE_COLORS_MUTED } from '@/constants/placeTypes';

const TYPE_LABELS: Record<string, string> = {
  restaurant: 'Restaurant', hotel: 'Hotel', bar: 'Bar', cafe: 'Café',
  museum: 'Museum', activity: 'Activity', neighborhood: 'Neighborhood', shop: 'Shop',
};

const TYPE_CHIPS: { value: FilterType; label: string; icon: PerriandIconName }[] = [
  { value: 'restaurant', label: 'Eat', icon: 'restaurant' },
  { value: 'cafe', label: 'Café', icon: 'cafe' },
  { value: 'bar', label: 'Drink', icon: 'bar' },
  { value: 'museum', label: 'See', icon: 'museum' },
  { value: 'activity', label: 'Do', icon: 'activity' },
  { value: 'hotel', label: 'Stay', icon: 'hotel' },
  { value: 'shop', label: 'Shop', icon: 'shop' },
];

const SOURCE_FILTERS = [
  { value: 'all', label: 'All sources' },
  { value: 'article', label: 'Articles' },
  { value: 'friend', label: 'Friends' },
  { value: 'email', label: 'Email' },
  { value: 'maps', label: 'Maps' },
] as const;

type SourceFilter = typeof SOURCE_FILTERS[number]['value'];

interface PicksRailProps {
  onTapDetail: (item: ImportedPlace) => void;
  width: number;
  onResizeStart: (e: React.PointerEvent) => void;
  /** Pointer-based drag activation — parent handles the drag overlay + hit-testing */
  onDragStart: (item: ImportedPlace, e: React.PointerEvent) => void;
  /** ID of item currently being dragged (to dim it in the list) */
  dragItemId: string | null;
  /** Whether the pointer is currently hovering over this rail (for drop-back visual) */
  isDropTarget: boolean;
  /** Register this rail's bounding rect with the parent for hit-testing */
  onRegisterRect: (rect: DOMRect | null) => void;
  /** ID of item that was just returned to pool (for animation) */
  returningPlaceId: string | null;
}

function PicksRailInner({
  onTapDetail, width, onResizeStart,
  onDragStart, dragItemId, isDropTarget, onRegisterRect, returningPlaceId,
}: PicksRailProps) {
  const { filter: activeFilter, toggle: toggleFilter } = useTypeFilter();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'match' | 'name' | 'recent'>('match');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Read currentDay from store (no more day selector — syncs with DayBoardView)
  const currentDay = useTripStore(s => s.currentDay);
  const selectedDay = currentDay;

  const trip = useTripStore(s => s.trips.find(t => t.id === s.currentTripId));

  // ─── Shared filtering logic ───
  const {
    tripDestinations,
    activeDestination,
    allUnplacedPicks,
    placedIds,
    filteredPicks: sharedFilteredPicks,
    destinationScore,
    matchesDestination,
  } = usePicksFilter({
    selectedDay,
    typeFilter: activeFilter,
    sourceFilter,
    searchQuery,
  });

  // ─── Rect registration for return-to-pool hit-testing ───
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const report = () => onRegisterRect(el.getBoundingClientRect());
    report();
    window.addEventListener('resize', report);
    el.addEventListener('scroll', report, { passive: true });
    return () => {
      window.removeEventListener('resize', report);
      el.removeEventListener('scroll', report);
      onRegisterRect(null);
    };
  }, [onRegisterRect]);

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
    layout: 'vertical',
    isDragging: !!dragItemId,
  });

  const sortedPicks = useMemo(() => {
    const hasDestFilter = activeDestination || (selectedDay === null && tripDestinations.length > 0);
    return [...sharedFilteredPicks].sort((a, b) => {
      if (hasDestFilter) {
        // Score-based: higher destination relevance sorts first
        const aScore = destinationScore(a);
        const bScore = destinationScore(b);
        if (Math.abs(aScore - bScore) > 0.1) return bScore - aScore;
      }
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'recent') return (b.savedAt || '').localeCompare(a.savedAt || '');
      return b.matchScore - a.matchScore;
    });
  }, [sharedFilteredPicks, activeDestination, selectedDay, tripDestinations, destinationScore, sortBy]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allUnplacedPicks.forEach(p => { counts[p.type] = (counts[p.type] || 0) + 1; });
    return counts;
  }, [allUnplacedPicks]);

  return (
    <div
      ref={containerRef}
      className="flex h-full relative"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        width,
        background: isDropTarget ? 'rgba(42,122,86,0.06)' : 'white',
        flexShrink: 0,
        transition: 'background 150ms ease',
        outline: isDropTarget ? '2px dashed var(--t-verde)' : 'none',
        outlineOffset: -2,
      }}
    >
    {/* Main content column */}
    <div className="flex flex-col flex-1 min-w-0">

      {/* Header */}
      <div
        className="flex flex-col px-3 py-2 flex-shrink-0 gap-1.5"
        style={{ borderBottom: '1px solid var(--t-linen)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                fontWeight: 700,
                color: INK['50'],
                textTransform: 'uppercase',
                letterSpacing: 1.5,
              }}
            >
              Your Picks
            </span>
            <span
              className="px-1.5 py-0.5 rounded-full"
              style={{
                fontFamily: FONT.mono,
                fontSize: 9,
                fontWeight: 700,
                background: 'rgba(42,122,86,0.08)',
                color: 'var(--t-verde)',
              }}
            >
              {allUnplacedPicks.length}
            </span>
          </div>
        </div>

        {/* Day indicator (read-only — syncs with DayBoardView clicks) */}
        {selectedDay && activeDestination && (
          <span style={{
            fontFamily: FONT.sans,
            fontSize: 10,
            fontWeight: 500,
            color: INK['50'],
          }}>
            Day {selectedDay} · {activeDestination}
          </span>
        )}
      </div>

      {/* Filters & sort */}
      <div className="px-3 py-1.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--t-linen)' }}>
        <FilterSortBar
          compact
          filterGroups={[{
            key: 'type',
            label: 'Type',
            options: TYPE_CHIPS.filter(c => typeCounts[c.value as string] > 0).map(c => ({ value: c.value, label: c.label, icon: c.icon })),
            value: activeFilter,
            onChange: (v) => toggleFilter(v as FilterType),
          }, {
            key: 'source',
            label: 'Source',
            options: SOURCE_FILTERS.map(s => ({ value: s.value, label: s.label })),
            value: sourceFilter,
            onChange: (v) => setSourceFilter(v as SourceFilter),
          }]}
          sortOptions={[
            { value: 'match', label: 'Match %' },
            { value: 'recent', label: 'Most recent' },
            { value: 'name', label: 'A–Z' },
          ]}
          sortValue={sortBy}
          onSortChange={(v) => setSortBy(v as any)}
          onResetAll={() => { toggleFilter('all'); setSortBy('match'); setSourceFilter('all'); setSearchQuery(''); }}
        />
      </div>

      {/* Search bar */}
      <div className="px-3 py-1.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--t-linen)' }}>
        <div className="relative">
          <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
            <PerriandIcon name="discover" size={12} color={INK['40']} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search all picks…"
            style={{
              width: '100%',
              fontFamily: FONT.sans,
              fontSize: 11,
              color: 'var(--t-ink)',
              background: INK['04'],
              border: `1px solid var(--t-linen)`,
              borderRadius: 8,
              padding: '5px 28px 5px 26px',
              outline: 'none',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <PerriandIcon name="close" size={10} color={INK['50']} />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable picks list */}
      <div
        className="flex-1 overflow-y-auto flex flex-col gap-1 py-2 px-2"
        style={{ scrollbarWidth: 'thin' }}
      >
        {sortedPicks.map(place => {
          const typeIcon = TYPE_ICONS[place.type] || 'location';
          const typeColor = TYPE_COLORS_MUTED[place.type] || '#c0ab8e';
          const typeLabel = TYPE_LABELS[place.type] || place.type;
          const isHovered = hoveredId === place.id;
          const tasteNote = place.tasteNote;
          const location = place.location?.split(',')[0]?.trim() || '';
          const hasDestFilter = activeDestination || (selectedDay === null && tripDestinations.length > 0);
          // Score-based dimming: 1.0 = full opacity, 0.5 = slightly dimmed, 0 = heavily dimmed
          const dScore = hasDestFilter ? destinationScore(place) : 1;
          const isBeingDragged = dragItemId === place.id;
          const isReturning = returningPlaceId === place.id;
          const isHolding = holdingId === place.id;
          const isPlaced = placedIds.has(place.id);

          return (
            <div
              key={place.id}
              onPointerDown={(e) => handlePointerDown(place, e)}
              onMouseEnter={() => setHoveredId(place.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="flex items-start gap-2 transition-all flex-shrink-0 text-left w-full"
              style={{
                padding: '8px 8px',
                borderRadius: 10,
                background: isHolding ? `${typeColor}18` : isHovered ? `${typeColor}12` : 'transparent',
                border: isHolding ? `1.5px solid ${typeColor}50` : isHovered ? `1px solid ${typeColor}30` : '1px solid transparent',
                transform: isHolding ? 'scale(1.02)' : isHovered ? 'translateX(2px)' : 'translateX(0)',
                opacity: isBeingDragged ? 0.3 : isReturning ? 0.5 : isPlaced ? 0.45 : dScore < 1 ? 0.35 + dScore * 0.65 : 1,
                cursor: 'grab',
                touchAction: 'none',
                userSelect: 'none',
              }}
            >
              {/* Type icon */}
              <div
                className="relative flex items-center justify-center flex-shrink-0"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: `linear-gradient(135deg, ${typeColor}30, ${typeColor}12)`,
                  marginTop: 1,
                }}
              >
                <PerriandIcon name={typeIcon} size={18} color={typeColor} />
                {/* Match score pip */}
                {place.matchScore >= 80 && (
                  <div
                    className="absolute flex items-center justify-center"
                    style={{
                      top: -4,
                      right: -4,
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: 'var(--t-verde)',
                      color: 'white',
                      fontFamily: FONT.mono,
                      fontSize: 7,
                      fontWeight: 800,
                    }}
                  >
                    {place.matchScore}
                  </div>
                )}
              </div>

              {/* Text content */}
              <div className="flex flex-col min-w-0 flex-1" style={{ gap: 1 }}>
                {/* Name */}
                <span
                  style={{
                    fontFamily: FONT.sans,
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--t-ink)',
                    lineHeight: 1.25,
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical' as const,
                    overflow: 'hidden',
                  }}
                >
                  {place.name}
                </span>
                {/* Type · Location */}
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 9,
                    color: INK['55'],
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical' as const,
                    overflow: 'hidden',
                  }}
                >
                    {typeLabel}{location ? ` · ${location}` : ''}{isPlaced ? ' · ✓ placed' : ''}
                </span>
                {/* Taste note preview */}
                {tasteNote && (
                  <span
                    style={{
                      fontFamily: FONT.serif,
                      fontStyle: 'italic',
                      fontSize: 9,
                      color: INK['55'],
                      lineHeight: 1.3,
                      marginTop: 1,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                      overflow: 'hidden',
                    }}
                  >
                    {tasteNote}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {sortedPicks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 px-3">
            <PerriandIcon name="discover" size={20} color={INK['20']} />
            <span
              className="text-center mt-2"
              style={{ fontFamily: FONT.sans, fontSize: 11, color: INK['35'], lineHeight: 1.4 }}
            >
              {allUnplacedPicks.length === 0 ? 'No unplaced picks' : 'No picks match this filter'}
            </span>
          </div>
        )}

      </div>
    </div>

    {/* Resize handle — right edge */}
    <div
      onPointerDown={onResizeStart}
      className="picks-rail-handle"
      style={{
        position: 'absolute',
        top: 0,
        right: -3,
        width: 6,
        height: '100%',
        cursor: 'col-resize',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Visual grip line */}
      <div
        className="picks-rail-grip"
        style={{
          width: 2,
          height: 32,
          borderRadius: 1,
          background: INK['15'],
          transition: 'background 150ms ease',
        }}
      />
    </div>
    </div>
  );
}

const PicksRail = React.memo(PicksRailInner);
PicksRail.displayName = 'PicksRail';
export default PicksRail;

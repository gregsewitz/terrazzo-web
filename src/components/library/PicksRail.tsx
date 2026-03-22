'use client';

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { usePoolStore } from '@/stores/poolStore';
import { ImportedPlace } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT } from '@/constants/theme';
import { useTypeFilter, type FilterType } from '@/hooks/useTypeFilter';
import { usePicksFilter } from '@/hooks/usePicksFilter';
import { useDragGesture } from '@/hooks/useDragGesture';
import { useProximity } from '@/hooks/useProximity';
import type { ProximityLabel, GeoCluster } from '@/hooks/useProximity';
import FilterSortBar from '../ui/FilterSortBar';
import type { SortDirection } from '../ui/FilterSortBar';
import { sortPlaces, defaultDirectionFor } from '@/lib/sort-helpers';
import { TYPE_ICONS, TYPE_COLORS_MUTED, TYPE_BRAND_COLORS, THUMB_GRADIENTS } from '@/constants/placeTypes';
import { TYPE_CHIPS, SOURCE_FILTERS, type SourceFilter } from '@/constants/picksFilters';
import { getDestColor } from '@/lib/destination-helpers';
import { getDisplayLocation } from '@/lib/place-display';
import { isStrongMatch } from '@/lib/match-tier';

const TYPE_LABELS: Record<string, string> = {
  restaurant: 'Restaurant', hotel: 'Hotel', bar: 'Bar', cafe: 'Café',
  museum: 'Museum', activity: 'Activity', neighborhood: 'Neighborhood', shop: 'Shop',
};

// ─── Proximity tier styling (matches PoolTray) ───
const PROXIMITY_TIER_COLORS: Record<string, { bg: string; color: string }> = {
  'same-neighborhood': { bg: 'rgba(58,128,136,0.08)', color: 'var(--t-dark-teal)' },
  'walkable': { bg: 'rgba(58,128,136,0.06)', color: 'var(--t-dark-teal)' },
  'short-ride': { bg: 'rgba(203,178,121,0.1)', color: 'var(--t-ochre, #B8953F)' },
  'across-town': { bg: INK['04'], color: INK['50'] },
  'worth-detour': { bg: 'rgba(232,115,90,0.08)', color: 'var(--t-coral)' },
  'none': { bg: 'transparent', color: 'transparent' },
};

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
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [elsewhereExpanded, setElsewhereExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pool store — slot context + cluster filter
  const { slotContext, clusterFilter, toggleClusterFilter } = usePoolStore();

  // Read currentDay from store (no more day selector — syncs with DayBoardView)
  const currentDay = useTripStore(s => s.currentDay);
  // Use slot context's day when user selects a slot on a different day (e.g. grid view)
  const selectedDay = slotContext?.dayNumber ?? currentDay;

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
    const sorted = sortPlaces(sharedFilteredPicks, sortBy, sortDirection);
    if (hasDestFilter) {
      // Secondary pass: boost items matching destination relevance
      return sorted.sort((a, b) => {
        const aScore = destinationScore(a);
        const bScore = destinationScore(b);
        if (Math.abs(aScore - bScore) > 0.1) return bScore - aScore;
        return 0; // preserve primary sort order
      });
    }
    return sorted;
  }, [sharedFilteredPicks, activeDestination, selectedDay, tripDestinations, destinationScore, sortBy, sortDirection]);

  // ─── Proximity Intelligence ───
  const proximity = useProximity(sortedPicks, selectedDay);

  // Apply cluster filter if active
  const proximityFiltered = useMemo(() => {
    if (!clusterFilter) return sortedPicks;
    return sortedPicks.filter(item => clusterFilter.placeIds.has(item.id));
  }, [sortedPicks, clusterFilter]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allUnplacedPicks.forEach(p => { counts[p.type] = (counts[p.type] || 0) + 1; });
    return counts;
  }, [allUnplacedPicks]);

  // ─── Render a single item row (shared across all proximity modes) ───
  const renderItem = useCallback((
    place: ImportedPlace,
    index: number,
    proximityLabel?: ProximityLabel | null,
    tierStyle?: { bg: string; color: string } | null,
  ) => {
    const typeIcon = TYPE_ICONS[place.type] || 'location';
    const typeColor = TYPE_COLORS_MUTED[place.type] || '#c0ab8e';
    const typeLabel = TYPE_LABELS[place.type] || place.type;
    const brandColor = getDestColor(index);
    const tasteNote = place.enrichment?.description;
    const location = getDisplayLocation(place.location, place.name, place.google?.address);
    const hasDestFilter = activeDestination || (selectedDay === null && tripDestinations.length > 0);
    const dScore = hasDestFilter ? destinationScore(place) : 1;
    const isBeingDragged = dragItemId === place.id;
    const isReturning = returningPlaceId === place.id;
    const isHld = holdingId === place.id;
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
          background: isHld ? `${typeColor}18` : brandColor.bg,
          border: isHld ? `1.5px solid ${typeColor}50` : `1px solid ${brandColor.accent}20`,
          transform: isHld ? 'scale(1.02)' : 'translateX(0)',
          opacity: isBeingDragged ? 0.3 : isReturning ? 0.5 : isPlaced ? 0.35 : dScore < 1 ? 0.35 + dScore * 0.65 : 1,
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
            background: THUMB_GRADIENTS[place.type] || THUMB_GRADIENTS.restaurant,
            marginTop: 1,
          }}
        >
          <PerriandIcon name={typeIcon} size={18} color={TYPE_BRAND_COLORS[place.type as keyof typeof TYPE_BRAND_COLORS] || typeColor} />
          {isStrongMatch(place.matchScore) && (
            <div
              className="absolute"
              style={{
                top: -3, right: -3,
                width: 10, height: 10, borderRadius: '50%',
                background: 'var(--t-dark-teal)',
                border: '1.5px solid white',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              }}
            />
          )}
        </div>

        {/* Text content */}
        <div className="flex flex-col min-w-0 flex-1" style={{ gap: 1 }}>
          <span
            style={{
              fontFamily: FONT.serif, fontSize: 11, fontWeight: 600, fontStyle: 'italic',
              color: TEXT.primary, lineHeight: 1.25,
              display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
            }}
          >
            {place.name}
          </span>
          <span
            style={{
              fontFamily: FONT.mono, fontSize: 9, color: TEXT.secondary, lineHeight: 1.3,
              display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
            }}
          >
            {typeLabel}{location ? ` · ${location}` : ''}{isPlaced ? ' · ✓ placed' : ''}
          </span>
          {/* Proximity label pill */}
          {proximityLabel && proximityLabel.tier !== 'none' && tierStyle && (
            <span
              className="inline-flex items-center gap-0.5 mt-0.5"
              style={{
                fontFamily: FONT.mono, fontSize: 8, fontWeight: 500,
                background: tierStyle.bg, color: tierStyle.color,
                padding: '1px 5px', borderRadius: 4, alignSelf: 'flex-start',
              }}
            >
              <PerriandIcon name="location" size={7} color={tierStyle.color} />
              {proximityLabel.text}
            </span>
          )}
          {tasteNote && (
            <span
              style={{
                fontFamily: FONT.sans, fontSize: 9, color: TEXT.secondary, lineHeight: 1.3, marginTop: 1,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
              }}
            >
              {tasteNote}
            </span>
          )}
        </div>
      </div>
    );
  }, [activeDestination, selectedDay, tripDestinations, destinationScore, dragItemId, returningPlaceId, holdingId, placedIds, handlePointerDown]);

  return (
    <div
      ref={containerRef}
      data-tour="picks-rail"
      className="flex h-full relative"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        width,
        background: isDropTarget ? 'rgba(58,128,136,0.06)' : 'white',
        flexShrink: 0,
        transition: 'background 150ms ease',
        outline: isDropTarget ? '2px dashed var(--t-dark-teal)' : 'none',
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
                color: TEXT.secondary,
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
                background: 'rgba(58,128,136,0.08)',
                color: 'var(--t-dark-teal)',
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
            color: TEXT.secondary,
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
            { value: 'match', label: 'Match Tier' },
            { value: 'recent', label: 'Most recent' },
            { value: 'name', label: 'A–Z' },
          ]}
          sortValue={sortBy}
          onSortChange={(v) => { setSortBy(v as 'match' | 'name' | 'recent'); setSortDirection(defaultDirectionFor(v)); }}
          sortDirection={sortDirection}
          onSortDirectionChange={setSortDirection}
          onResetAll={() => { toggleFilter('all'); setSortBy('match'); setSortDirection('desc'); setSourceFilter('all'); setSearchQuery(''); }}
        />
      </div>

      {/* Search bar */}
      <div className="px-3 py-1.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--t-linen)' }}>
        <div className="relative">
          <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
            <PerriandIcon name="discover" size={12} color={TEXT.secondary} />
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
              color: TEXT.primary,
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
              aria-label="Clear search"
            >
              <PerriandIcon name="close" size={10} color={TEXT.secondary} />
            </button>
          )}
        </div>
      </div>

      {/* Geographic Cluster Chips */}
      {proximity.clusters.length > 0 && (
        <div className="px-3 py-1.5 flex-shrink-0 flex gap-1 flex-wrap" style={{ borderBottom: '1px solid var(--t-linen)' }}>
          {proximity.clusters.map((cluster) => {
            const isActive = clusterFilter?.label === cluster.label;
            return (
              <button
                key={cluster.label}
                onClick={() => toggleClusterFilter(
                  isActive ? null : { label: cluster.label, placeIds: new Set(cluster.placeIds) }
                )}
                className="flex items-center gap-1 transition-all"
                style={{
                  background: isActive ? 'var(--t-dark-teal)' : 'rgba(58,128,136,0.06)',
                  color: isActive ? 'white' : 'var(--t-dark-teal)',
                  border: isActive ? '1px solid var(--t-dark-teal)' : '1px solid rgba(58,128,136,0.15)',
                  borderRadius: 99,
                  padding: '2px 8px',
                  fontFamily: FONT.mono,
                  fontSize: 9,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <PerriandIcon name="location" size={9} color={isActive ? 'white' : 'var(--t-dark-teal)'} />
                {cluster.label}
                <span style={{ opacity: 0.7 }}>{cluster.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Scrollable picks list */}
      <div
        className="flex-1 overflow-y-auto flex flex-col gap-1 py-2 px-2"
        style={{ scrollbarWidth: 'thin' }}
      >
        {/* Slot-selected mode: route-coherence items */}
        {proximity.mode === 'slot-selected' && proximity.slotScored ? (
          proximity.slotScored.map((place, index) => {
            const label = place.routeCoherence.label;
            const tierStyle = label.tier !== 'none' ? PROXIMITY_TIER_COLORS[label.tier] : null;
            return renderItem(place, index, label, tierStyle);
          })
        ) : proximity.mode === 'day-scoped' && proximity.segmented ? (
          <>
            {/* "Fits your day" section */}
            {proximity.segmented.fitsYourDay.length > 0 && (
              <>
                <div
                  className="flex items-center gap-1 px-1 mb-1"
                  style={{ fontFamily: FONT.mono, fontSize: 9, fontWeight: 700, color: 'var(--t-dark-teal)', textTransform: 'uppercase', letterSpacing: 1.2 }}
                >
                  <PerriandIcon name="location" size={9} color="var(--t-dark-teal)" />
                  Fits your day
                  <span style={{ opacity: 0.6, fontWeight: 500 }}>({proximity.segmented.fitsYourDay.length})</span>
                </div>
                {proximity.segmented.fitsYourDay.map((place, index) => {
                  const tierStyle = place.proximityLabel.tier !== 'none' ? PROXIMITY_TIER_COLORS[place.proximityLabel.tier] : null;
                  return renderItem(place, index, place.proximityLabel, tierStyle);
                })}
              </>
            )}
            {/* "Elsewhere" section */}
            {proximity.segmented.elsewhere.length > 0 && (
              <>
                <button
                  onClick={() => setElsewhereExpanded(!elsewhereExpanded)}
                  className="flex items-center gap-1 px-1 mt-3 mb-1 w-full text-left"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: FONT.mono, fontSize: 9, fontWeight: 700, color: TEXT.secondary,
                    textTransform: 'uppercase', letterSpacing: 1.2,
                  }}
                >
                  Elsewhere{proximity.activeDestination ? ` in ${proximity.activeDestination}` : ''}
                  <span style={{ opacity: 0.6, fontWeight: 500 }}>({proximity.segmented.elsewhere.length})</span>
                  <span style={{ fontSize: 7 }}>{elsewhereExpanded ? '\u25BC' : '\u25B6'}</span>
                </button>
                {elsewhereExpanded && proximity.segmented.elsewhere.map((place, index) => {
                  const tierStyle = place.proximityLabel.tier !== 'none' ? PROXIMITY_TIER_COLORS[place.proximityLabel.tier] : null;
                  return renderItem(place, index + (proximity.segmented?.fitsYourDay.length ?? 0), place.proximityLabel, tierStyle);
                })}
              </>
            )}
          </>
        ) : (
          /* Default / cold-start: flat list with cluster filtering */
          proximityFiltered.map((place, index) => renderItem(place, index))
        )}

        {sortedPicks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 px-3">
            <PerriandIcon name="discover" size={20} color={TEXT.secondary} />
            <span
              className="text-center mt-2"
              style={{ fontFamily: FONT.sans, fontSize: 11, color: TEXT.secondary, lineHeight: 1.4 }}
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

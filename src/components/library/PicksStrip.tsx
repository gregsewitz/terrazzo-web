'use client';

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { usePoolStore } from '@/stores/poolStore';
import { ImportedPlace } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT } from '@/constants/theme';
import { useTypeFilter, type FilterType } from '@/hooks/useTypeFilter';
import { usePicksFilter } from '@/hooks/usePicksFilter';
import { useDragGesture } from '@/hooks/useDragGesture';
import { useProximity } from '@/hooks/useProximity';
import type { ProximityLabel } from '@/hooks/useProximity';
import FilterSortBar from '../ui/FilterSortBar';
import type { SortDirection } from '../ui/FilterSortBar';
import { sortPlaces, defaultDirectionFor } from '@/lib/sort-helpers';
import { TYPE_ICONS, TYPE_COLORS_MUTED, TYPE_BRAND_COLORS, THUMB_GRADIENTS } from '@/constants/placeTypes';
import { TYPE_CHIPS, SOURCE_FILTERS, type SourceFilter } from '@/constants/picksFilters';
import { getMatchTier, shouldShowTierBadge } from '@/lib/match-tier';

type SortOption = 'match' | 'name' | 'source' | 'recent';

// ─── Proximity tier styling ───
const PROXIMITY_TIER_COLORS: Record<string, { bg: string; color: string }> = {
  'same-neighborhood': { bg: 'rgba(58,128,136,0.08)', color: 'var(--t-dark-teal)' },
  'walkable': { bg: 'rgba(58,128,136,0.06)', color: 'var(--t-dark-teal)' },
  'short-ride': { bg: 'rgba(203,178,121,0.1)', color: 'var(--t-ochre, #B8953F)' },
  'across-town': { bg: INK['04'], color: INK['50'] },
  'worth-detour': { bg: 'rgba(232,115,90,0.08)', color: 'var(--t-coral)' },
  'none': { bg: 'transparent', color: 'transparent' },
};

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
  /** When set, tapping a card places it directly into this slot instead of opening detail */
  slotTarget?: { dayNumber: number; slotId: string } | null;
  onQuickPlace?: (item: ImportedPlace) => void;
  onClearSlotTarget?: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

function PicksStrip({
  onTapDetail, onDragStart, dragItemId,
  isDropTarget, onRegisterRect, returningPlaceId,
  expandRef, slotTarget, onQuickPlace, onClearSlotTarget,
}: PicksStripProps) {
  const { filter: activeFilter, setFilter: setActiveFilter, toggle: toggleFilter } = useTypeFilter();
  const [sortBy, setSortBy] = useState<SortOption>('match');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const trip = useTripStore(s => s.trips.find(t => t.id === s.currentTripId));
  const currentDay = useTripStore(s => s.currentDay);
  const { slotContext, clusterFilter, toggleClusterFilter } = usePoolStore();
  // Use slot context's day when user selects a slot on a different day
  const selectedDay = slotContext?.dayNumber ?? currentDay;
  const [elsewhereExpanded, setElsewhereExpanded] = useState(false);

  // ─── Shared filtering logic ───
  const {
    activeDestination,
    destinationPicks,
    filteredPicks,
    allUnplacedPicks,
    placedIds,
  } = usePicksFilter({
    selectedDay,
    typeFilter: activeFilter,
    sourceFilter,
    searchQuery,
    slotId: slotContext?.slotId ?? null,
  });

  // ─── Tap handler: quick-place when opened from a slot, otherwise open detail ───
  const handleTap = useCallback((item: ImportedPlace) => {
    if (slotTarget && onQuickPlace) {
      onQuickPlace(item);
    } else {
      onTapDetail(item);
    }
  }, [slotTarget, onQuickPlace, onTapDetail]);

  // ─── Pointer drag gesture (shared hook) ───
  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    holdingId,
  } = useDragGesture({
    onDragActivate: onDragStart,
    onTap: handleTap,
    layout: expanded ? 'vertical' : 'horizontal',
    isDragging: !!dragItemId,
  });

  const stripPlaces = useMemo(() => {
    const sorted = sortPlaces(filteredPicks, sortBy, sortDirection);

    // Boost items matching slot's suggested types when a slot is selected
    const suggestedSet = slotContext?.suggestedTypes.length
      ? new Set(slotContext.suggestedTypes)
      : null;

    if (suggestedSet) {
      return sorted.sort((a, b) => {
        const aBoost = suggestedSet.has(a.type) ? 1 : 0;
        const bBoost = suggestedSet.has(b.type) ? 1 : 0;
        if (aBoost !== bBoost) return bBoost - aBoost;
        return 0;
      });
    }
    return sorted;
  }, [filteredPicks, sortBy, sortDirection, slotContext]);

  // ─── Proximity Intelligence ───
  const proximity = useProximity(stripPlaces, selectedDay);

  // Apply cluster filter if active
  const proximityFiltered = useMemo(() => {
    if (!clusterFilter) return stripPlaces;
    return stripPlaces.filter(item => clusterFilter.placeIds.has(item.id));
  }, [stripPlaces, clusterFilter]);

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

  // ─── Clear slot target when pool collapses ───
  useEffect(() => {
    if (!expanded && slotTarget) onClearSlotTarget?.();
  }, [expanded, slotTarget, onClearSlotTarget]);

  // ─── Render a single grid item (shared across segmented and default modes) ───
  const renderGridItem = useCallback((place: ImportedPlace, proximityLabel?: ProximityLabel | null) => {
    const typeIcon = TYPE_ICONS[place.type] || 'location';
    const typeColor = TYPE_COLORS_MUTED[place.type] || '#c0ab8e';
    const isDragging = dragItemId === place.id;
    const isHolding = holdingId === place.id;
    const isReturning = returningPlaceId === place.id;
    const isPlaced = placedIds.has(place.id);
    const tierStyle = proximityLabel?.tier && proximityLabel.tier !== 'none' ? PROXIMITY_TIER_COLORS[proximityLabel.tier] : null;

    return (
      <div
        key={place.id}
        className="flex flex-col items-center select-none"
        style={{
          opacity: isDragging ? 0.25 : isPlaced ? 0.45 : 1,
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
            background: THUMB_GRADIENTS[place.type] || THUMB_GRADIENTS.restaurant,
            border: isHolding ? `2px solid ${TYPE_BRAND_COLORS[place.type as keyof typeof TYPE_BRAND_COLORS] || typeColor}` : `1px solid ${TYPE_BRAND_COLORS[place.type as keyof typeof TYPE_BRAND_COLORS] || typeColor}30`,
            boxShadow: isHolding ? `0 4px 12px ${TYPE_BRAND_COLORS[place.type as keyof typeof TYPE_BRAND_COLORS] || typeColor}30` : '0 1px 3px rgba(0,0,0,0.04)',
            transition: 'border 0.15s, box-shadow 0.15s',
          }}
        >
          <PerriandIcon name={typeIcon} size={22} color={TYPE_BRAND_COLORS[place.type as keyof typeof TYPE_BRAND_COLORS] || typeColor} />
          {shouldShowTierBadge(place.matchScore) && (
            <div
              className="absolute -top-1 -right-1 flex items-center justify-center rounded-full"
              style={{
                width: 20, height: 20,
                background: getMatchTier(place.matchScore).bg,
                border: `1.5px solid ${getMatchTier(place.matchScore).color}`,
                fontSize: 7, fontWeight: 700,
                color: getMatchTier(place.matchScore).color,
                fontFamily: FONT.mono,
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
              }}
            >
              {getMatchTier(place.matchScore).shortLabel.charAt(0)}
            </div>
          )}
        </div>

        {/* Name */}
        <span
          className="text-[10px] font-medium text-center leading-tight mt-1.5"
          style={{
            color: TEXT.primary,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
            fontFamily: FONT.sans, maxWidth: '100%', lineHeight: '1.2',
          }}
        >
          {place.name}
        </span>

        {/* Proximity label */}
        {proximityLabel && tierStyle && (
          <span
            className="text-[7px] text-center mt-0.5 px-1.5 py-0.5 rounded"
            style={{
              background: tierStyle.bg, color: tierStyle.color,
              fontFamily: FONT.mono, fontWeight: 500,
            }}
          >
            {proximityLabel.text}
          </span>
        )}

        {/* Location hint (only when no proximity label) */}
        {(!proximityLabel || !tierStyle) && (
          <span
            className="text-[8px] text-center mt-0.5"
            style={{
              color: TEXT.secondary, fontFamily: FONT.mono,
              display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
              maxWidth: '100%',
            }}
          >
            {place.location?.split(',')[0]?.trim() || ''}
          </span>
        )}
      </div>
    );
  }, [dragItemId, holdingId, returningPlaceId, placedIds, handlePointerDown]);

  const hasActiveFilters = activeFilter !== 'all' || sourceFilter !== 'all' || sortBy !== 'match' || searchQuery.trim() !== '';

  // ─── Empty state ───
  if (destinationPicks.length === 0 && !searchQuery.trim()) {
    return (
      <div
        className="px-4 pt-2 pb-3"
        style={{ background: 'white', borderTop: '1px solid var(--t-linen)' }}
      >
        <span className="text-[11px]" style={{ color: TEXT.primary, fontFamily: FONT.sans }}>
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
      data-tour="picks-rail"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        background: isDropTarget ? 'rgba(58,128,136,0.04)' : 'white',
        borderTop: isDropTarget ? '2px solid var(--t-dark-teal)' : '1px solid var(--t-linen)',
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
              { value: 'match', label: 'Match Tier' },
              { value: 'recent', label: 'Most recent' },
              { value: 'name', label: 'A–Z' },
              { value: 'source', label: 'Source' },
            ]}
            sortValue={sortBy}
            onSortChange={(v) => { setSortBy(v as SortOption); setSortDirection(defaultDirectionFor(v)); }}
            sortDirection={sortDirection}
            onSortDirectionChange={setSortDirection}
            onResetAll={() => { setActiveFilter('all'); setSortBy('match'); setSortDirection('desc'); setSourceFilter('all'); setSearchQuery(''); }}
          />
        </div>

        {/* Count badge */}
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{
            background: 'rgba(58,128,136,0.08)',
            color: 'var(--t-dark-teal)',
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
            background: expanded ? 'var(--t-dark-teal)' : 'transparent',
            border: expanded ? 'none' : '1px solid rgba(58,128,136,0.2)',
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
              stroke={expanded ? 'white' : 'var(--t-dark-teal)'}
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
            <PerriandIcon name="discover" size={12} color={TEXT.secondary} />
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
              color: TEXT.primary,
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
              aria-label="Clear search"
            >
              <PerriandIcon name="close" size={10} color={TEXT.secondary} />
            </button>
          )}
        </div>
      </div>

      {/* ── Slot Context Banner ── */}
      {slotContext && (
        <div
          className="mx-3 mb-1 px-2.5 py-1.5 rounded-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(58,128,136,0.06) 0%, rgba(58,128,136,0.02) 100%)',
            border: '1px solid rgba(58,128,136,0.15)',
          }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-[10px] font-semibold"
              style={{ color: 'var(--t-dark-teal)', fontFamily: FONT.sans }}
            >
              Picking for {slotContext.slotLabel} · Day {slotContext.dayNumber}
            </span>
            <button
              onClick={() => usePoolStore.getState().setSlotContext(null)}
              className="text-[8px] px-1.5 py-0.5 rounded-full border-none cursor-pointer"
              style={{ background: INK['06'], color: TEXT.secondary }}
            >
              Clear
            </button>
          </div>
          {(slotContext.adjacentPlaces.before || slotContext.adjacentPlaces.after) && (
            <div className="text-[8px] mt-0.5" style={{ color: TEXT.secondary }}>
              {slotContext.adjacentPlaces.before && <span>After {slotContext.adjacentPlaces.before.name}</span>}
              {slotContext.adjacentPlaces.before && slotContext.adjacentPlaces.after && ' · '}
              {slotContext.adjacentPlaces.after && <span>Before {slotContext.adjacentPlaces.after.name}</span>}
            </div>
          )}
        </div>
      )}

      {/* ── Missing coordinates nudge ── */}
      {proximity.missingCoordsNudge && (
        <div
          className="mx-3 mb-1 px-2.5 py-1.5 rounded-lg text-[8px]"
          style={{
            background: 'rgba(203,178,121,0.08)',
            border: '1px solid rgba(203,178,121,0.2)',
            color: 'var(--t-ochre, #B8953F)',
            fontFamily: FONT.mono,
          }}
        >
          <PerriandIcon name="location" size={8} color="var(--t-ochre, #B8953F)" />{' '}
          {proximity.missingCoordsNudge.message}
        </div>
      )}

      {/* ── Geographic Cluster Chips ── */}
      {proximity.clusters.length > 0 && (
        <div className="px-3 pb-1 flex gap-1 flex-wrap">
          {proximity.mode === 'cold-start' && (
            <span className="w-full text-[8px] mb-0.5" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
              Explore by area:
            </span>
          )}
          {proximity.clusters.map((cluster) => {
            const isActive = clusterFilter?.label === cluster.label;
            return (
              <button
                key={cluster.label}
                onClick={() => toggleClusterFilter(
                  isActive ? null : { label: cluster.label, placeIds: new Set(cluster.placeIds) }
                )}
                className="flex items-center gap-0.5 transition-all"
                style={{
                  background: isActive ? 'var(--t-dark-teal)' : 'rgba(58,128,136,0.06)',
                  color: isActive ? 'white' : 'var(--t-dark-teal)',
                  border: isActive ? '1px solid var(--t-dark-teal)' : '1px solid rgba(58,128,136,0.15)',
                  borderRadius: 99,
                  padding: '2px 6px',
                  fontFamily: FONT.mono,
                  fontSize: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <PerriandIcon name="location" size={8} color={isActive ? 'white' : 'var(--t-dark-teal)'} />
                {cluster.label}
                <span style={{ opacity: 0.7 }}>{cluster.count}</span>
                {proximity.mode === 'cold-start' && !isActive && (
                  <span style={{ opacity: 0.5, fontWeight: 400, fontStyle: 'italic' }}>Start here?</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Hint label ── */}
      <div className="px-3 pb-1">
        <span style={{
          fontFamily: FONT.mono,
          fontSize: 8,
          color: isDropTarget ? 'var(--t-dark-teal)' : TEXT.secondary,
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
        /* ── EXPANDED: thumbnail grid with proximity segmentation ── */
        <div
          className="flex-1 overflow-y-auto px-3 pb-3 pt-0.5"
          style={{ scrollbarWidth: 'thin' }}
        >
          {/* Slot-selected or day-scoped: show segmented sections */}
          {proximity.mode === 'day-scoped' && proximity.segmented ? (
            <>
              {/* "Fits your day" section */}
              {proximity.segmented.fitsYourDay.length > 0 && (
                <>
                  <div
                    className="flex items-center gap-1 mb-1.5 mt-0.5"
                    style={{ fontFamily: FONT.mono, fontSize: 8, fontWeight: 700, color: 'var(--t-dark-teal)', textTransform: 'uppercase', letterSpacing: 1 }}
                  >
                    <PerriandIcon name="location" size={8} color="var(--t-dark-teal)" />
                    Fits your day
                    <span style={{ opacity: 0.6, fontWeight: 500 }}>({proximity.segmented.fitsYourDay.length})</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`, gap: 10 }}>
                    {proximity.segmented.fitsYourDay.map((place) => renderGridItem(place, place.proximityLabel))}
                  </div>
                </>
              )}
              {/* "Elsewhere" section */}
              {proximity.segmented.elsewhere.length > 0 && (
                <>
                  <button
                    onClick={() => setElsewhereExpanded(!elsewhereExpanded)}
                    className="flex items-center gap-1 mt-3 mb-1.5 w-full text-left"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: FONT.mono, fontSize: 8, fontWeight: 700, color: TEXT.secondary,
                      textTransform: 'uppercase', letterSpacing: 1,
                    }}
                  >
                    Elsewhere{proximity.activeDestination ? ` in ${proximity.activeDestination}` : ''}
                    <span style={{ opacity: 0.6, fontWeight: 500 }}>({proximity.segmented.elsewhere.length})</span>
                    <span style={{ fontSize: 6 }}>{elsewhereExpanded ? '\u25BC' : '\u25B6'}</span>
                  </button>
                  {elsewhereExpanded && (
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`, gap: 10 }}>
                      {proximity.segmented.elsewhere.map((place) => renderGridItem(place, place.proximityLabel))}
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
              gap: 10,
            }}
          >
            {proximityFiltered.map((place) => renderGridItem(place))}
          </div>
          )}

          {stripPlaces.length === 0 && (
            <div className="flex items-center justify-center w-full py-6">
              <span className="text-[10px]" style={{ color: TEXT.primary }}>
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
          {proximityFiltered.length === 0 ? (
            <div className="flex items-center justify-center w-full py-1">
              <span className="text-[10px]" style={{ color: TEXT.primary }}>
                No picks match this filter
              </span>
            </div>
          ) : (
            <>
              {proximityFiltered.map((place) => {
                const typeIcon = TYPE_ICONS[place.type] || 'location';
                const typeColor = TYPE_COLORS_MUTED[place.type] || '#c0ab8e';
                const isDragging = dragItemId === place.id;
                const isHolding = holdingId === place.id;
                const isReturning = returningPlaceId === place.id;
                const isPlaced = placedIds.has(place.id);

                return (
                  <div
                    key={place.id}
                    className="flex flex-col items-center flex-shrink-0 select-none"
                    style={{
                      width: 68,
                      opacity: isDragging ? 0.25 : isPlaced ? 0.45 : 1,
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
                        background: THUMB_GRADIENTS[place.type] || THUMB_GRADIENTS.restaurant,
                        border: isHolding ? `2px solid ${TYPE_BRAND_COLORS[place.type as keyof typeof TYPE_BRAND_COLORS] || typeColor}` : `1px solid ${TYPE_BRAND_COLORS[place.type as keyof typeof TYPE_BRAND_COLORS] || typeColor}30`,
                        boxShadow: isHolding ? `0 4px 12px ${TYPE_BRAND_COLORS[place.type as keyof typeof TYPE_BRAND_COLORS] || typeColor}30` : '0 1px 3px rgba(0,0,0,0.04)',
                        transition: 'border 0.15s, box-shadow 0.15s',
                      }}
                    >
                      <PerriandIcon name={typeIcon} size={18} color={TYPE_BRAND_COLORS[place.type as keyof typeof TYPE_BRAND_COLORS] || typeColor} />
                      {/* Match tier pip */}
                      {shouldShowTierBadge(place.matchScore) && (
                        <div
                          className="absolute -top-1 -right-1 flex items-center justify-center rounded-full"
                          style={{
                            width: 18,
                            height: 18,
                            background: getMatchTier(place.matchScore).bg,
                            border: `1.5px solid ${getMatchTier(place.matchScore).color}`,
                            fontSize: 7,
                            fontWeight: 700,
                            color: getMatchTier(place.matchScore).color,
                            fontFamily: FONT.mono,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                          }}
                        >
                          {getMatchTier(place.matchScore).shortLabel.charAt(0)}
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <span
                      className="text-[9px] font-medium text-center leading-tight mt-1"
                      style={{
                        color: TEXT.primary,
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

            </>
          )}
        </div>
      )}
    </div>
  );
}

export default React.memo(PicksStrip);

'use client';

import { useMemo, useRef, useCallback, useState } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { useSavedStore } from '@/stores/savedStore';
import { ImportedPlace, PlaceType } from '@/types';

const TYPE_ICONS: Record<string, string> = {
  restaurant: '🍽',
  hotel: '🏨',
  bar: '🍸',
  cafe: '☕',
  museum: '🎨',
  activity: '🎫',
  neighborhood: '📍',
  shop: '🛍',
};

const TYPE_COLORS: Record<string, string> = {
  restaurant: '#c0ab8e',
  hotel: '#b8b0c0',
  bar: '#a8c0b0',
  cafe: '#c8c0b0',
  museum: '#a8b0b8',
  activity: '#a8b8a8',
  neighborhood: '#b8c0a8',
  shop: '#c0b0a0',
};

const HOLD_DELAY = 180;

type FilterType = 'all' | PlaceType;

const TYPE_CHIPS: { value: FilterType; label: string; icon: string }[] = [
  { value: 'restaurant', label: 'Eat', icon: '🍽' },
  { value: 'cafe', label: 'Cafe', icon: '☕' },
  { value: 'bar', label: 'Drink', icon: '🍸' },
  { value: 'museum', label: 'See', icon: '🎨' },
  { value: 'activity', label: 'Do', icon: '🎫' },
  { value: 'hotel', label: 'Stay', icon: '🏨' },
  { value: 'shop', label: 'Shop', icon: '🛍' },
  { value: 'neighborhood', label: 'Walk', icon: '📍' },
];

const SORT_OPTIONS = [
  { value: 'match', label: 'Match score', icon: '◎' },
  { value: 'name', label: 'Name A–Z', icon: 'Aa' },
  { value: 'source', label: 'Source', icon: '⊕' },
] as const;

const SOURCE_FILTERS = [
  { value: 'all', label: 'All sources' },
  { value: 'article', label: 'Articles' },
  { value: 'friend', label: 'Friends' },
  { value: 'email', label: 'Email' },
  { value: 'maps', label: 'Maps' },
] as const;

type SortOption = typeof SORT_OPTIONS[number]['value'];
type SourceFilter = typeof SOURCE_FILTERS[number]['value'];

interface PicksStripProps {
  onTapDetail: (item: ImportedPlace) => void;
  onBrowseAll: () => void;
  onDragStart: (item: ImportedPlace, e: React.PointerEvent) => void;
  dragItemId: string | null;
}

export default function PicksStrip({ onTapDetail, onBrowseAll, onDragStart, dragItemId }: PicksStripProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('match');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  const tripDestinations = useTripStore(s => {
    const trip = s.trips.find(t => t.id === s.currentTripId);
    return trip?.destinations || [trip?.location?.split(',')[0]?.trim()].filter(Boolean);
  });

  const trip = useTripStore(s => s.trips.find(t => t.id === s.currentTripId));
  const myPlaces = useSavedStore(s => s.myPlaces);

  const placedIds = useMemo(() => {
    if (!trip) return new Set<string>();
    const ids = new Set<string>();
    trip.days.forEach(day => {
      day.slots.forEach(slot => {
        slot.places.forEach(p => ids.add(p.id));
      });
    });
    return ids;
  }, [trip]);

  const allStripPlaces = useMemo(() => {
    // Shortlisted places matching trip destinations, excluding already-placed items
    const destLower = (tripDestinations as string[] || []).map(d => d.toLowerCase());
    if (destLower.length === 0) return [];

    return myPlaces.filter(place =>
      place.isShortlisted &&
      !placedIds.has(place.id) &&
      destLower.some(dest => place.location.toLowerCase().includes(dest))
    );
  }, [myPlaces, tripDestinations, placedIds]);

  const filteredPlaces = useMemo(() => {
    let result = allStripPlaces;
    if (activeFilter !== 'all') {
      result = result.filter(p => p.type === activeFilter);
    }
    if (sourceFilter !== 'all') {
      result = result.filter(p => p.ghostSource === sourceFilter);
    }
    return result;
  }, [allStripPlaces, activeFilter, sourceFilter]);

  const stripPlaces = useMemo(() => {
    const sorted = [...filteredPlaces];
    switch (sortBy) {
      case 'match': sorted.sort((a, b) => b.matchScore - a.matchScore); break;
      case 'name': sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'source': sorted.sort((a, b) => (a.ghostSource || '').localeCompare(b.ghostSource || '')); break;
    }
    return sorted;
  }, [filteredPlaces, sortBy]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allStripPlaces.forEach(p => { counts[p.type] = (counts[p.type] || 0) + 1; });
    return counts;
  }, [allStripPlaces]);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdItem = useRef<ImportedPlace | null>(null);

  const handlePointerDown = useCallback((item: ImportedPlace, e: React.PointerEvent) => {
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
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    holdItem.current = null;
  }, []);

  const handleTap = useCallback((item: ImportedPlace) => {
    if (!dragItemId) onTapDetail(item);
  }, [dragItemId, onTapDetail]);

  const hasActiveFilters = activeFilter !== 'all' || sourceFilter !== 'all' || sortBy !== 'match';

  if (allStripPlaces.length === 0) {
    return (
      <div
        className="px-4 py-2"
        style={{ background: 'white', borderTop: '1px solid var(--t-linen)' }}
      >
        <div className="flex items-center justify-between">
          <span
            className="text-[11px]"
            style={{ color: 'rgba(28,26,23,0.85)', fontFamily: "'DM Sans', sans-serif" }}
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
              fontFamily: "'Space Mono', monospace",
            }}
          >
            Browse all →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', borderTop: '1px solid var(--t-linen)' }}>
      {/* Single header row: filter icon + type chips + count + browse all */}
      <div
        className="flex items-center gap-1.5 px-3 pt-2 pb-1.5 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* Filter icon */}
        <button
          onClick={() => setFilterMenuOpen(!filterMenuOpen)}
          className="flex items-center justify-center flex-shrink-0 cursor-pointer transition-all"
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: hasActiveFilters ? 'var(--t-ink)' : 'rgba(28,26,23,0.04)',
            color: hasActiveFilters ? 'white' : 'rgba(28,26,23,0.85)',
            border: hasActiveFilters ? '1px solid var(--t-ink)' : '1px solid var(--t-linen)',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* Type chips — compact */}
        {TYPE_CHIPS.filter(chip => typeCounts[chip.value as string] > 0).map(chip => {
          const isActive = activeFilter === chip.value;
          return (
            <button
              key={chip.value}
              onClick={() => setActiveFilter(isActive ? 'all' : chip.value)}
              className="flex items-center gap-0.5 px-1.5 rounded-full text-[9px] font-medium whitespace-nowrap cursor-pointer transition-all flex-shrink-0"
              style={{
                height: 22,
                background: isActive ? 'var(--t-ink)' : 'white',
                color: isActive ? 'white' : 'rgba(28,26,23,0.9)',
                border: isActive ? '1px solid var(--t-ink)' : '1px solid var(--t-linen)',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <span style={{ fontSize: 10 }}>{chip.icon}</span>
              {chip.label}
            </button>
          );
        })}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Count badge */}
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{
            background: 'rgba(42,122,86,0.08)',
            color: 'var(--t-verde)',
            fontFamily: "'Space Mono', monospace",
          }}
        >
          {activeFilter !== 'all' ? `${stripPlaces.length}/${allStripPlaces.length}` : allStripPlaces.length}
        </span>

        {/* Browse all */}
        <button
          onClick={onBrowseAll}
          className="text-[9px] font-semibold px-2 py-0.5 rounded-full cursor-pointer flex-shrink-0"
          style={{
            background: 'transparent',
            color: 'var(--t-verde)',
            border: '1px solid rgba(42,122,86,0.2)',
            fontFamily: "'Space Mono', monospace",
          }}
        >
          All →
        </button>
      </div>

      {/* Detailed filter menu (Beli-style) — only when open */}
      {filterMenuOpen && (
        <div
          className="mx-3 mb-1.5 p-2.5 rounded-xl"
          style={{
            background: 'white',
            border: '1px solid var(--t-linen)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          }}
        >
          <div className="mb-2.5">
            <span
              className="text-[9px] font-semibold uppercase tracking-wider block mb-1"
              style={{ color: 'rgba(28,26,23,0.8)', fontFamily: "'Space Mono', monospace" }}
            >
              Sort by
            </span>
            <div className="flex gap-1">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium cursor-pointer transition-all"
                  style={{
                    background: sortBy === opt.value ? 'var(--t-ink)' : 'rgba(28,26,23,0.03)',
                    color: sortBy === opt.value ? 'white' : 'rgba(28,26,23,0.9)',
                    border: sortBy === opt.value ? '1px solid var(--t-ink)' : '1px solid var(--t-linen)',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  <span style={{ fontSize: 10 }}>{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-1.5">
            <span
              className="text-[9px] font-semibold uppercase tracking-wider block mb-1"
              style={{ color: 'rgba(28,26,23,0.8)', fontFamily: "'Space Mono', monospace" }}
            >
              Source
            </span>
            <div className="flex flex-wrap gap-1">
              {SOURCE_FILTERS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSourceFilter(opt.value)}
                  className="px-2 py-1 rounded-lg text-[10px] font-medium cursor-pointer transition-all"
                  style={{
                    background: sourceFilter === opt.value ? 'var(--t-ink)' : 'rgba(28,26,23,0.03)',
                    color: sourceFilter === opt.value ? 'white' : 'rgba(28,26,23,0.9)',
                    border: sourceFilter === opt.value ? '1px solid var(--t-ink)' : '1px solid var(--t-linen)',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {hasActiveFilters && (
            <button
              onClick={() => { setActiveFilter('all'); setSortBy('match'); setSourceFilter('all'); }}
              className="text-[9px] font-medium mt-0.5 cursor-pointer"
              style={{ background: 'none', border: 'none', color: 'var(--t-verde)', fontFamily: "'DM Sans', sans-serif" }}
            >
              Reset all
            </button>
          )}
        </div>
      )}

      {/* Horizontal scroll strip — compact cards */}
      <div
        className="flex gap-1.5 px-3 pb-2 overflow-x-auto"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {stripPlaces.length === 0 ? (
          <div className="flex items-center justify-center w-full py-1">
            <span className="text-[10px]" style={{ color: 'rgba(28,26,23,0.8)' }}>
              No picks match this filter
            </span>
          </div>
        ) : (
          stripPlaces.map(place => {
            const typeIcon = TYPE_ICONS[place.type] || '📍';
            const typeColor = TYPE_COLORS[place.type] || '#c0ab8e';
            const isDragging = dragItemId === place.id;

            return (
              <div
                key={place.id}
                className="flex flex-col items-center flex-shrink-0 cursor-pointer select-none"
                style={{
                  width: 62,
                  opacity: isDragging ? 0.3 : 1,
                  transform: isDragging ? 'scale(0.9)' : 'none',
                  transition: 'opacity 0.15s, transform 0.15s',
                  touchAction: 'none',
                }}
                onPointerDown={(e) => handlePointerDown(place, e)}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClick={() => handleTap(place)}
              >
                {/* Icon thumbnail */}
                <div
                  className="w-[42px] h-[42px] rounded-lg flex items-center justify-center mb-0.5"
                  style={{
                    background: `linear-gradient(135deg, ${typeColor}40, ${typeColor}25)`,
                    border: `1px solid ${typeColor}50`,
                    fontSize: 15,
                  }}
                >
                  {typeIcon}
                </div>
                {/* Name only — score hidden */}
                <span
                  className="text-[9px] font-medium text-center leading-tight"
                  style={{
                    color: 'var(--t-ink)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    fontFamily: "'DM Sans', sans-serif",
                    maxWidth: '100%',
                    lineHeight: '1.15',
                  }}
                >
                  {place.name}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

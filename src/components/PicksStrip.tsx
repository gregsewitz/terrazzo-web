'use client';

import { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { useSavedStore } from '@/stores/savedStore';
import { ImportedPlace, PlaceType } from '@/types';
import { PerriandIcon, PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import { useTypeFilter, type FilterType } from '@/hooks/useTypeFilter';
import PlaceSearchInput, { type PlaceSearchResult } from './PlaceSearchInput';
import FilterSortBar from './ui/FilterSortBar';

const TYPE_ICONS: Record<string, PerriandIconName> = {
  restaurant: 'restaurant',
  hotel: 'hotel',
  bar: 'bar',
  cafe: 'cafe',
  museum: 'museum',
  activity: 'activity',
  neighborhood: 'location',
  shop: 'shop',
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

type SortOption = 'match' | 'name' | 'source';
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

export default function PicksStrip({ onTapDetail, onBrowseAll, onDragStart, dragItemId, isDropTarget, onRegisterRect, returningPlaceId }: PicksStripProps) {
  const { filter: activeFilter, setFilter: setActiveFilter, toggle: toggleFilter } = useTypeFilter();
  const [sortBy, setSortBy] = useState<SortOption>('match');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [holdingId, setHoldingId] = useState<string | null>(null); // visual "about to drag" feedback
  const [showAddPlace, setShowAddPlace] = useState(false);

  const trip = useTripStore(s => s.trips.find(t => t.id === s.currentTripId));
  const currentDay = useTripStore(s => s.currentDay);
  const myPlaces = useSavedStore(s => s.myPlaces);
  const addPlace = useSavedStore(s => s.addPlace);

  // Destination for biasing search results
  const activeDestination = useMemo(() => {
    if (!trip) return undefined;
    const day = trip.days.find(d => d.dayNumber === currentDay);
    return day?.destination || trip.location?.split(',')[0]?.trim() || undefined;
  }, [trip, currentDay]);

  // Get the current day's destination info for filtering
  const currentDayInfo = useMemo(() => {
    if (!trip) return { names: [] as string[], geo: null as { lat: number; lng: number } | null };
    const day = trip.days.find(d => d.dayNumber === currentDay);
    const destName = day?.destination;

    // Try to get geo coordinates from geoDestinations
    const geoDest = destName
      ? trip.geoDestinations?.find(g => g.name.toLowerCase() === destName.toLowerCase())
      : trip.geoDestinations?.[0];
    const geo = geoDest?.lat && geoDest?.lng ? { lat: geoDest.lat, lng: geoDest.lng } : null;

    // Name(s) for string matching
    const names = destName
      ? [destName.toLowerCase()]
      : (trip.destinations || [trip.location?.split(',')[0]?.trim()].filter(Boolean) as string[]).map(d => d.toLowerCase());

    return { names, geo };
  }, [trip, currentDay]);

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

  // Match places to the current day's destination using geo-proximity + string matching
  const allStripPlaces = useMemo(() => {
    const unplaced = myPlaces.filter(p => p.isShortlisted && !placedIds.has(p.id));
    if (unplaced.length === 0) return [];

    const { names, geo } = currentDayInfo;
    if (names.length === 0 && !geo) return [];

    // Haversine distance in km (good enough for ~50km radius checks)
    const distKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const GEO_RADIUS_KM = 60; // covers regional destinations like the Cotswolds

    const matched = unplaced.filter(place => {
      // 1. Geo-proximity match (best — works for regions, neighborhoods, etc.)
      const pLat = place.google?.lat;
      const pLng = place.google?.lng;
      if (geo && pLat && pLng) {
        if (distKm(geo.lat, geo.lng, pLat, pLng) <= GEO_RADIUS_KM) return true;
      }
      // 2. String match on location (fallback for places without coordinates)
      if (names.some(dest => place.location.toLowerCase().includes(dest))) return true;
      return false;
    });

    // 3. Only show what actually matches — don't flood with unrelated destinations
    return matched;
  }, [myPlaces, currentDayInfo, placedIds]);

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
    // Record starting position for movement tracking
    pointerStart.current = { x: e.clientX, y: e.clientY };
    holdItem.current = item;
    gestureDecided.current = false;

    // Start hold timer — only fires if pointer hasn't moved horizontally
    const pointerEvent = e;
    holdTimer.current = setTimeout(() => {
      if (holdItem.current && !gestureDecided.current) {
        gestureDecided.current = true;
        onDragStart(holdItem.current, pointerEvent);
        holdItem.current = null;
        setHoldingId(null);
      }
    }, HOLD_DELAY);

    // Show visual hold feedback after a short delay (150ms)
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

    // If horizontal movement exceeds threshold → this is a scroll, cancel drag
    if (Math.abs(dx) > SCROLL_THRESHOLD) {
      gestureDecided.current = true;
      if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
      holdItem.current = null;
      setHoldingId(null);
      return;
    }

    // If vertical movement is significant while held → activate drag immediately
    if (Math.abs(dy) > SCROLL_THRESHOLD && holdItem.current) {
      gestureDecided.current = true;
      if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
      // Synthesize drag start with current position
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
              { value: 'match', label: 'Match score' },
              { value: 'name', label: 'Name A–Z' },
              { value: 'source', label: 'Source' },
            ]}
            sortValue={sortBy}
            onSortChange={(v) => setSortBy(v as SortOption)}
            onResetAll={() => { setActiveFilter('all'); setSortBy('match'); setSourceFilter('all'); }}
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
            fontFamily: FONT.mono,
          }}
        >
          All →
        </button>
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
          // Allow horizontal pan on the strip container itself
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
            const typeColor = TYPE_COLORS[place.type] || '#c0ab8e';
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
                  // Don't set touchAction:none — let browser handle scroll detection.
                  // Our pointerMove handler decides scroll vs drag.
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
                destination={activeDestination}
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
                    isShortlisted: true,
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

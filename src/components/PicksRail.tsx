'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { useSavedStore } from '@/stores/savedStore';
import { ImportedPlace, PlaceType } from '@/types';
import { PerriandIcon, PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import { useTypeFilter, type FilterType } from '@/hooks/useTypeFilter';
import PlaceSearchInput, { type PlaceSearchResult } from './PlaceSearchInput';
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
  onUnplace?: (placeId: string, fromDay: number, fromSlot: string) => void;
  selectedDay: number | null;
  onSelectedDayChange: (day: number | null) => void;
}

function PicksRailInner({ onTapDetail, width, onResizeStart, onUnplace, selectedDay, onSelectedDayChange }: PicksRailProps) {
  const { filter: activeFilter, toggle: toggleFilter } = useTypeFilter();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [sortBy, setSortBy] = useState<'match' | 'name' | 'recent'>('match');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const trip = useTripStore(s => s.trips.find(t => t.id === s.currentTripId));
  const myPlaces = useSavedStore(s => s.myPlaces);
  const addPlace = useSavedStore(s => s.addPlace);

  // Day options for the selector
  const dayOptions = useMemo(() => {
    if (!trip) return [];
    return trip.days.map(d => ({
      dayNumber: d.dayNumber,
      destination: d.destination || trip.location,
      label: `Day ${d.dayNumber}`,
    }));
  }, [trip]);

  // Current day's destination for filtering
  const activeDestination = useMemo(() => {
    if (selectedDay === null || !trip) return null;
    const day = trip.days.find(d => d.dayNumber === selectedDay);
    return day?.destination || trip.location || null;
  }, [selectedDay, trip]);

  const placedIds = useMemo(() => {
    if (!trip) return new Set<string>();
    const ids = new Set<string>();
    trip.days.forEach(day => day.slots.forEach(slot => slot.places.forEach(p => ids.add(p.id))));
    return ids;
  }, [trip]);

  const allPicks = useMemo(() => {
    return myPlaces.filter(p => p.isFavorited && !placedIds.has(p.id));
  }, [myPlaces, placedIds]);

  const filteredPicks = useMemo(() => {
    let picks = allPicks;
    if (activeFilter !== 'all') {
      picks = picks.filter(p => p.type === activeFilter);
    }
    if (sourceFilter !== 'all') {
      picks = picks.filter(p => p.ghostSource === sourceFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      picks = picks.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q) ||
        (p.tasteNote || '').toLowerCase().includes(q)
      );
    }
    return picks;
  }, [allPicks, activeFilter, sourceFilter, searchQuery]);

  // Sort: if a day destination is selected, matching places float to top
  const matchesDestination = useCallback((place: ImportedPlace): boolean => {
    if (!activeDestination) return true;
    const dest = activeDestination.toLowerCase();
    const loc = (place.location || '').toLowerCase();
    return loc.includes(dest) || dest.includes(loc.split(',')[0]?.trim() || '---');
  }, [activeDestination]);

  const sortedPicks = useMemo(() => {
    return [...filteredPicks].sort((a, b) => {
      if (activeDestination) {
        const aMatch = matchesDestination(a) ? 1 : 0;
        const bMatch = matchesDestination(b) ? 1 : 0;
        if (aMatch !== bMatch) return bMatch - aMatch;
      }
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'recent') return (b.addedAt || '').localeCompare(a.addedAt || '');
      return b.matchScore - a.matchScore;
    });
  }, [filteredPicks, activeDestination, matchesDestination, sortBy]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allPicks.forEach(p => { counts[p.type] = (counts[p.type] || 0) + 1; });
    return counts;
  }, [allPicks]);

  return (
    <div
      className="flex h-full relative"
      onDragOver={(e) => {
        // Only accept drops that came from a slot (have from-day data)
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setIsDropTarget(true);
      }}
      onDragLeave={(e) => {
        // Only clear if leaving the rail entirely (not entering a child)
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDropTarget(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDropTarget(false);
        const placeId = e.dataTransfer.getData('text/place-id');
        const fromDay = e.dataTransfer.getData('text/from-day');
        const fromSlot = e.dataTransfer.getData('text/from-slot');
        if (placeId && fromDay && fromSlot && onUnplace) {
          onUnplace(placeId, Number(fromDay), fromSlot);
        }
      }}
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
              {allPicks.length}
            </span>
          </div>
        </div>

        {/* Day selector */}
        {dayOptions.length > 1 && (
          <select
            value={selectedDay ?? ''}
            onChange={(e) => onSelectedDayChange(e.target.value ? Number(e.target.value) : null)}
            style={{
              fontFamily: FONT.sans,
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--t-ink)',
              background: INK['04'],
              border: `1px solid var(--t-linen)`,
              borderRadius: 8,
              padding: '4px 8px',
              cursor: 'pointer',
              appearance: 'none' as const,
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
              paddingRight: 24,
            }}
          >
            <option value="">All days</option>
            {dayOptions.map(d => (
              <option key={d.dayNumber} value={d.dayNumber}>
                {d.label}{d.destination ? ` · ${d.destination}` : ''}
              </option>
            ))}
          </select>
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
          const isDimmed = activeDestination ? !matchesDestination(place) : false;

          return (
            <button
              key={place.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/place-id', place.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onClick={() => onTapDetail(place)}
              onMouseEnter={() => setHoveredId(place.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="flex items-start gap-2 cursor-grab transition-all flex-shrink-0 text-left w-full"
              style={{
                padding: '8px 8px',
                borderRadius: 10,
                background: isHovered ? `${typeColor}12` : 'transparent',
                border: isHovered ? `1px solid ${typeColor}30` : '1px solid transparent',
                transform: isHovered ? 'translateX(2px)' : 'translateX(0)',
                opacity: isDimmed ? 0.4 : 1,
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
                  {typeLabel}{location ? ` · ${location}` : ''}
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
            </button>
          );
        })}

        {sortedPicks.length === 0 && !showAddPlace && (
          <div className="flex flex-col items-center justify-center py-8 px-3">
            <PerriandIcon name="discover" size={20} color={INK['20']} />
            <span
              className="text-center mt-2"
              style={{ fontFamily: FONT.sans, fontSize: 11, color: INK['35'], lineHeight: 1.4 }}
            >
              {allPicks.length === 0 ? 'No unplaced picks' : 'No picks match this filter'}
            </span>
          </div>
        )}

        {/* + Add place — inline search or button */}
        {showAddPlace ? (
          <div
            className="flex-shrink-0 rounded-lg mx-1 mb-1"
            style={{ background: INK['04'], border: `1px dashed ${INK['15']}` }}
          >
            <PlaceSearchInput
              compact
              destination={activeDestination || trip?.location}
              placeholder="Search for a place…"
              onSelect={(result: PlaceSearchResult) => {
                // Create an ImportedPlace and add to library + collection
                const newPlace: ImportedPlace = {
                  id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  name: result.name,
                  type: result.type,
                  location: result.address || activeDestination || trip?.location || '',
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
          <button
            onClick={() => setShowAddPlace(true)}
            className="flex items-center gap-2 flex-shrink-0 mx-1 mb-1 py-2.5 px-3 rounded-lg transition-all"
            style={{
              background: 'transparent',
              border: `1px dashed ${INK['15']}`,
              cursor: 'pointer',
              width: 'calc(100% - 8px)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = INK['04']; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--t-verde)12' }}
            >
              <PerriandIcon name="add" size={14} color="var(--t-verde)" />
            </div>
            <span style={{ fontFamily: FONT.sans, fontSize: 11, fontWeight: 600, color: INK['40'] }}>
              Add a place
            </span>
          </button>
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

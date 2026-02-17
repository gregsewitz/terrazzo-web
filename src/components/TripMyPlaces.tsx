'use client';

import { useMemo, useState } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { useSavedStore } from '@/stores/savedStore';
import { ImportedPlace, PlaceType, GhostSourceType, SOURCE_STYLES } from '@/types';

interface TripMyPlacesProps {
  onTapDetail: (item: ImportedPlace) => void;
}

type PlaceTypeFilter = PlaceType | 'all';
type SourceFilterType = GhostSourceType | 'all';

const TYPE_FILTERS: { value: PlaceTypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'hotel', label: 'Hotels' },
  { value: 'restaurant', label: 'Restaurants' },
  { value: 'bar', label: 'Bars' },
  { value: 'activity', label: 'Experiences' },
  { value: 'cafe', label: 'Cafes' },
  { value: 'shop', label: 'Shops' },
];

const SOURCE_TABS: { value: SourceFilterType; label: string; icon?: string }[] = [
  { value: 'all', label: 'All sources' },
  { value: 'friend', label: 'Friends', icon: '👤' },
  { value: 'maps', label: 'Maps', icon: '📍' },
  { value: 'article', label: 'Articles', icon: '📰' },
  { value: 'email', label: 'Email', icon: '✉' },
  { value: 'manual', label: 'Added', icon: '✎' },
];

export default function TripMyPlaces({ onTapDetail }: TripMyPlacesProps) {
  const myPlaces = useSavedStore(s => s.myPlaces);
  const addToPool = useTripStore(s => s.addToPool);
  const trips = useTripStore(s => s.trips);
  const currentTripId = useTripStore(s => s.currentTripId);
  const trip = useMemo(() => trips.find(t => t.id === currentTripId), [trips, currentTripId]);

  const [typeFilter, setTypeFilter] = useState<PlaceTypeFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilterType>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pool place names for deduplication
  const poolNames = useMemo(() => {
    if (!trip) return new Set<string>();
    return new Set(trip.pool.map(p => p.name.toLowerCase()));
  }, [trip]);

  // Geo-filter: only places matching trip destinations
  const geoFiltered = useMemo(() => {
    if (!trip) return [];
    const dests = (trip.destinations || [trip.location?.split(',')[0]?.trim()].filter(Boolean))
      .map(d => d.toLowerCase());
    if (dests.length === 0) return [];
    return myPlaces.filter(place =>
      dests.some(dest => place.location.toLowerCase().includes(dest))
        && !poolNames.has(place.name.toLowerCase())
    );
  }, [myPlaces, trip, poolNames]);

  // Type filter
  const typeFiltered = useMemo(() => {
    if (typeFilter === 'all') return geoFiltered;
    return geoFiltered.filter(p => p.type === typeFilter);
  }, [geoFiltered, typeFilter]);

  // Source filter
  const filtered = useMemo(() => {
    if (sourceFilter === 'all') return typeFiltered;
    return typeFiltered.filter(p => p.ghostSource === sourceFilter);
  }, [typeFiltered, sourceFilter]);

  // Sort by matchScore descending
  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => b.matchScore - a.matchScore),
  [filtered]);

  // Counts for filter badges
  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    geoFiltered.forEach(p => { c[p.type] = (c[p.type] || 0) + 1; });
    return c;
  }, [geoFiltered]);

  const sourceCounts = useMemo(() => {
    const c: Record<string, number> = {};
    geoFiltered.forEach(p => { c[p.ghostSource || 'manual'] = (c[p.ghostSource || 'manual'] || 0) + 1; });
    return c;
  }, [geoFiltered]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddToPool = () => {
    const toAdd = geoFiltered
      .filter(p => selectedIds.has(p.id))
      .map(p => ({ ...p, id: `from-saved-${p.id}`, status: 'available' as const }));
    if (toAdd.length > 0) {
      addToPool(toAdd);
      setSelectedIds(new Set());
    }
  };

  if (!trip) return null;

  const destLabel = trip.destinations?.join(', ') || trip.location?.split(',')[0]?.trim() || '';

  return (
    <div className="px-4 py-4 pb-48">
      {/* Header */}
      <div className="mb-3">
        <p
          className="text-[11px]"
          style={{ color: 'rgba(28,26,23,0.5)', fontFamily: "'DM Sans', sans-serif" }}
        >
          {geoFiltered.length} saved place{geoFiltered.length !== 1 ? 's' : ''} in {destLabel}
        </p>
      </div>

      {/* Type filter chips */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {TYPE_FILTERS.map(f => {
          const count = f.value === 'all' ? geoFiltered.length : (typeCounts[f.value] || 0);
          if (f.value !== 'all' && count === 0) return null;
          const isActive = typeFilter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className="px-3 py-1.5 rounded-2xl text-[11px] whitespace-nowrap flex-shrink-0"
              style={{
                background: isActive ? 'var(--t-ink)' : 'var(--t-linen)',
                color: isActive ? 'white' : 'var(--t-ink)',
                fontWeight: isActive ? 600 : 500,
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Source filter tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {SOURCE_TABS.map(tab => {
          const count = tab.value === 'all' ? geoFiltered.length : (sourceCounts[tab.value] || 0);
          if (tab.value !== 'all' && count === 0) return null;
          const isActive = sourceFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setSourceFilter(tab.value)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-2xl text-[10px] whitespace-nowrap flex-shrink-0"
              style={{
                background: isActive
                  ? (tab.value === 'all' ? 'var(--t-ink)' : (SOURCE_STYLES[tab.value as GhostSourceType]?.bg || 'rgba(28,26,23,0.06)'))
                  : 'rgba(28,26,23,0.04)',
                color: isActive
                  ? (tab.value === 'all' ? 'white' : (SOURCE_STYLES[tab.value as GhostSourceType]?.color || 'var(--t-ink)'))
                  : 'rgba(28,26,23,0.5)',
                fontWeight: isActive ? 600 : 400,
                border: isActive && tab.value !== 'all'
                  ? `1px solid ${SOURCE_STYLES[tab.value as GhostSourceType]?.color || 'transparent'}`
                  : '1px solid transparent',
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {tab.icon && <span>{tab.icon}</span>}
              <span>{tab.label}</span>
              <span style={{ opacity: 0.6 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Place list */}
      {sorted.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-2xl mb-3 block">◇</span>
          <p className="text-[12px]" style={{ color: 'rgba(28,26,23,0.4)' }}>
            No saved places match these filters
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map(place => {
            const isSelected = selectedIds.has(place.id);
            const sourceStyle = SOURCE_STYLES[place.ghostSource as GhostSourceType] || SOURCE_STYLES.manual;
            const reaction = place.rating ? { myPlace: '♡', enjoyed: '◆', mixed: '◇', notMe: '–' }[place.rating.reaction] : null;

            return (
              <div
                key={place.id}
                className="flex gap-2.5 p-3 rounded-xl transition-all"
                style={{
                  background: isSelected ? 'rgba(42,122,86,0.03)' : 'white',
                  border: isSelected ? '1.5px solid var(--t-verde)' : '1px solid var(--t-linen)',
                }}
              >
                {/* Select toggle */}
                <button
                  onClick={() => toggleSelect(place.id)}
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                  style={{
                    background: isSelected ? 'var(--t-verde)' : 'rgba(28,26,23,0.06)',
                    color: isSelected ? 'white' : 'rgba(28,26,23,0.3)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  {isSelected ? '✓' : ''}
                </button>

                {/* Card body — tappable for detail */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => onTapDetail(place)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[12px] font-semibold" style={{ color: 'var(--t-ink)' }}>
                      {place.name}
                    </div>
                    {/* Match score */}
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                      style={{
                        background: 'rgba(200,146,58,0.08)',
                        color: 'var(--t-honey)',
                        fontFamily: "'Space Mono', monospace",
                      }}
                    >
                      {place.matchScore}%
                    </span>
                  </div>
                  <div className="text-[10px] mb-1.5" style={{ color: 'rgba(28,26,23,0.5)' }}>
                    {place.type.charAt(0).toUpperCase() + place.type.slice(1)} · {place.location}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Source badge */}
                    <span
                      className="text-[9px] font-semibold px-2 py-0.5 rounded-md"
                      style={{ background: sourceStyle.bg, color: sourceStyle.color }}
                    >
                      {sourceStyle.icon} {place.source?.name || sourceStyle.label}
                    </span>
                    {/* Friend attribution */}
                    {place.friendAttribution && (
                      <span
                        className="text-[9px] font-semibold px-2 py-0.5 rounded-md"
                        style={{ background: 'rgba(42,122,86,0.06)', color: 'var(--t-verde)' }}
                      >
                        👤 {place.friendAttribution.name}
                      </span>
                    )}
                    {/* Rating reaction */}
                    {reaction && (
                      <span className="text-[10px]" style={{ color: 'rgba(28,26,23,0.4)' }}>
                        {reaction}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky action bar */}
      {selectedIds.size > 0 && (
        <div
          className="fixed left-0 right-0 z-40 px-4 py-3"
          style={{
            bottom: 52,
            maxWidth: 480,
            margin: '0 auto',
            background: 'rgba(248,243,234,0.95)',
            borderTop: '1px solid var(--t-linen)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <button
            onClick={handleAddToPool}
            className="w-full py-3 rounded-xl text-[13px] font-semibold transition-all"
            style={{
              background: 'var(--t-verde)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Add {selectedIds.size} place{selectedIds.size !== 1 ? 's' : ''} to pool
          </button>
        </div>
      )}
    </div>
  );
}

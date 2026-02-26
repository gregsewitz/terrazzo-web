'use client';

import { useMemo, useState } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { useSavedStore } from '@/stores/savedStore';
import { ImportedPlace, PlaceType, GhostSourceType, SOURCE_STYLES } from '@/types';
import { PerriandIcon, PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import { useTypeFilter, type FilterType } from '@/hooks/useTypeFilter';
import { usePicksFilter } from '@/hooks/usePicksFilter';
import FilterSortBar from './ui/FilterSortBar';
import PlaceSearchInput, { type PlaceSearchResult } from './PlaceSearchInput';
import { TYPE_ICONS } from '@/constants/placeTypes';
import { distKm, GEO_RADIUS_KM } from '@/hooks/usePicksFilter';

const TYPE_CHIPS: { value: FilterType; label: string; icon: PerriandIconName }[] = [
  { value: 'all', label: 'All', icon: 'discover' },
  { value: 'restaurant', label: 'Eat', icon: 'restaurant' },
  { value: 'cafe', label: 'Cafe', icon: 'cafe' },
  { value: 'bar', label: 'Drink', icon: 'bar' },
  { value: 'museum', label: 'See', icon: 'museum' },
  { value: 'activity', label: 'Do', icon: 'activity' },
  { value: 'neighborhood', label: 'Walk', icon: 'location' },
  { value: 'shop', label: 'Shop', icon: 'shop' },
  { value: 'hotel', label: 'Stay', icon: 'hotel' },
];

interface BrowseAllOverlayProps {
  onClose: () => void;
  onTapDetail: (item: ImportedPlace) => void;
  initialFilter?: PlaceType;
}

export default function BrowseAllOverlay({ onClose, onTapDetail, initialFilter }: BrowseAllOverlayProps) {
  const { filter: filterType, setFilter: setFilterType, toggle: toggleFilter } = useTypeFilter(initialFilter || 'all');
  const toggleStar = useSavedStore(s => s.toggleStar);
  const addPlace = useSavedStore(s => s.addPlace);
  const myPlaces = useSavedStore(s => s.myPlaces);
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [sortBy, setSortBy] = useState<'match' | 'name' | 'type' | 'source'>('match');

  // Use shared hook to get geo points and trip destinations (reuses all the resolution logic)
  const {
    tripDestinations,
    activeGeoPoints,
  } = usePicksFilter({
    selectedDay: null, // BrowseAll = all destinations
    typeFilter: 'all',
    sourceFilter: 'all',
    searchQuery: '',
  });

  // BrowseAll shows ALL myPlaces (including non-favorited), filtered to trip destinations
  const destinationPlaces = useMemo(() => {
    if (tripDestinations.length === 0 && activeGeoPoints.length === 0) return myPlaces;
    const destLower = tripDestinations.map(d => d.toLowerCase());

    return myPlaces.filter(place => {
      // Geo-proximity check
      const pLat = place.google?.lat;
      const pLng = place.google?.lng;
      if (pLat && pLng && activeGeoPoints.length > 0) {
        if (activeGeoPoints.some(geo => distKm(geo.lat, geo.lng, pLat, pLng) <= GEO_RADIUS_KM)) {
          return true;
        }
      }
      // String match fallback
      const loc = (place.location || '').toLowerCase();
      return destLower.some(dest => loc.includes(dest) || dest.includes(loc.split(',')[0]?.trim() || '---'));
    });
  }, [myPlaces, tripDestinations, activeGeoPoints]);

  // Apply type filter
  const filteredPlaces = useMemo(() => {
    if (filterType === 'all') return destinationPlaces;
    return destinationPlaces.filter(p => p.type === filterType);
  }, [destinationPlaces, filterType]);

  // Sort: starred always first, then by selected sort
  const sortedPlaces = useMemo(() => {
    return [...filteredPlaces].sort((a, b) => {
      // Starred always float to top
      const aStarred = a.isFavorited ? 1 : 0;
      const bStarred = b.isFavorited ? 1 : 0;
      if (bStarred !== aStarred) return bStarred - aStarred;

      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'type') return a.type.localeCompare(b.type) || b.matchScore - a.matchScore;
      if (sortBy === 'source') {
        const aSource = (a.ghostSource || 'manual');
        const bSource = (b.ghostSource || 'manual');
        return aSource.localeCompare(bSource) || b.matchScore - a.matchScore;
      }
      // Default: match score descending
      return b.matchScore - a.matchScore;
    });
  }, [filteredPlaces, sortBy]);

  const starredCount = useMemo(() =>
    destinationPlaces.filter(p => p.isFavorited).length,
    [destinationPlaces]
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ height: '100dvh', maxWidth: 600, margin: '0 auto' }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.3)' }}
        onClick={onClose}
      />

      {/* Content */}
      <div
        className="relative flex flex-col mt-12 rounded-t-2xl overflow-hidden"
        style={{
          background: 'var(--t-cream)',
          flex: 1,
          boxShadow: '0 -10px 40px rgba(0,0,0,0.12)',
        }}
      >
        {/* Handle + Header */}
        <div className="flex items-center justify-center pt-2 pb-1">
          <div style={{ width: 40, height: 4, background: 'var(--t-linen)', borderRadius: 2 }} />
        </div>

        <div className="flex items-center justify-between px-4 pb-2">
          <div>
            <h2
              className="text-[18px] m-0"
              style={{ fontFamily: FONT.serif, fontStyle: 'italic', color: 'var(--t-ink)' }}
            >
              Browse all
            </h2>
            <span className="text-[11px]" style={{ color: INK['85'] }}>
              {starredCount} picked · {destinationPlaces.length} saved for this destination
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: INK['06'], border: 'none', cursor: 'pointer', color: INK['90'] }}
            aria-label="Close"
          >
            <PerriandIcon name="close" size={16} />
          </button>
        </div>

        {/* Filter & Sort */}
        <div className="px-4 pb-2">
          <FilterSortBar
            filterGroups={[{
              key: 'type',
              label: 'Type',
              options: TYPE_CHIPS.map(c => ({ value: c.value, label: c.label, icon: c.icon })),
              value: filterType,
              onChange: (v) => setFilterType(v as FilterType),
            }]}
            sortOptions={[
              { value: 'match', label: 'Match %' },
              { value: 'name', label: 'A–Z' },
              { value: 'type', label: 'Type' },
              { value: 'source', label: 'Source' },
            ]}
            sortValue={sortBy}
            onSortChange={(v) => setSortBy(v as 'match' | 'name' | 'type' | 'source')}
            onResetAll={() => { setFilterType('all'); setSortBy('match'); }}
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 pb-20" style={{ scrollbarWidth: 'thin' }}>
          {/* + Add place */}
          {showAddPlace ? (
            <div
              className="rounded-xl mb-2 overflow-hidden"
              style={{ background: 'white', border: '1.5px dashed var(--t-verde)' }}
            >
              <PlaceSearchInput
                destination={tripDestinations?.[0] || undefined}
                suggestedType={initialFilter}
                placeholder="Search for a place…"
                onSelect={(result: PlaceSearchResult) => {
                  const newPlace: ImportedPlace = {
                    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    name: result.name,
                    type: result.type,
                    location: result.address || (tripDestinations as string[])?.[0] || '',
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
              className="flex items-center gap-2.5 w-full p-3 rounded-xl mb-2 cursor-pointer transition-all"
              style={{ background: 'white', border: '1px dashed var(--t-linen)' }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(42,122,86,0.08)' }}
              >
                <PerriandIcon name="add" size={16} color="var(--t-verde)" />
              </div>
              <span style={{ fontFamily: FONT.sans, fontSize: 12, fontWeight: 600, color: 'var(--t-verde)' }}>
                Add a new place
              </span>
            </button>
          )}

          {sortedPlaces.map(place => {
            const isStarred = place.isFavorited;
            const typeIcon = TYPE_ICONS[place.type] || 'location';
            const sourceStyle = SOURCE_STYLES[place.ghostSource as GhostSourceType] || SOURCE_STYLES.manual;

            return (
              <div
                key={place.id}
                onClick={() => onTapDetail(place)}
                className="flex gap-2.5 p-3 rounded-xl mb-2 cursor-pointer transition-all"
                style={{
                  background: isStarred ? 'rgba(42,122,86,0.03)' : 'white',
                  border: isStarred ? '1.5px solid var(--t-verde)' : '1px solid var(--t-linen)',
                }}
              >
                {/* Type icon */}
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: INK['04'] }}
                >
                  <PerriandIcon name={typeIcon} size={14} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold truncate" style={{ color: 'var(--t-ink)' }}>
                        {place.name}
                      </div>
                      <div className="text-[10px]" style={{ color: INK['90'] }}>
                        {place.location}
                      </div>
                    </div>

                    {/* Star toggle */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStar(place.id); }}
                      className="w-7 h-7 rounded-full flex items-center justify-center transition-all flex-shrink-0"
                      style={{
                        background: isStarred ? 'var(--t-verde)' : INK['06'],
                        color: isStarred ? 'white' : INK['85'],
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      <PerriandIcon name="star" size={12} color={isStarred ? 'white' : INK['85']} />
                    </button>
                  </div>

                  {/* Source + match score */}
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="text-[9px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1"
                      style={{ background: sourceStyle.bg, color: sourceStyle.color }}
                    >
                      <PerriandIcon name={sourceStyle.icon} size={9} color={sourceStyle.color} /> {place.ghostSource === 'friend'
                        ? place.friendAttribution?.name
                        : sourceStyle.label}
                    </span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: 'rgba(42,122,86,0.08)',
                        color: 'var(--t-verde)',
                        fontFamily: FONT.mono,
                      }}
                    >
                      {place.matchScore}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {sortedPlaces.length === 0 && (
            <div className="text-center py-16">
              <div className="text-3xl mb-3 flex justify-center">
                <PerriandIcon name="discover" size={36} color={INK['50']} />
              </div>
              <p className="text-[13px] mb-1" style={{ color: INK['90'] }}>
                No saved places for this destination
              </p>
              <p className="text-[11px]" style={{ color: INK['85'] }}>
                Import places in Collect to see them here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

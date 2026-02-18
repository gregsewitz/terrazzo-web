'use client';

import { useMemo, useState } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { useSavedStore } from '@/stores/savedStore';
import { ImportedPlace, PlaceType, GhostSourceType, SOURCE_STYLES } from '@/types';

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

type FilterType = 'all' | PlaceType;

const TYPE_CHIPS: { value: FilterType; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: '◎' },
  { value: 'restaurant', label: 'Eat', icon: '🍽' },
  { value: 'cafe', label: 'Cafe', icon: '☕' },
  { value: 'bar', label: 'Drink', icon: '🍸' },
  { value: 'museum', label: 'See', icon: '🎨' },
  { value: 'activity', label: 'Do', icon: '🎫' },
  { value: 'neighborhood', label: 'Walk', icon: '📍' },
  { value: 'shop', label: 'Shop', icon: '🛍' },
  { value: 'hotel', label: 'Stay', icon: '🏨' },
];

interface BrowseAllOverlayProps {
  onClose: () => void;
  onTapDetail: (item: ImportedPlace) => void;
  initialFilter?: PlaceType;
}

export default function BrowseAllOverlay({ onClose, onTapDetail, initialFilter }: BrowseAllOverlayProps) {
  const [filterType, setFilterType] = useState<FilterType>(initialFilter || 'all');
  const toggleStar = useSavedStore(s => s.toggleStar);
  const myPlaces = useSavedStore(s => s.myPlaces);

  const tripDestinations = useTripStore(s => {
    const trip = s.trips.find(t => t.id === s.currentTripId);
    return trip?.destinations || [trip?.location?.split(',')[0]?.trim()].filter(Boolean);
  });

  // All saved places filtered to trip destination
  const destinationPlaces = useMemo(() => {
    if (!tripDestinations || tripDestinations.length === 0) return myPlaces;
    const destLower = (tripDestinations as string[]).map(d => d.toLowerCase());
    return myPlaces.filter(place =>
      destLower.some(dest => place.location.toLowerCase().includes(dest))
    );
  }, [myPlaces, tripDestinations]);

  // Apply type filter
  const filteredPlaces = useMemo(() => {
    if (filterType === 'all') return destinationPlaces;
    return destinationPlaces.filter(p => p.type === filterType);
  }, [destinationPlaces, filterType]);

  // Sort: starred first, then by match score
  const sortedPlaces = useMemo(() => {
    return [...filteredPlaces].sort((a, b) => {
      const aStarred = a.isShortlisted ? 1 : 0;
      const bStarred = b.isShortlisted ? 1 : 0;
      if (bStarred !== aStarred) return bStarred - aStarred;
      return b.matchScore - a.matchScore;
    });
  }, [filteredPlaces]);

  const starredCount = useMemo(() =>
    destinationPlaces.filter(p => p.isShortlisted).length,
    [destinationPlaces]
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ maxWidth: 480, margin: '0 auto' }}>
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
              style={{ fontFamily: "'DM Serif Display', serif", fontStyle: 'italic', color: 'var(--t-ink)' }}
            >
              Browse all
            </h2>
            <span className="text-[11px]" style={{ color: 'rgba(28,26,23,0.85)' }}>
              {starredCount} picked · {destinationPlaces.length} saved for this destination
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
            style={{ background: 'rgba(28,26,23,0.06)', border: 'none', cursor: 'pointer', color: 'rgba(28,26,23,0.9)' }}
          >
            ✕
          </button>
        </div>

        {/* Type filter chips */}
        <div
          className="flex gap-1.5 px-4 pb-3 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {TYPE_CHIPS.map(chip => {
            const isActive = filterType === chip.value;
            return (
              <button
                key={chip.value}
                onClick={() => setFilterType(isActive ? 'all' : chip.value)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap cursor-pointer transition-all flex-shrink-0"
                style={{
                  background: isActive ? 'var(--t-ink)' : 'white',
                  color: isActive ? 'white' : 'rgba(28,26,23,0.9)',
                  border: isActive ? '1px solid var(--t-ink)' : '1px solid var(--t-linen)',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <span>{chip.icon}</span>
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 pb-20" style={{ scrollbarWidth: 'thin' }}>
          {sortedPlaces.map(place => {
            const isStarred = place.isShortlisted;
            const typeIcon = TYPE_ICONS[place.type] || '📍';
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
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: 'rgba(28,26,23,0.04)' }}
                >
                  {typeIcon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold truncate" style={{ color: 'var(--t-ink)' }}>
                        {place.name}
                      </div>
                      <div className="text-[10px]" style={{ color: 'rgba(28,26,23,0.9)' }}>
                        {place.location}
                      </div>
                    </div>

                    {/* Star toggle */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStar(place.id); }}
                      className="w-7 h-7 rounded-full flex items-center justify-center transition-all flex-shrink-0"
                      style={{
                        background: isStarred ? 'var(--t-verde)' : 'rgba(28,26,23,0.06)',
                        color: isStarred ? 'white' : 'rgba(28,26,23,0.85)',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      {isStarred ? '★' : '☆'}
                    </button>
                  </div>

                  {/* Source + match score */}
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="text-[9px] font-semibold px-2 py-0.5 rounded-md"
                      style={{ background: sourceStyle.bg, color: sourceStyle.color }}
                    >
                      {sourceStyle.icon} {place.ghostSource === 'friend'
                        ? place.friendAttribution?.name
                        : sourceStyle.label}
                    </span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: 'rgba(42,122,86,0.08)',
                        color: 'var(--t-verde)',
                        fontFamily: "'Space Mono', monospace",
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
              <span className="text-3xl mb-3 block">◇</span>
              <p className="text-[13px] mb-1" style={{ color: 'rgba(28,26,23,0.9)' }}>
                No saved places for this destination
              </p>
              <p className="text-[11px]" style={{ color: 'rgba(28,26,23,0.85)' }}>
                Import places in Collect to see them here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

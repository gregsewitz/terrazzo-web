'use client';

import React, { useMemo, useState } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { useSavedStore } from '@/stores/savedStore';
import { ImportedPlace, PlaceType, SOURCE_STYLES, GhostSourceType } from '@/types';
import { PerriandIcon, PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import { useTypeFilter, type FilterType } from '@/hooks/useTypeFilter';
import FilterSortBar from './ui/FilterSortBar';
import { TYPE_ICONS, TYPE_COLORS_MUTED } from '@/constants/placeTypes';

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

interface PicksGridProps {
  onTapDetail: (item: ImportedPlace) => void;
}

function PicksGridInner({ onTapDetail }: PicksGridProps) {
  const { filter: activeFilter, toggle: toggleFilter } = useTypeFilter();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'match' | 'name'>('match');

  const trip = useTripStore(s => s.trips.find(t => t.id === s.currentTripId));
  const myPlaces = useSavedStore(s => s.myPlaces);

  const placedIds = useMemo(() => {
    if (!trip) return new Set<string>();
    const ids = new Set<string>();
    trip.days.forEach(day => day.slots.forEach(slot => slot.places.forEach(p => ids.add(p.id))));
    return ids;
  }, [trip]);

  const allPicks = useMemo(() => {
    return myPlaces.filter(p => !placedIds.has(p.id));
  }, [myPlaces, placedIds]);

  const filteredPicks = useMemo(() => {
    let result = allPicks;
    if (activeFilter !== 'all') {
      result = result.filter(p => p.type === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) || p.location.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => sortBy === 'name' ? a.name.localeCompare(b.name) : b.matchScore - a.matchScore);
  }, [allPicks, activeFilter, searchQuery, sortBy]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allPicks.forEach(p => { counts[p.type] = (counts[p.type] || 0) + 1; });
    return counts;
  }, [allPicks]);

  return (
    <div className="flex flex-col h-full" style={{ background: 'white' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderBottom: '1px solid var(--t-linen)' }}
      >
        <div className="flex items-center gap-2">
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

        {/* Search input */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ background: INK['03'], border: '1px solid var(--t-linen)', width: 180 }}
        >
          <PerriandIcon name="discover" size={12} color={INK['40']} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search picks..."
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: FONT.sans,
              fontSize: 11,
              color: 'var(--t-ink)',
              width: '100%',
            }}
          />
        </div>
      </div>

      {/* Filter */}
      <div className="px-4 py-1.5" style={{ borderBottom: '1px solid var(--t-linen)' }}>
        <FilterSortBar
          compact
          filterGroups={[{
            key: 'type',
            label: 'Type',
            options: TYPE_CHIPS.filter(c => typeCounts[c.value as string] > 0).map(c => ({ value: c.value, label: c.label, icon: c.icon })),
            value: activeFilter,
            onChange: (v) => toggleFilter(v as FilterType),
          }]}
          sortOptions={[
            { value: 'match', label: 'Match %' },
            { value: 'name', label: 'A–Z' },
          ]}
          sortValue={sortBy}
          onSortChange={(v) => setSortBy(v as any)}
          onResetAll={() => { toggleFilter('all'); setSortBy('match'); }}
        />
      </div>

      {/* Grid of picks */}
      <div
        className="flex-1 overflow-y-auto px-3 py-2"
        style={{ scrollbarWidth: 'thin' }}
      >
        {filteredPicks.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span style={{ fontFamily: FONT.sans, fontSize: 12, color: INK['40'] }}>
              {allPicks.length === 0 ? 'No unplaced picks' : 'No picks match this filter'}
            </span>
          </div>
        ) : (
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
          >
            {filteredPicks.map(place => {
              const typeIcon = TYPE_ICONS[place.type] || 'location';
              const typeColor = TYPE_COLORS_MUTED[place.type] || '#c0ab8e';
              const srcStyle = SOURCE_STYLES[(place.ghostSource as GhostSourceType) || 'manual'] || SOURCE_STYLES.manual;

              return (
                <div
                  key={place.id}
                  onClick={() => onTapDetail(place)}
                  className="rounded-xl cursor-pointer transition-all hover:shadow-md"
                  style={{
                    background: `linear-gradient(135deg, ${typeColor}18, ${typeColor}08)`,
                    border: `1px solid ${typeColor}30`,
                    padding: '10px 12px',
                  }}
                >
                  <div className="flex items-start gap-2">
                    {/* Type icon */}
                    <div
                      className="flex-shrink-0 rounded-lg flex items-center justify-center"
                      style={{
                        width: 32,
                        height: 32,
                        background: `${typeColor}25`,
                      }}
                    >
                      <PerriandIcon name={typeIcon} size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-[12px] font-semibold truncate"
                        style={{ color: 'var(--t-ink)', fontFamily: FONT.sans }}
                      >
                        {place.name}
                      </div>
                      <div
                        className="text-[10px] truncate"
                        style={{ color: INK['50'], fontFamily: FONT.sans }}
                      >
                        {place.location}
                      </div>
                    </div>
                  </div>

                  {/* Bottom row: match score + source */}
                  <div className="flex items-center justify-between mt-2">
                    <span
                      className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                      style={{
                        background: 'rgba(42,122,86,0.1)',
                        color: 'var(--t-verde)',
                        fontFamily: FONT.mono,
                      }}
                    >
                      {place.matchScore}%
                    </span>
                    <span
                      className="flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: srcStyle.bg, color: srcStyle.color, fontFamily: FONT.mono }}
                    >
                      <PerriandIcon name={srcStyle.icon} size={8} color={srcStyle.color} />
                      {srcStyle.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const PicksGrid = React.memo(PicksGridInner);
PicksGrid.displayName = 'PicksGrid';
export default PicksGrid;

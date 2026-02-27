'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { useSavedStore } from '@/stores/savedStore';
import { ImportedPlace, PlaceType } from '@/types';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import { TYPE_ICONS as CANONICAL_TYPE_ICONS } from '@/constants/placeTypes';

// Extend canonical TYPE_ICONS with dreaming-specific subtypes
const TYPE_ICONS: Record<string, PerriandIconName> = {
  ...CANONICAL_TYPE_ICONS,
  park: 'activity',
  beach: 'activity',
  sight: 'location',
};

// ─── Category filter pills ───
const CATEGORIES: { key: PlaceType | 'all'; label: string; icon: PerriandIconName }[] = [
  { key: 'all', label: 'All', icon: 'discover' },
  { key: 'restaurant', label: 'Food', icon: 'restaurant' },
  { key: 'bar', label: 'Drinks', icon: 'bar' },
  { key: 'cafe', label: 'Coffee', icon: 'cafe' },
  { key: 'hotel', label: 'Stay', icon: 'hotel' },
  { key: 'museum', label: 'Culture', icon: 'museum' },
  { key: 'activity', label: 'Do', icon: 'activity' },
  { key: 'shop', label: 'Shop', icon: 'shop' },
];

interface DreamingBoardProps {
  onTapDetail: (item: ImportedPlace) => void;
  onGraduate: () => void; // trigger the "ready to plan" flow
}

export default function DreamingBoard({ onTapDetail, onGraduate }: DreamingBoardProps) {
  // Use stable selectors — calling store methods in selectors returns new refs every render
  const trips = useTripStore(s => s.trips);
  const currentTripId = useTripStore(s => s.currentTripId);
  const trip = useMemo(() => trips.find(t => t.id === currentTripId), [trips, currentTripId]);
  const poolItems = useMemo(
    () => trip?.pool.filter(p => p.status !== 'rejected') ?? [],
    [trip],
  );
  const myPlaces = useSavedStore(s => s.myPlaces);
  const [filter, setFilter] = useState<PlaceType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'added' | 'type' | 'match'>('added');

  // Combine pool items + all saved places relevant to trip destinations
  const allItems = useMemo(() => {
    const destinations = trip?.destinations || [];
    const poolIds = new Set(poolItems.map(p => p.id));

    // Include pool items + any saved places matching trip destinations
    const items = [...poolItems];
    if (destinations.length > 0) {
      for (const place of myPlaces) {
        if (poolIds.has(place.id)) continue;
        const placeLocation = (place.location || '').toLowerCase();
        const matches = destinations.some(d => placeLocation.includes(d.toLowerCase()));
        if (matches) items.push(place);
      }
    }

    return items;
  }, [poolItems, myPlaces, trip]);

  // Apply filter
  const filteredItems = useMemo(() => {
    let items = filter === 'all' ? allItems : allItems.filter(p => p.type === filter);

    // Sort
    if (sortBy === 'match') {
      items = [...items].sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    } else if (sortBy === 'type') {
      items = [...items].sort((a, b) => (a.type || '').localeCompare(b.type || ''));
    }

    return items;
  }, [allItems, filter, sortBy]);

  // Group by destination for display
  const groupedByDest = useMemo(() => {
    if (!trip?.destinations || trip.destinations.length <= 1) return null;

    const groups: Record<string, ImportedPlace[]> = {};
    const other: ImportedPlace[] = [];

    for (const item of filteredItems) {
      const loc = (item.location || '').toLowerCase();
      const matchedDest = trip.destinations.find(d => loc.includes(d.toLowerCase()));
      if (matchedDest) {
        if (!groups[matchedDest]) groups[matchedDest] = [];
        groups[matchedDest].push(item);
      } else {
        other.push(item);
      }
    }

    if (other.length > 0) groups['Other'] = other;
    return groups;
  }, [filteredItems, trip]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="px-5 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--t-linen)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2
              className="text-lg mb-0.5"
              style={{ fontFamily: FONT.serif, fontStyle: 'italic', color: 'var(--t-ink)', margin: 0 }}
            >
              Dream Board
            </h2>
            <p className="text-[11px]" style={{ color: INK['50'], fontFamily: FONT.sans }}>
              Collect places, build your inspiration. Set dates when you're ready to plan.
            </p>
          </div>

          <button
            onClick={onGraduate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full cursor-pointer btn-hover flex-shrink-0"
            style={{
              background: 'var(--t-verde)',
              border: 'none',
              fontFamily: FONT.sans,
              fontSize: 12,
              fontWeight: 600,
              color: 'white',
            }}
          >
            <PerriandIcon name="pin" size={13} color="white" />
            Ready to Plan
          </button>
        </div>

        {/* Category filter pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setFilter(cat.key)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full border cursor-pointer transition-all whitespace-nowrap"
              style={{
                background: filter === cat.key ? 'var(--t-ink)' : 'white',
                color: filter === cat.key ? 'white' : INK['70'],
                borderColor: filter === cat.key ? 'var(--t-ink)' : 'var(--t-linen)',
                fontFamily: FONT.sans,
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              <PerriandIcon
                name={cat.icon}
                size={12}
                color={filter === cat.key ? 'white' : INK['50']}
              />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto px-5 py-4"
        style={{ scrollbarWidth: 'none' }}
      >
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <PerriandIcon name="star" size={40} color={INK['20']} />
            <p
              className="text-[14px] mt-4 mb-2 font-medium"
              style={{ color: INK['50'], fontFamily: FONT.sans }}
            >
              Your dream board is empty
            </p>
            <p
              className="text-[12px] text-center max-w-xs"
              style={{ color: INK['40'], fontFamily: FONT.sans }}
            >
              Save places from My Places or ask Terrazzo for recommendations to start building your inspiration.
            </p>
          </div>
        ) : groupedByDest ? (
          // Multi-destination: grouped sections
          Object.entries(groupedByDest).map(([dest, items]) => (
            <div key={dest} className="mb-6">
              <h3
                className="text-[11px] font-bold uppercase tracking-[2px] mb-2 px-1"
                style={{ fontFamily: FONT.mono, color: INK['50'] }}
              >
                {dest} · {items.length}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {items.map(item => (
                  <DreamCard key={item.id} item={item} onTap={onTapDetail} />
                ))}
              </div>
            </div>
          ))
        ) : (
          // Single destination: flat grid
          <div className="grid grid-cols-2 gap-2">
            {filteredItems.map(item => (
              <DreamCard key={item.id} item={item} onTap={onTapDetail} />
            ))}
          </div>
        )}
      </div>

      {/* Footer count */}
      <div
        className="flex items-center justify-between px-5 py-2.5 flex-shrink-0"
        style={{ borderTop: '1px solid var(--t-linen)', background: 'white' }}
      >
        <span className="text-[11px]" style={{ color: INK['50'], fontFamily: FONT.sans }}>
          {filteredItems.length} place{filteredItems.length !== 1 ? 's' : ''} saved
        </span>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as 'added' | 'type' | 'match')}
          className="text-[11px] bg-transparent border-none outline-none cursor-pointer"
          style={{ color: INK['50'], fontFamily: FONT.sans }}
        >
          <option value="added">Recently added</option>
          <option value="type">By type</option>
          <option value="match">By match score</option>
        </select>
      </div>
    </div>
  );
}

// ─── Individual dream card ───
function DreamCard({ item, onTap }: { item: ImportedPlace; onTap: (item: ImportedPlace) => void }) {
  const iconName = TYPE_ICONS[item.type || ''] || 'pin';

  return (
    <button
      onClick={() => onTap(item)}
      className="flex flex-col items-start p-3 rounded-xl border cursor-pointer transition-all text-left nav-hover w-full"
      style={{
        background: 'white',
        borderColor: 'var(--t-linen)',
      }}
    >
      {/* Type icon + match score */}
      <div className="flex items-center justify-between w-full mb-1.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: INK['04'] }}
        >
          <PerriandIcon name={iconName} size={14} color={INK['50']} />
        </div>
        {item.matchScore !== undefined && item.matchScore > 0 && (
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{
              background: item.matchScore >= 85
                ? 'rgba(42,122,86,0.1)'
                : item.matchScore >= 70
                  ? 'rgba(200,146,58,0.1)'
                  : INK['06'],
              color: item.matchScore >= 85
                ? 'var(--t-verde)'
                : item.matchScore >= 70
                  ? '#8a6a2a'
                  : INK['50'],
              fontFamily: FONT.mono,
            }}
          >
            {item.matchScore}%
          </span>
        )}
      </div>

      {/* Name */}
      <span
        className="text-[13px] font-medium leading-snug mb-0.5 line-clamp-2"
        style={{ color: 'var(--t-ink)', fontFamily: FONT.sans }}
      >
        {item.name}
      </span>

      {/* Type + location */}
      <span
        className="text-[10px] truncate w-full"
        style={{ color: INK['50'], fontFamily: FONT.sans }}
      >
        {item.type && <span className="capitalize">{item.type}</span>}
        {item.type && item.location && ' · '}
        {item.location}
      </span>

      {/* Note / source */}
      {item.tasteNote && (
        <span
          className="text-[10px] mt-1.5 line-clamp-2 leading-relaxed italic"
          style={{ color: INK['40'], fontFamily: FONT.sans }}
        >
          "{item.tasteNote}"
        </span>
      )}
    </button>
  );
}

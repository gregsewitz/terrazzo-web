'use client';

import { useState, useMemo } from 'react';
import { useSavedStore } from '@/stores/savedStore';
import { ImportedPlace, Collection, REACTIONS } from '@/types';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT } from '@/constants/theme';
import { THUMB_GRADIENTS, TYPE_BRAND_COLORS, TYPE_ICONS } from '@/constants/placeTypes';
import BaseSheet from '@/components/ui/BaseSheet';
import SortPills from '@/components/ui/SortPills';
import { getDisplayLocation } from '@/lib/place-display';

type PlaceSortKey = 'match' | 'az' | 'type';

const PLACE_SORT_OPTIONS: { id: PlaceSortKey; label: string }[] = [
  { id: 'match', label: 'Match Tier' },
  { id: 'az', label: 'A–Z' },
  { id: 'type', label: 'Type' },
];

/**
 * Bottom-sheet modal for adding existing library places to a collection.
 * Shows all places in the user's library that are NOT already in the target collection,
 * with search and instant add.
 */
export default function AddPlacesToCollectionSheet({
  collection,
  onClose,
}: {
  collection: Collection;
  onClose: () => void;
}) {
  const myPlaces = useSavedStore(s => s.myPlaces);
  const addPlaceToCollection = useSavedStore(s => s.addPlaceToCollection);

  const [searchQuery, setSearchQuery] = useState('');
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<PlaceSortKey>('match');

  // Places available to add (not already in the collection, minus just-added ones treated as in-collection)
  const availablePlaces = useMemo(() => {
    const inCollection = new Set(collection.placeIds);
    let pool = myPlaces.filter(p => !inCollection.has(p.id) && !justAdded.has(p.id));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      pool = pool.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.type.includes(q) ||
        p.enrichment?.description?.toLowerCase().includes(q)
      );
    }
    switch (sortBy) {
      case 'az':
        return pool.sort((a, b) => a.name.localeCompare(b.name));
      case 'type':
        return pool.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
      case 'match':
      default:
        return pool.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
    }
  }, [myPlaces, collection.placeIds, searchQuery, justAdded, sortBy]);

  const handleAdd = (place: ImportedPlace) => {
    addPlaceToCollection(collection.id, place.id);
    setJustAdded(prev => new Set(prev).add(place.id));
  };

  const alreadyInCount = collection.placeIds.length + justAdded.size;

  return (
    <BaseSheet
      title="Add Places"
      subtitle={`to ${collection.name}`}
      onClose={onClose}
      centerOnDesktop
    >
      {/* Search bar */}
      <div className="px-4 pb-3">
        <div className="relative">
          <PerriandIcon
            name="discover"
            size={13}
            color={TEXT.secondary}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Search your library by name or location…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="w-full rounded-lg py-2.5 pr-3 text-[13px]"
            style={{
              paddingLeft: 30,
              background: 'white',
              border: '1px solid var(--t-linen)',
              color: TEXT.primary,
              fontFamily: FONT.sans,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: INK['06'], border: 'none', cursor: 'pointer' }}
              aria-label="Clear search"
            >
              <PerriandIcon name="close" size={8} color={TEXT.secondary} />
            </button>
          )}
        </div>
        {/* Count summary */}
        <div className="mt-2 text-[10px]" style={{ fontFamily: FONT.mono, color: TEXT.secondary }}>
          {availablePlaces.length} available · {alreadyInCount} already in collection
        </div>

        {/* Sort pills */}
        <div className="mt-2">
          <SortPills
            options={PLACE_SORT_OPTIONS}
            value={sortBy}
            onChange={setSortBy}
            itemCount={availablePlaces.length}
          />
        </div>
      </div>

      {/* Place list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {availablePlaces.length === 0 ? (
          <div className="text-center py-10">
            <PerriandIcon name="discover" size={28} color={INK['15']} />
            <p className="text-[12px] mt-3" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>
              {searchQuery
                ? 'No matching places found'
                : 'All your library places are already in this collection'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {availablePlaces.map(place => {
              const typeIcon = place.type;
              const rating = place.rating;
              const reaction = rating ? REACTIONS.find(r => r.id === rating.reaction) : null;

              return (
                <div
                  key={place.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                  style={{ background: 'white', border: '1px solid var(--t-linen)' }}
                >
                  {/* Type icon thumb */}
                  <div
                    className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center"
                    style={{ background: THUMB_GRADIENTS[place.type] || THUMB_GRADIENTS.restaurant }}
                  >
                    <PerriandIcon name={typeIcon as PerriandIconName} size={14} color={TYPE_BRAND_COLORS[place.type as keyof typeof TYPE_BRAND_COLORS] || INK['60']} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 cursor-default">
                    <div className="text-[12px] font-semibold truncate" style={{ color: TEXT.primary, fontFamily: FONT.sans }}>
                      {place.name}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span style={{ fontFamily: FONT.sans, fontSize: 10, color: TEXT.secondary }}>
                        {place.type.charAt(0).toUpperCase() + place.type.slice(1)}
                      </span>
                      {(() => { const dl = getDisplayLocation(place.location, place.name, place.google?.address); return dl ? <span style={{ fontSize: 10, color: TEXT.secondary }}>· {dl}</span> : null; })()}
                      {reaction && (
                        <PerriandIcon name={reaction.icon as PerriandIconName} size={10} color={reaction.color} />
                      )}
                    </div>
                  </div>

                  {/* Match score */}
                  {place.matchScore > 0 && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-md flex-shrink-0"
                      style={{
                        background: 'var(--t-ink)',
                        color: 'var(--t-chrome-yellow)',
                        fontFamily: FONT.mono,
                        fontWeight: 700,
                      }}
                    >
                      {Math.round(place.matchScore)}
                    </span>
                  )}

                  {/* Add button */}
                  <button
                    onClick={() => handleAdd(place)}
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer transition-all btn-hover"
                    style={{
                      background: 'rgba(58,128,136,0.08)',
                      border: '1.5px solid var(--t-dark-teal)',
                    }}
                  >
                    <span style={{ fontSize: 14, color: 'var(--t-dark-teal)', fontWeight: 600, lineHeight: 1 }}>+</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Added confirmation toast */}
      {justAdded.size > 0 && (
        <div
          className="flex items-center justify-center gap-1.5 py-2.5"
          style={{
            background: 'rgba(58,128,136,0.06)',
            borderTop: '1px solid rgba(58,128,136,0.12)',
          }}
        >
          <PerriandIcon name="saved" size={12} color="var(--t-dark-teal)" />
          <span style={{ fontFamily: FONT.sans, fontSize: 11, color: 'var(--t-dark-teal)', fontWeight: 600 }}>
            {justAdded.size} {justAdded.size === 1 ? 'place' : 'places'} added
          </span>
        </div>
      )}
    </BaseSheet>
  );
}

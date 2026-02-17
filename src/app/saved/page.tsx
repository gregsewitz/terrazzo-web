'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import TabBar from '@/components/TabBar';
import SmartCollectionSheet from '@/components/SmartCollectionSheet';
import { useSavedStore } from '@/stores/savedStore';
import { SOURCE_STYLES, REACTIONS, PlaceType, GhostSourceType, ImportedPlace } from '@/types';

const PLACE_TYPES: Array<{ id: PlaceType | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'hotel', label: 'Hotels' },
  { id: 'restaurant', label: 'Restaurants' },
  { id: 'bar', label: 'Bars' },
  { id: 'activity', label: 'Experiences' },
  { id: 'museum', label: 'Museums' },
  { id: 'cafe', label: 'Cafes' },
];

const TYPE_COLORS: Record<PlaceType, string> = {
  restaurant: '#e87080',
  hotel: '#c8923a',
  bar: '#6844a0',
  museum: '#2a7a56',
  cafe: '#eeb420',
  activity: '#e86830',
  neighborhood: '#5a7a9a',
  shop: '#a06c28',
};

function TypeBadge({ type }: { type: PlaceType }) {
  const bgColor = TYPE_COLORS[type];
  return (
    <div
      className="inline-block px-2 py-1 rounded-full text-white text-[10px] font-medium"
      style={{ backgroundColor: bgColor }}
    >
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </div>
  );
}

function SavedPlaceCard({ place }: { place: ImportedPlace }) {
  const rating = place.rating;
  const reaction = rating
    ? REACTIONS.find((r) => r.id === rating.reaction)
    : null;

  return (
    <div className="p-4 rounded-xl border" style={{ backgroundColor: 'white', borderColor: 'var(--t-linen)' }}>
      <div className="flex gap-3">
        {/* Thumbnail */}
        <div
          className="w-12 h-12 rounded-lg flex-shrink-0"
          style={{ backgroundColor: TYPE_COLORS[place.type] || 'var(--t-ghost)', opacity: 0.2 }}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-[13px] font-bold" style={{ color: 'var(--t-ink)' }}>
              {place.name}
            </h3>
            {rating && (
              <span style={{ fontSize: '14px' }}>
                {reaction?.icon}
              </span>
            )}
          </div>
          <p className="text-[10px] mb-2" style={{ color: 'rgba(28,26,23,0.5)' }}>
            {place.location}
          </p>

          {/* Source tag */}
          {place.ghostSource && (() => {
            const src = SOURCE_STYLES[place.ghostSource as GhostSourceType];
            return src ? (
              <div
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px]"
                style={{ backgroundColor: src.bg, color: src.color }}
              >
                <span>{src.icon}</span>
                <span className="font-medium">{src.label}</span>
              </div>
            ) : null;
          })()}
        </div>
      </div>
    </div>
  );
}

function HistoryItemCard({ item, onPromote }: { item: import('@/stores/savedStore').HistoryItem; onPromote: (id: string) => void }) {
  const typeColor = TYPE_COLORS[item.type] || 'var(--t-ghost)';

  return (
    <div className="p-4 rounded-lg border" style={{ backgroundColor: 'white', borderColor: 'var(--t-linen)' }}>
      <div className="flex gap-3 items-start">
        <div
          className="w-10 h-10 rounded flex-shrink-0"
          style={{ backgroundColor: typeColor, opacity: 0.15 }}
        />
        <div className="flex-1 min-w-0">
          <h4 className="text-[12px] font-bold mb-1" style={{ color: 'var(--t-ink)' }}>
            {item.name}
          </h4>
          <p className="text-[10px] mb-2" style={{ color: 'rgba(28,26,23,0.5)' }}>
            {item.location} · {item.detectedDate}
          </p>
          <div className="flex items-center gap-2">
            <span
              className="inline-block px-1.5 py-0.5 rounded text-[9px]"
              style={{ backgroundColor: 'var(--t-linen)', color: 'var(--t-ink)' }}
            >
              {item.detectedFrom}
            </span>
            <button
              onClick={() => onPromote(item.id)}
              className="text-[9px] underline"
              style={{ color: 'var(--t-verde)' }}
            >
              + Add to My Places
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CollectionCard({ collection, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="w-[120px] flex-shrink-0 p-3 rounded-xl text-center cursor-pointer transition-all hover:shadow-md"
      style={{ backgroundColor: 'white', border: '1px solid var(--t-linen)', background: 'white' }}
    >
      <div className="text-3xl mb-2">{collection.emoji}</div>
      <h4
        className="text-[12px] font-serif italic mb-1 line-clamp-2"
        style={{ fontFamily: "var(--font-dm-serif-display), serif", color: 'var(--t-ink)' }}
      >
        {collection.name}
      </h4>
      <p className="text-[10px]" style={{ color: 'rgba(28,26,23,0.5)', fontFamily: "'Space Mono', monospace" }}>
        {collection.count} places
      </p>
    </button>
  );
}

function LocationCluster({ city, count }: { city: string; count: number }) {
  return (
    <div
      className="p-4 rounded-xl"
      style={{ backgroundColor: 'white', border: '1px solid var(--t-linen)' }}
    >
      <h3
        className="text-[13px] font-serif italic"
        style={{ fontFamily: "var(--font-dm-serif-display), serif", color: 'var(--t-ink)' }}
      >
        {city}
      </h3>
      <p className="text-[10px]" style={{ color: 'rgba(28,26,23,0.5)', fontFamily: "'Space Mono', monospace" }}>
        {count} place{count !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

export default function SavedPage() {
  const router = useRouter();
  const {
    viewMode,
    typeFilter,
    searchQuery,
    myPlaces,
    history,
    collections,
    setViewMode,
    setTypeFilter,
    setSearchQuery,
    promoteFromHistory,
    addCollection,
  } = useSavedStore();

  const [searchInput, setSearchInput] = useState(searchQuery);
  const [showNewCollection, setShowNewCollection] = useState(false);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    setSearchQuery(value);
  };

  // Filter and sort places
  const filteredPlaces = useMemo(() => {
    return myPlaces.filter((place) => {
      const matchesType = typeFilter === 'all' || place.type === typeFilter;
      const matchesSearch = searchQuery === ''
        || place.name.toLowerCase().includes(searchQuery.toLowerCase())
        || place.location.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [myPlaces, typeFilter, searchQuery]);

  // Group places by location for "By Location" section
  const locationClusters = useMemo(() => {
    const grouped: Record<string, number> = {};
    myPlaces.forEach((place) => {
      grouped[place.location] = (grouped[place.location] || 0) + 1;
    });
    return Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6); // Top 6 locations
  }, [myPlaces]);

  // Group history by month
  const historyByMonth = useMemo(() => {
    const grouped: Record<string, typeof history> = {};
    history.forEach((item) => {
      const monthKey = item.detectedDate; // "Feb 2026", "Jan 2026", etc.
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(item);
    });
    return Object.entries(grouped).sort((a, b) => {
      const monthOrder = ['Feb', 'Jan', 'Dec', 'Nov', 'Oct', 'Sep'];
      const aMonth = a[0].split(' ')[0];
      const bMonth = b[0].split(' ')[0];
      return monthOrder.indexOf(aMonth) - monthOrder.indexOf(bMonth);
    });
  }, [history]);

  if (viewMode === 'history') {
    return (
      <div className="min-h-screen pb-16" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}>
        <div className="px-4 pt-6">
          <h1
            className="text-2xl mb-1"
            style={{ fontFamily: "var(--font-dm-serif-display), serif", color: 'var(--t-ink)', fontStyle: 'italic' }}
          >
            History
          </h1>
          <p className="text-xs mb-6" style={{ color: 'rgba(28,26,23,0.5)' }}>
            {history.length} items detected
          </p>

          {/* Switch back to My Places */}
          <button
            onClick={() => setViewMode('myPlaces')}
            className="text-[12px] underline mb-8"
            style={{ color: 'var(--t-verde)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ← Back to My Places
          </button>

          {/* History grouped by month */}
          <div className="space-y-6">
            {historyByMonth.map(([month, items]) => (
              <div key={month}>
                <h2
                  className="text-[11px] uppercase tracking-wider mb-3"
                  style={{ fontFamily: "'Space Mono', monospace", color: 'var(--t-amber)' }}
                >
                  {month}
                </h2>
                <div className="space-y-2">
                  {items.map((item) => (
                    <HistoryItemCard
                      key={item.id}
                      item={item}
                      onPromote={promoteFromHistory}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <TabBar />
      </div>
    );
  }

  // My Places View
  return (
    <div className="min-h-screen pb-16" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}>
      <div className="px-4 pt-6">
        {/* Header */}
        <h1
          className="text-2xl mb-1"
          style={{ fontFamily: "var(--font-dm-serif-display), serif", color: 'var(--t-ink)', fontStyle: 'italic' }}
        >
          My Places
        </h1>
        <p className="text-xs mb-6" style={{ color: 'rgba(28,26,23,0.5)', fontFamily: "'Space Mono', monospace" }}>
          {myPlaces.length} places · {history.length} in history
        </p>

        {/* Search Bar */}
        <input
          type="text"
          placeholder="Search places, people, cities..."
          value={searchInput}
          onChange={handleSearchChange}
          className="w-full px-4 py-3 rounded-lg border mb-6 text-[13px]"
          style={{
            backgroundColor: 'var(--t-cream)',
            borderColor: 'var(--t-linen)',
            color: 'var(--t-ink)',
          }}
        />

        {/* Type Filter Chips */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {PLACE_TYPES.map((type) => {
            const isActive = typeFilter === type.id;
            return (
              <button
                key={type.id}
                onClick={() => setTypeFilter(type.id as PlaceType | 'all')}
                className="px-4 py-2 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors"
                style={{
                  backgroundColor: isActive ? 'var(--t-ink)' : 'var(--t-linen)',
                  color: isActive ? 'var(--t-cream)' : 'var(--t-ink)',
                  fontFamily: "'Space Mono', monospace",
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {type.label}
              </button>
            );
          })}
        </div>

        {/* Active Trip Banner */}
        <div
          className="p-4 rounded-xl mb-6"
          style={{
            backgroundColor: 'white',
            borderLeft: '3px solid var(--t-verde)',
            border: '1px solid var(--t-linen)',
            borderLeftWidth: '3px',
          }}
        >
          <h3 className="text-[13px] font-bold mb-1" style={{ color: 'var(--t-ink)' }}>
            Tokyo 2025
          </h3>
          <p className="text-[10px]" style={{ color: 'rgba(28,26,23,0.5)', fontFamily: "'Space Mono', monospace" }}>
            14 matches found · 3 starred
          </p>
        </div>

        {/* Collections Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-[10px] uppercase tracking-wider"
              style={{ fontFamily: "'Space Mono', monospace", color: 'var(--t-amber)' }}
            >
              My Collections
            </h2>
            <button
              onClick={() => setShowNewCollection(true)}
              className="text-[11px] font-medium"
              style={{ color: 'var(--t-honey)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              + New
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {collections.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                onClick={() => router.push(`/saved/collection/${collection.id}`)}
              />
            ))}
          </div>
        </div>

        {/* By Location Section */}
        {locationClusters.length > 0 && (
          <div className="mb-8">
            <h2
              className="text-[10px] uppercase tracking-wider mb-4"
              style={{ fontFamily: "'Space Mono', monospace", color: 'var(--t-amber)' }}
            >
              By Location
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {locationClusters.map(([city, count]) => (
                <LocationCluster key={city} city={city} count={count} />
              ))}
            </div>
          </div>
        )}

        {/* Recently Saved Section */}
        <div className="mb-8">
          <h2
            className="text-[10px] uppercase tracking-wider mb-4"
            style={{ fontFamily: "'Space Mono', monospace", color: 'var(--t-amber)' }}
          >
            Recently Saved
          </h2>
          {filteredPlaces.length > 0 ? (
            <div className="space-y-3">
              {filteredPlaces.map((place) => (
                <SavedPlaceCard key={place.id} place={place} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <span className="text-2xl mb-3 block">◇</span>
              <p className="text-[12px]" style={{ color: 'rgba(28,26,23,0.4)' }}>
                No places match your filters
              </p>
            </div>
          )}
        </div>

        {/* History Toggle */}
        <div className="mb-4 text-center">
          <button
            onClick={() => setViewMode('history')}
            className="text-[11px] underline"
            style={{ color: 'var(--t-honey)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Show history →
          </button>
        </div>
      </div>

      {/* Smart Collection Sheet */}
      <SmartCollectionSheet
        isOpen={showNewCollection}
        onClose={() => setShowNewCollection(false)}
        onCreate={(collection) => {
          // Parse the emoji from the query or use a default
          const emojiMap: Record<string, string> = {
            hotel: '🏨',
            restaurant: '🍽',
            bar: '🍷',
            museum: '🎨',
            cafe: '☕',
            sarah: '👤',
            tokyo: '🗼',
          };

          let emoji = '✨';
          for (const [key, value] of Object.entries(emojiMap)) {
            if (collection.query.toLowerCase().includes(key)) {
              emoji = value;
              break;
            }
          }

          // Parse filter tags from query
          const query = collection.query.toLowerCase();
          const filterTags: string[] = [];

          // Extract filter tags based on keywords
          if (query.includes('hotel')) filterTags.push('type: hotel');
          if (query.includes('restaurant')) filterTags.push('type: restaurant');
          if (query.includes('bar')) filterTags.push('type: bar');
          if (query.includes('museum')) filterTags.push('type: museum');
          if (query.includes('cafe')) filterTags.push('type: cafe');

          if (query.includes('europe')) filterTags.push('location: Europe');
          if (query.includes('tokyo')) filterTags.push('location: Tokyo');
          if (query.includes('paris')) filterTags.push('location: Paris');
          if (query.includes('new york') || query.includes('nyc')) filterTags.push('location: New York');
          if (query.includes('london')) filterTags.push('location: London');

          if (query.includes('sarah')) {
            filterTags.push('person: Sarah');
            filterTags.push('source: friend');
          }

          if (query.includes('favorite') || query.includes('loved')) filterTags.push('reaction: ♡');

          addCollection({
            name: collection.name,
            count: Math.floor(Math.random() * 5) + 5, // Random count 5-10
            emoji,
            isSmartCollection: true,
            query: collection.query,
            filterTags: filterTags.length > 0 ? filterTags : undefined,
          });
        }}
      />

      <TabBar />
    </div>
  );
}

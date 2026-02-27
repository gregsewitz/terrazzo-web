'use client';

import { motion } from 'framer-motion';
import { useMemo, useState, useRef, useCallback } from 'react';
import PageTransition from '@/components/PageTransition';
import { useRouter } from 'next/navigation';
import TabBar from '@/components/TabBar';
import DesktopNav from '@/components/DesktopNav';
import ProfileAvatar from '@/components/ProfileAvatar';
import CollectionCard from '@/components/CollectionCard';
import { useSavedStore } from '@/stores/savedStore';
import { useTripStore } from '@/stores/tripStore';
import { REACTIONS, PlaceType, ImportedPlace, SOURCE_STYLES } from '@/types';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';
import PlaceSearchBar from '@/components/PlaceSearchBar';
import { PlaceDetailProvider, usePlaceDetail } from '@/context/PlaceDetailContext';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import FilterSortBar from '@/components/ui/FilterSortBar';
import { TYPE_ICONS, THUMB_GRADIENTS, TYPE_CHIPS_WITH_ALL } from '@/constants/placeTypes';

export default function SavedPage() {
  const myPlaces = useSavedStore(s => s.myPlaces);
  const ratePlace = useSavedStore(s => s.ratePlace);
  const injectGhostCandidates = useTripStore(s => s.injectGhostCandidates);

  return (
    <PlaceDetailProvider config={{
      onRate: (place, rating) => {
        ratePlace(place.id, rating);
        if (rating.reaction === 'myPlace' || rating.reaction === 'enjoyed') {
          injectGhostCandidates([{ ...place, rating }]);
        }
      },
      getSiblingPlaces: (place) =>
        place.importBatchId
          ? myPlaces.filter(p => p.importBatchId === place.importBatchId && p.id !== place.id)
          : [],
    }}>
      <SavedPageContent />
    </PlaceDetailProvider>
  );
}

/* ─── Animation constants (desktop only) ─── */
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } };
const cardVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT_EXPO } } };

function SavedPageContent() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const { openDetail, openCollectionPicker } = usePlaceDetail();
  const myPlaces = useSavedStore(s => s.myPlaces);
  const collections = useSavedStore(s => s.collections);
  const searchQuery = useSavedStore(s => s.searchQuery);
  const typeFilter = useSavedStore(s => s.typeFilter);
  const setTypeFilter = useSavedStore(s => s.setTypeFilter);
  const cityFilter = useSavedStore(s => s.cityFilter);
  const setCityFilter = useSavedStore(s => s.setCityFilter);
  const createCollectionAsync = useSavedStore(s => s.createCollectionAsync);
  const createSmartCollection = useSavedStore(s => s.createSmartCollection);
  const trips = useTripStore(s => s.trips);
  const [addToTripItem, setAddToTripItem] = useState<ImportedPlace | null>(null);
  const [showCreateCollection, setShowCreateCollection] = useState(false);

  // ─── Collection count per place ───
  const collectionCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    collections.forEach(c => c.placeIds.forEach(pid => { counts[pid] = (counts[pid] || 0) + 1; }));
    return counts;
  }, [collections]);

  // ─── Collection sorting ───
  const [collectionSortBy, setCollectionSortBy] = useState<'recent' | 'name' | 'places' | 'updated'>('recent');

  const sortedCollections = useMemo(() => {
    const sorted = [...collections];
    switch (collectionSortBy) {
      case 'name': sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'places': sorted.sort((a, b) => b.placeIds.length - a.placeIds.length); break;
      case 'updated': sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()); break;
      default: sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
    }
    return sorted;
  }, [collections, collectionSortBy]);

  // ─── Library filtering ───
  const [sortBy, setSortBy] = useState<'recent' | 'match' | 'name' | 'type' | 'source'>('recent');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  // Parse city from second segment, neighborhood from first
  const parseLocation = useCallback((loc: string) => {
    const parts = loc.split(',').map(s => s.trim());
    // Format: "Neighborhood, City" or just "City"
    if (parts.length >= 2) {
      return { neighborhood: parts[0], city: parts[1] };
    }
    return { neighborhood: '', city: parts[0] };
  }, []);

  // Build city → neighborhoods map + source counts
  const { allCities, allSources } = useMemo(() => {
    const cityCount: Record<string, number> = {};
    const neighborhoods: Record<string, Set<string>> = {};
    const sourceCount: Record<string, number> = {};
    myPlaces.forEach(p => {
      const { city, neighborhood } = parseLocation(p.location);
      if (city) {
        cityCount[city] = (cityCount[city] || 0) + 1;
        if (!neighborhoods[city]) neighborhoods[city] = new Set();
        if (neighborhood) neighborhoods[city].add(neighborhood);
      }
      const src = p.ghostSource || 'manual';
      sourceCount[src] = (sourceCount[src] || 0) + 1;
    });
    // Sort by count descending, then alphabetically
    const sorted = Object.entries(cityCount)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([city]) => city);
    const nbMap: Record<string, string[]> = {};
    for (const [city, set] of Object.entries(neighborhoods)) {
      nbMap[city] = Array.from(set).sort();
    }
    // Sources sorted by count
    const sources = Object.entries(sourceCount)
      .sort((a, b) => b[1] - a[1])
      .map(([src, count]) => ({ value: src, count }));
    return { allCities: sorted, cityNeighborhoods: nbMap, allSources: sources };
  }, [myPlaces, parseLocation]);

  // Reset neighborhood when city changes
  const handleCityFilter = useCallback((city: string) => {
    setCityFilter(city);
  }, [setCityFilter]);

  const filteredPlaces = useMemo(() => {
    let places = myPlaces;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      places = places.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.type.includes(q) ||
        p.tasteNote?.toLowerCase().includes(q)
      );
    }
    if (typeFilter !== 'all') {
      places = places.filter(p => p.type === typeFilter);
    }
    if (cityFilter !== 'all') {
      places = places.filter(p => {
        const { city } = parseLocation(p.location);
        return city.toLowerCase() === cityFilter.toLowerCase();
      });
    }
    if (sourceFilter !== 'all') {
      places = places.filter(p => (p.ghostSource || 'manual') === sourceFilter);
    }
    // Sort
    const sorted = [...places];
    switch (sortBy) {
      case 'recent': sorted.sort((a, b) => {
        const dateA = a.savedAt || '';
        const dateB = b.savedAt || '';
        return dateB.localeCompare(dateA); // newest first
      }); break;
      case 'match': sorted.sort((a, b) => b.matchScore - a.matchScore); break;
      case 'name': sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'type': sorted.sort((a, b) => a.type.localeCompare(b.type)); break;
      case 'source': sorted.sort((a, b) => (a.ghostSource || '').localeCompare(b.ghostSource || '')); break;
    }
    return sorted;
  }, [myPlaces, searchQuery, typeFilter, cityFilter, sourceFilter, sortBy, parseLocation]);


  // ─── Uncollected places (not in any collection) ───
  const uncollectedPlaces = useMemo(() => {
    const collectedIds = new Set(collections.flatMap(sl => sl.placeIds));
    return filteredPlaces.filter(p => !collectedIds.has(p.id));
  }, [filteredPlaces, collections]);

  /* ─── Desktop Library layout (unified) ─── */
  if (isDesktop) {
    return (
      <PageTransition className="min-h-screen" style={{ background: 'var(--t-cream)' }}>
        <DesktopNav />
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '36px 48px 48px' }}>
          {/* ═══ Header row ═══ */}
          <div className="flex items-end justify-between mb-6">
            <div>
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}>
                <h1
                  style={{
                    fontFamily: FONT.serif,
                    fontStyle: 'italic',
                    fontSize: 32,
                    color: 'var(--t-ink)',
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  Collect
                </h1>
              </motion.div>
              <p style={{ fontFamily: FONT.mono, fontSize: 12, color: INK['60'], margin: '6px 0 0' }}>
                {myPlaces.length} places across {allCities.length} {allCities.length === 1 ? 'city' : 'cities'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <PlaceSearchBar />
              <motion.button
                onClick={() => setShowCreateCollection(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-full cursor-pointer btn-hover"
                style={{
                  background: 'var(--t-ink)',
                  color: 'white',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: FONT.sans,
                }}
              >
                <span>+</span> New Collection
              </motion.button>
            </div>
          </div>

          {/* ═══ Collections section ═══ */}
          {sortedCollections.length > 0 && (
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 20, color: 'var(--t-ink)', margin: 0 }}>
                  Collections
                </h2>
                <FilterSortBar
                  sortOptions={[
                    { value: 'recent', label: 'Recently created' },
                    { value: 'updated', label: 'Recently updated' },
                    { value: 'name', label: 'A–Z' },
                    { value: 'places', label: 'Most places' },
                  ]}
                  sortValue={collectionSortBy}
                  onSortChange={(v) => setCollectionSortBy(v as any)}
                  compact
                />
              </div>
              <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="grid gap-3"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
              >
                {sortedCollections.map(sl => (
                  <motion.div key={sl.id} variants={cardVariants}>
                    <CollectionCard
                      collection={sl}
                      places={myPlaces}
                      onClick={() => router.push(`/saved/collections/${sl.id}`)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          )}

          {/* ═══ All Places grid ═══ */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 20, color: 'var(--t-ink)', margin: 0 }}>
                {typeFilter !== 'all' ? `${TYPE_CHIPS_WITH_ALL.find(c => c.value === typeFilter)?.label || 'Filtered'} places` : 'All places'}
                <span style={{ fontFamily: FONT.mono, fontSize: 12, color: INK['50'], fontStyle: 'normal', marginLeft: 8 }}>
                  {filteredPlaces.length}
                </span>
              </h2>
            </div>
            <div className="mb-4">
              <FilterSortBar
                filterGroups={[
                  {
                    key: 'type',
                    label: 'Type',
                    options: TYPE_CHIPS_WITH_ALL.map(c => ({
                      value: c.value,
                      label: c.label,
                      icon: c.icon as PerriandIconName,
                    })),
                    value: typeFilter,
                    onChange: (v) => setTypeFilter(v as PlaceType | 'all'),
                  },
                  {
                    key: 'source',
                    label: 'Source',
                    options: [
                      { value: 'all', label: 'All sources' },
                      ...allSources.map(s => ({
                        value: s.value,
                        label: SOURCE_STYLES[s.value as keyof typeof SOURCE_STYLES]?.label || s.value,
                        icon: (SOURCE_STYLES[s.value as keyof typeof SOURCE_STYLES]?.icon || 'manual') as PerriandIconName,
                        count: s.count,
                      })),
                    ],
                    value: sourceFilter,
                    onChange: setSourceFilter,
                  },
                  ...(allCities.length > 1 ? [{
                    key: 'city',
                    label: 'Location',
                    options: [
                      { value: 'all', label: 'All cities' },
                      ...allCities.map(c => ({ value: c, label: c })),
                    ],
                    value: cityFilter,
                    onChange: handleCityFilter,
                  }] : []),
                ]}
                sortOptions={[
                  { value: 'recent', label: 'Most recent' },
                  { value: 'match', label: 'Match %' },
                  { value: 'name', label: 'A–Z' },
                  { value: 'type', label: 'Type' },
                  { value: 'source', label: 'Source' },
                ]}
                sortValue={sortBy}
                onSortChange={(v) => setSortBy(v as any)}
                onResetAll={() => {
                  setTypeFilter('all');
                  setSourceFilter('all');
                  setCityFilter('all');
                  setSortBy('recent');
                }}
              />
            </div>
            {filteredPlaces.length > 0 ? (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="grid gap-4"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
              >
                {filteredPlaces.map(place => (
                  <motion.div key={place.id} variants={cardVariants}>
                    <PlaceCard
                      place={place}
                      onTap={() => openDetail(place)}
                      onToggleCollections={() => openCollectionPicker(place)}
                      collectionCount={collectionCountMap[place.id] || 0}
                      onLongPress={() => setAddToTripItem(place)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <div className="text-center py-16">
                <PerriandIcon name="discover" size={36} color={INK['15']} />
                <p className="text-[13px] mt-3" style={{ color: INK['70'] }}>
                  {searchQuery || typeFilter !== 'all' || cityFilter !== 'all'
                    ? 'No places match your filters'
                    : 'No saved places yet'}
                </p>
              </div>
            )}
          </div>

          {/* ═══ Uncollected section ═══ */}
          {uncollectedPlaces.length > 0 && uncollectedPlaces.length < filteredPlaces.length && typeFilter === 'all' && (
            <div className="mt-10 pt-8" style={{ borderTop: '1px solid var(--t-linen)' }}>
              <h2 style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 18, color: INK['70'], margin: '0 0 12px' }}>
                Uncollected
                <span style={{ fontFamily: FONT.mono, fontSize: 12, color: INK['40'], fontStyle: 'normal', marginLeft: 8 }}>
                  {uncollectedPlaces.length}
                </span>
              </h2>
              <p style={{ fontFamily: FONT.sans, fontSize: 12, color: INK['50'], margin: '0 0 16px' }}>
                These places aren&apos;t in any collection yet
              </p>
              <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="grid gap-4"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
              >
                {uncollectedPlaces.map(place => (
                  <motion.div key={place.id} variants={cardVariants}>
                    <PlaceCard
                      place={place}
                      onTap={() => openDetail(place)}
                      onToggleCollections={() => openCollectionPicker(place)}
                      collectionCount={collectionCountMap[place.id] || 0}
                      onLongPress={() => setAddToTripItem(place)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          )}
        </div>

        {/* ═══ Shared overlays ═══ */}
        {showCreateCollection && (
          <CreateCollectionModal
            onClose={() => setShowCreateCollection(false)}
            onCreate={async (name, emoji) => {
              setShowCreateCollection(false);
              const realId = await createCollectionAsync(name, emoji);
              router.push(`/saved/collections/${realId}`);
            }}
            onCreateSmart={(name, emoji, query, filterTags, placeIds) => {
              createSmartCollection(name, emoji, query, filterTags, placeIds);
              setShowCreateCollection(false);
            }}
          />
        )}
        {addToTripItem && trips.length > 0 && (
          <AddToTripSheet
            place={addToTripItem}
            trips={trips}
            onClose={() => setAddToTripItem(null)}
            onAdd={(tripId) => {
              setAddToTripItem(null);
            }}
          />
        )}
      </PageTransition>
    );
  }

  /* ─── Mobile Library layout (unified) ─── */
  return (
    <div className="min-h-screen" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto', paddingBottom: 64, overflowX: 'hidden', boxSizing: 'border-box' }}>
      <div className="px-4 pt-5">
        {/* ═══ Header ═══ */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1
              style={{
                fontFamily: FONT.serif,
                fontStyle: 'italic',
                fontSize: 22,
                color: 'var(--t-ink)',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Collect
            </h1>
            <span style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['60'] }}>
              {myPlaces.length} places
            </span>
          </div>
          <ProfileAvatar />
        </div>

        {/* ═══ Search ═══ */}
        <div className="mb-3"><PlaceSearchBar /></div>

        {/* ═══ Collections section ═══ */}
        {sortedCollections.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 16, color: 'var(--t-ink)', margin: 0 }}>
                Collections
                <span style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['50'], fontStyle: 'normal', marginLeft: 6 }}>
                  {sortedCollections.length}
                </span>
              </h2>
              <button
                onClick={() => setShowCreateCollection(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full cursor-pointer"
                style={{
                  background: 'var(--t-ink)',
                  color: 'white',
                  border: 'none',
                  fontFamily: FONT.sans,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                <span style={{ fontSize: 14, lineHeight: 1, fontWeight: 400 }}>+</span> New
              </button>
            </div>
            <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              {sortedCollections.map(sl => (
                <div key={sl.id}>
                  <CollectionCard collection={sl} places={myPlaces} onClick={() => router.push(`/saved/collections/${sl.id}`)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ All Places ═══ */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 16, color: 'var(--t-ink)', margin: 0 }}>
              {typeFilter !== 'all' ? `${TYPE_CHIPS_WITH_ALL.find(c => c.value === typeFilter)?.label || 'Filtered'}` : 'All places'}
              <span style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['50'], fontStyle: 'normal', marginLeft: 6 }}>
                {filteredPlaces.length}
              </span>
            </h2>
          </div>
          <div className="mb-3">
            <FilterSortBar
              filterGroups={[
                {
                  key: 'type',
                  label: 'Type',
                  options: TYPE_CHIPS_WITH_ALL.map(c => ({
                    value: c.value,
                    label: c.label,
                    icon: c.icon as PerriandIconName,
                  })),
                  value: typeFilter,
                  onChange: (v) => setTypeFilter(v as PlaceType | 'all'),
                },
                {
                  key: 'source',
                  label: 'Source',
                  options: [
                    { value: 'all', label: 'All sources' },
                    ...allSources.map(s => ({
                      value: s.value,
                      label: SOURCE_STYLES[s.value as keyof typeof SOURCE_STYLES]?.label || s.value,
                      icon: (SOURCE_STYLES[s.value as keyof typeof SOURCE_STYLES]?.icon || 'manual') as PerriandIconName,
                      count: s.count,
                    })),
                  ],
                  value: sourceFilter,
                  onChange: setSourceFilter,
                },
                ...(allCities.length > 1 ? [{
                  key: 'city',
                  label: 'Location',
                  options: [
                    { value: 'all', label: 'All cities' },
                    ...allCities.map(c => ({ value: c, label: c })),
                  ],
                  value: cityFilter,
                  onChange: handleCityFilter,
                }] : []),
              ]}
              sortOptions={[
                { value: 'recent', label: 'Most recent' },
                { value: 'match', label: 'Match %' },
                { value: 'name', label: 'A–Z' },
                { value: 'type', label: 'Type' },
                { value: 'source', label: 'Source' },
              ]}
              sortValue={sortBy}
              onSortChange={(v) => setSortBy(v as any)}
              onResetAll={() => {
                setTypeFilter('all');
                setSourceFilter('all');
                setCityFilter('all');
                setSortBy('recent');
              }}
              compact
            />
          </div>
          {filteredPlaces.length > 0 ? (
            <div className="flex flex-col gap-2">
              {filteredPlaces.map(place => (
                <div key={place.id}>
                  <PlaceCard place={place} onTap={() => openDetail(place)} onToggleCollections={() => openCollectionPicker(place)}
                      collectionCount={collectionCountMap[place.id] || 0} onLongPress={() => setAddToTripItem(place)} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <PerriandIcon name="discover" size={36} color={INK['15']} />
              <p className="text-[13px] mt-3" style={{ color: INK['70'] }}>{searchQuery || typeFilter !== 'all' || sourceFilter !== 'all' || cityFilter !== 'all' ? 'No places match your filters' : 'No saved places yet'}</p>
              <p className="text-[11px] mt-1" style={{ color: INK['70'] }}>{searchQuery || typeFilter !== 'all' || sourceFilter !== 'all' || cityFilter !== 'all' ? 'Try adjusting your search or filters' : 'Import places to get started'}</p>
            </div>
          )}
        </div>
      </div>

      {showCreateCollection && (
        <CreateCollectionModal
          onClose={() => setShowCreateCollection(false)}
          onCreate={async (name, emoji) => { setShowCreateCollection(false); const realId = await createCollectionAsync(name, emoji); router.push(`/saved/collections/${realId}`); }}
          onCreateSmart={(name, emoji, query, filterTags, placeIds) => { createSmartCollection(name, emoji, query, filterTags, placeIds); setShowCreateCollection(false); }}
        />
      )}
      {addToTripItem && trips.length > 0 && (
        <AddToTripSheet place={addToTripItem} trips={trips} onClose={() => setAddToTripItem(null)} onAdd={(tripId) => { setAddToTripItem(null); }} />
      )}
      <TabBar />
    </div>
  );
}


// ═══════════════════════════════════════════
// Place Card — Library view card
// ═══════════════════════════════════════════

function PlaceCard({ place, onTap, onToggleCollections, onLongPress, collectionCount }: {
  place: ImportedPlace;
  onTap: () => void;
  onToggleCollections: () => void;
  onLongPress: () => void;
  /** How many collections this place belongs to */
  collectionCount: number;
}) {
  const typeIcon = TYPE_ICONS[place.type] || 'location';
  const google = place.google;
  const priceStr = google?.priceLevel ? '$'.repeat(google.priceLevel) : null;
  const srcStyle = SOURCE_STYLES[place.ghostSource as keyof typeof SOURCE_STYLES] || SOURCE_STYLES.manual;
  const ratingReaction = place.rating ? REACTIONS.find(r => r.id === place.rating!.reaction) : null;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const subtitle = place.friendAttribution?.note
    || (place.rating?.personalNote)
    || place.terrazzoInsight?.why
    || place.tasteNote
    || '';
  const truncSub = subtitle.length > 90 ? subtitle.slice(0, 87) + '…' : subtitle;

  const handlePointerDown = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      onLongPress();
      longPressTimer.current = null;
    }, 500);
  }, [onLongPress]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  return (
    <div
      onClick={onTap}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className="rounded-xl cursor-pointer transition-all overflow-hidden card-hover"
      style={{
        background: 'white',
        border: '1px solid var(--t-linen)',
      }}
    >
      <div className="flex gap-2.5 p-3 pb-0">
        {/* Thumbnail */}
        <div
          className="rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            width: 48, height: 48,
            background: THUMB_GRADIENTS[place.type] || THUMB_GRADIENTS.restaurant,
          }}
        >
          <PerriandIcon name={typeIcon as any} size={20} color={INK['70']} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--t-ink)', fontFamily: FONT.sans }}>
                {place.name}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span style={{ fontFamily: FONT.sans, fontSize: 10, color: INK['70'] }}>
                  {place.type.charAt(0).toUpperCase() + place.type.slice(1)}
                </span>
                <span style={{ fontSize: 10, color: INK['70'] }}>· {place.location.split(',')[0]}</span>
              </div>
            </div>

            {/* Collection bookmark */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleCollections(); }}
              className="flex items-center gap-1 rounded-full px-2 py-1 transition-all flex-shrink-0"
              style={{
                background: collectionCount > 0 ? 'rgba(42,122,86,0.08)' : INK['06'],
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <PerriandIcon name="bookmark" size={12} color={collectionCount > 0 ? 'var(--t-verde)' : INK['40']} />
              {collectionCount > 0 && (
                <span style={{
                  fontFamily: FONT.mono,
                  fontSize: 9,
                  fontWeight: 700,
                  color: 'var(--t-verde)',
                }}>
                  {collectionCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="px-3 pt-2 pb-3">
        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
          {ratingReaction && (
            <span
              className="px-1.5 py-0.5 rounded flex items-center gap-1"
              style={{ fontSize: 9, fontWeight: 600, background: `${ratingReaction.color}10`, color: ratingReaction.color, fontFamily: FONT.mono }}
            >
              <PerriandIcon name={ratingReaction.icon} size={10} color={ratingReaction.color} /> {ratingReaction.label}
            </span>
          )}
          {place.friendAttribution && (
            <span
              className="px-1.5 py-0.5 rounded flex items-center gap-1"
              style={{ fontSize: 9, fontWeight: 600, background: 'rgba(42,122,86,0.06)', color: 'var(--t-verde)', fontFamily: FONT.mono }}
            >
              <PerriandIcon name="friend" size={10} color="var(--t-verde)" /> {place.friendAttribution.name}
            </span>
          )}
          {google?.rating && (
            <span style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['70'], display: 'flex', alignItems: 'center', gap: '4px' }}>
              <PerriandIcon name="star" size={10} color={INK['50']} /> {google.rating}
            </span>
          )}
          {priceStr && (
            <span style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['70'] }}>
              {priceStr}
            </span>
          )}
          <span style={{ fontFamily: FONT.mono, fontSize: 9, fontWeight: 600, color: '#8a6a2a' }}>
            {place.matchScore}%
          </span>
        </div>

        {truncSub && (
          <div style={{
            fontFamily: FONT.sans,
            fontSize: 11,
            color: INK['70'],
            fontStyle: 'italic',
            lineHeight: 1.4,
          }}>
            {truncSub}
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════
// Create Collection Modal
// ═══════════════════════════════════════════

const ICON_OPTIONS: { name: PerriandIconName; label: string }[] = [
  { name: 'pin', label: 'Pin' },
  { name: 'discover', label: 'Discover' },
  { name: 'restaurant', label: 'Restaurant' },
  { name: 'bar', label: 'Bar' },
  { name: 'hotel', label: 'Hotel' },
  { name: 'cafe', label: 'Café' },
  { name: 'museum', label: 'Museum' },
  { name: 'activity', label: 'Activity' },
  { name: 'shop', label: 'Shop' },
  { name: 'heart', label: 'Heart' },
  { name: 'star', label: 'Star' },
  { name: 'food', label: 'Food' },
  { name: 'design', label: 'Design' },
  { name: 'wellness', label: 'Wellness' },
];

interface SmartParsedResult {
  name: string;
  emoji: PerriandIconName;
  filters: {
    types: string[] | null;
    locations: string[] | null;
    friends: string[] | null;
    sources: string[] | null;
    minMatchScore: number | null;
    reactions: string[] | null;
    keywords: string[] | null;
  };
  filterTags: string[];
  reasoning: string;
  matchCount?: number;
  matchingIds?: string[];
}

const SMART_EXAMPLE_PROMPTS = [
  'Everything Lizzie recommended',
  'Best restaurants in Paris',
  'Hotels I loved',
  'Cocktail bars across cities',
  'High-match cafés',
];

function CreateCollectionModal({ onClose, onCreate, onCreateSmart }: {
  onClose: () => void;
  onCreate: (name: string, emoji: string) => void;
  onCreateSmart: (name: string, emoji: string, query: string, filterTags: string[], placeIds: string[]) => void;
}) {
  const isDesktop = useIsDesktop();
  const [name, setName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('pin');
  const [isSmartMode, setIsSmartMode] = useState(false);
  const [smartQuery, setSmartQuery] = useState('');
  const [smartStep, setSmartStep] = useState<'input' | 'thinking' | 'result'>('input');
  const [smartResult, setSmartResult] = useState<SmartParsedResult | null>(null);
  const [smartError, setSmartError] = useState<string | null>(null);
  const myPlaces = useSavedStore(s => s.myPlaces);

  // Count and collect matching place IDs from parsed filters
  const resolveMatches = (result: SmartParsedResult): { count: number; ids: string[] } => {
    const matching = myPlaces.filter((place) => {
      if (result.filters.types && !result.filters.types.includes(place.type)) return false;
      if (result.filters.locations) {
        const matchesLocation = result.filters.locations.some(loc =>
          place.location.toLowerCase().includes(loc.toLowerCase())
        );
        if (!matchesLocation) return false;
      }
      if (result.filters.friends) {
        if (!place.friendAttribution) return false;
        const matchesFriend = result.filters.friends.some(f =>
          place.friendAttribution!.name.toLowerCase().includes(f.toLowerCase())
        );
        if (!matchesFriend) return false;
      }
      if (result.filters.sources && !result.filters.sources.includes(place.ghostSource || '')) return false;
      if (result.filters.minMatchScore && (place.matchScore || 0) < result.filters.minMatchScore) return false;
      if (result.filters.reactions) {
        if (!place.rating) return false;
        if (!result.filters.reactions.includes(place.rating.reaction)) return false;
      }
      if (result.filters.keywords) {
        const placeText = `${place.name} ${place.tasteNote || ''} ${place.location}`.toLowerCase();
        const matchesKeyword = result.filters.keywords.some(kw => placeText.includes(kw.toLowerCase()));
        if (!matchesKeyword) return false;
      }
      return true;
    });
    return { count: matching.length, ids: matching.map(p => p.id) };
  };

  // Basic keyword fallback
  const fallbackParse = (query: string): SmartParsedResult => {
    const lq = query.toLowerCase();
    const filters: SmartParsedResult['filters'] = {
      types: null, locations: null, friends: null,
      sources: null, minMatchScore: null, reactions: null, keywords: null,
    };
    const filterTags: string[] = [];
    let emoji: PerriandIconName = 'sparkle';
    let parsedName = query;

    if (lq.includes('hotel')) { filters.types = ['hotel']; filterTags.push('type: hotel'); emoji = 'hotel'; }
    else if (lq.includes('restaurant')) { filters.types = ['restaurant']; filterTags.push('type: restaurant'); emoji = 'restaurant'; }
    else if (lq.includes('bar')) { filters.types = ['bar']; filterTags.push('type: bar'); emoji = 'bar'; }
    else if (lq.includes('museum')) { filters.types = ['museum']; filterTags.push('type: museum'); emoji = 'museum'; }
    else if (lq.includes('cafe') || lq.includes('café') || lq.includes('coffee')) { filters.types = ['cafe']; filterTags.push('type: cafe'); emoji = 'cafe'; }

    if (lq.includes('paris')) { filters.locations = ['Paris']; filterTags.push('location: Paris'); }
    if (lq.includes('stockholm') || lq.includes('scandi')) { filters.locations = ['Stockholm']; filterTags.push('location: Stockholm'); }
    if (lq.includes('mexico')) { filters.locations = ['Mexico City']; filterTags.push('location: Mexico City'); }
    if (lq.includes('sicily')) { filters.locations = ['Sicily', 'Palermo', 'Taormina', 'Catania']; filterTags.push('location: Sicily'); }
    if (lq.includes('copenhagen')) { filters.locations = ['Copenhagen']; filterTags.push('location: Copenhagen'); }

    if (lq.includes('lizzie')) { filters.friends = ['Lizzie']; filterTags.push('person: Lizzie'); emoji = 'friend'; parsedName = "Lizzie's picks"; }
    if (lq.includes('favorite') || lq.includes('loved')) { filters.reactions = ['myPlace']; filterTags.push('reaction: saved'); }
    if (lq.includes('high-match') || lq.includes('high match') || lq.includes('best')) { filters.minMatchScore = 80; filterTags.push('match: 80+'); }

    return { name: parsedName, emoji, filters, filterTags, reasoning: 'Parsed from keywords (offline)' };
  };

  const handleSmartSubmit = async () => {
    if (!smartQuery.trim()) return;
    setSmartStep('thinking');
    setSmartError(null);

    try {
      const placeSummaries = myPlaces.map(p => ({
        name: p.name, type: p.type, location: p.location,
        ghostSource: p.ghostSource, matchScore: p.matchScore,
        friendAttribution: p.friendAttribution, rating: p.rating,
      }));

      const res = await fetch('/api/smart-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: smartQuery, places: placeSummaries }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to parse query');
      }

      const result: SmartParsedResult = await res.json();
      const { count, ids } = resolveMatches(result);
      result.matchCount = count;
      result.matchingIds = ids;
      setSmartResult(result);
      setSmartStep('result');
    } catch (err: any) {
      console.error('Smart search failed:', err);
      setSmartError(err.message || 'Something went wrong');
      const fallback = fallbackParse(smartQuery);
      const { count, ids } = resolveMatches(fallback);
      fallback.matchCount = count;
      fallback.matchingIds = ids;
      setSmartResult(fallback);
      setSmartStep('result');
    }
  };

  const handleSmartCreate = () => {
    if (!smartResult) return;
    onCreateSmart(
      smartResult.name,
      smartResult.emoji,
      smartQuery,
      smartResult.filterTags,
      smartResult.matchingIds || [],
    );
  };

  const resetSmart = () => {
    setSmartStep('input');
    setSmartQuery('');
    setSmartResult(null);
    setSmartError(null);
  };

  return (
    <>
      {/* Backdrop — desktop only (mobile uses full-screen takeover) */}
      {isDesktop && (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} style={{ opacity: 0, animation: 'fadeInBackdrop 200ms ease both' }} />
      )}
      {/* Centering wrapper on desktop (flex avoids transform conflict with fadeInUp) */}
      <div
        className={isDesktop ? "fixed inset-0 z-50 flex items-center justify-center pointer-events-none" : "fixed inset-0 z-50 flex flex-col"}
        style={!isDesktop ? { height: '100dvh', background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' } : undefined}
      >
      <div
        className={isDesktop ? "rounded-2xl flex flex-col pointer-events-auto" : "contents"}
        style={isDesktop ? {
          width: 520, maxHeight: '80vh',
          background: 'var(--t-cream)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.12)',
          opacity: 0, animation: 'fadeInUp 250ms ease both',
        } : undefined}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{
            height: isDesktop ? 56 : 52,
            borderBottom: '1px solid var(--t-linen)',
            paddingTop: isDesktop ? 0 : 'env(safe-area-inset-top, 0)',
            padding: isDesktop ? '0 24px' : '0 16px',
          }}
        >
          <span
            style={{ fontFamily: FONT.serif, fontSize: isDesktop ? 19 : 17, fontStyle: 'italic', color: 'var(--t-ink)' }}
          >
            New Collection
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center nav-hover"
            style={{ background: INK['05'], border: 'none', cursor: 'pointer' }}
          >
            <PerriandIcon name="close" size={12} color={INK['50']} />
          </button>
        </div>

        {/* Scrollable content */}
        <div
          className="flex-1 overflow-y-auto"
          style={{
            padding: isDesktop ? '16px 24px 24px' : '16px 16px',
            paddingBottom: isDesktop ? 24 : 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))',
          }}
        >
        {/* Mode toggle */}
        <div className="flex gap-1.5 mb-4">
          <button
            onClick={() => { setIsSmartMode(false); resetSmart(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium cursor-pointer transition-all"
            style={{
              background: !isSmartMode ? 'var(--t-ink)' : 'white',
              color: !isSmartMode ? 'white' : INK['60'],
              border: !isSmartMode ? '1px solid var(--t-ink)' : '1px solid var(--t-linen)',
              fontFamily: FONT.mono,
            }}
          >
            <PerriandIcon name="edit" size={10} color={!isSmartMode ? 'white' : INK['50']} />
            Manual
          </button>
          <button
            onClick={() => setIsSmartMode(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium cursor-pointer transition-all"
            style={{
              background: isSmartMode ? 'var(--t-ink)' : 'white',
              color: isSmartMode ? 'white' : INK['60'],
              border: isSmartMode ? '1px solid var(--t-ink)' : '1px solid var(--t-linen)',
              fontFamily: FONT.mono,
            }}
          >
            <PerriandIcon name="sparkle" size={10} color={isSmartMode ? 'white' : INK['50']} />
            Terrazzo curate
          </button>
        </div>

        {/* ═══ Manual Mode ═══ */}
        {!isSmartMode && (
          <>
            {/* Icon picker */}
            <div className="grid grid-cols-7 gap-1.5 mb-4">
              {ICON_OPTIONS.map(icon => (
                <button
                  key={icon.name}
                  onClick={() => setSelectedEmoji(icon.name)}
                  className="aspect-square rounded-lg flex items-center justify-center cursor-pointer transition-all"
                  style={{
                    background: selectedEmoji === icon.name ? 'var(--t-ink)' : 'white',
                    border: selectedEmoji === icon.name ? 'none' : '1px solid var(--t-linen)',
                  }}
                >
                  <PerriandIcon
                    name={icon.name}
                    size={14}
                    color={selectedEmoji === icon.name ? 'white' : INK['50']}
                  />
                </button>
              ))}
            </div>

            {/* Name input — 16px font prevents iOS zoom */}
            <input
              type="text"
              placeholder="Collection name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full rounded-lg py-2.5 px-3 mb-4 focus-ring"
              style={{
                fontSize: 16,
                background: isDesktop ? 'var(--t-cream)' : 'white',
                border: '1px solid var(--t-linen)',
                color: 'var(--t-ink)',
                fontFamily: FONT.sans,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            {/* Create button */}
            <button
              onClick={() => { if (name.trim()) onCreate(name.trim(), selectedEmoji); }}
              disabled={!name.trim()}
              className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all cursor-pointer btn-hover"
              style={{
                background: name.trim() ? 'var(--t-ink)' : INK['10'],
                color: name.trim() ? 'white' : INK['30'],
                border: 'none',
                fontFamily: FONT.sans,
                boxSizing: 'border-box',
              }}
            >
              Create Collection
            </button>
          </>
        )}

        {/* ═══ Smart / AI Mode ═══ */}
        {isSmartMode && smartStep === 'input' && (
          <div>
            {/* Description input — 16px font prevents iOS zoom */}
            <input
              type="text"
              placeholder="Describe your collection..."
              value={smartQuery}
              onChange={(e) => setSmartQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSmartSubmit(); }}
              autoFocus
              className="w-full rounded-lg py-2.5 px-3 mb-3"
              style={{
                fontSize: 16,
                background: 'white',
                border: '1px solid var(--t-linen)',
                color: 'var(--t-ink)',
                fontFamily: FONT.sans,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            {/* Example prompts */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {SMART_EXAMPLE_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => setSmartQuery(prompt)}
                  className="px-2.5 py-1 rounded-full text-[10px] cursor-pointer transition-colors"
                  style={{
                    background: 'white',
                    border: '1px solid var(--t-linen)',
                    color: INK['70'],
                    fontFamily: FONT.sans,
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Submit button */}
            <button
              onClick={handleSmartSubmit}
              disabled={!smartQuery.trim()}
              className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
              style={{
                background: smartQuery.trim() ? 'var(--t-ink)' : INK['10'],
                color: smartQuery.trim() ? 'white' : INK['30'],
                border: 'none',
                fontFamily: FONT.sans,
                boxSizing: 'border-box',
              }}
            >
              <PerriandIcon name="sparkle" size={11} color={smartQuery.trim() ? 'white' : INK['30']} />
              Find places
            </button>
          </div>
        )}

        {/* ═══ AI Thinking ═══ */}
        {isSmartMode && smartStep === 'thinking' && (
          <div className="py-4">
            <div className="p-3 rounded-xl" style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    className="rounded-lg"
                    style={{
                      height: i === 3 ? 16 : 20,
                      width: i === 2 ? '65%' : '100%',
                      background: 'linear-gradient(90deg, var(--t-linen), var(--t-cream), var(--t-linen))',
                      backgroundSize: '200% 100%',
                      animation: 'smartShimmer 2s infinite',
                      animationDelay: `${0.1 * i}s`,
                    }}
                  />
                ))}
              </div>
            </div>
            <p
              className="text-center text-[10px] mt-2"
              style={{ color: INK['70'], fontFamily: FONT.mono }}
            >
              Terrazzo is curating...
            </p>
          </div>
        )}

        {/* ═══ AI Result ═══ */}
        {isSmartMode && smartStep === 'result' && smartResult && (
          <div>
            {/* AI reasoning */}
            {smartResult.reasoning && (
              <div
                className="text-[10px] leading-relaxed px-3 py-2 rounded-lg flex gap-2 items-start mb-3"
                style={{ color: INK['80'], background: 'rgba(200,146,58,0.06)' }}
              >
                <PerriandIcon name="sparkle" size={10} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontFamily: FONT.sans }}>{smartResult.reasoning}</span>
              </div>
            )}

            {/* Error fallback notice */}
            {smartError && (
              <div
                className="text-[9px] px-2.5 py-1.5 rounded-lg mb-2"
                style={{ color: INK['70'], background: 'rgba(107,139,154,0.06)', fontFamily: FONT.mono }}
              >
                Offline mode — {smartError}
              </div>
            )}

            {/* Result preview */}
            <div className="p-3 rounded-xl mb-3" style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
              <div className="flex items-center gap-2 mb-2">
                <PerriandIcon name={smartResult.emoji} size={16} />
                <span
                  className="text-[14px] font-semibold"
                  style={{ fontFamily: FONT.serif, fontStyle: 'italic', color: 'var(--t-ink)' }}
                >
                  {smartResult.name}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[11px] font-bold"
                  style={{ fontFamily: FONT.mono, color: 'var(--t-verde)' }}
                >
                  {smartResult.matchCount ?? 0} places
                </span>
              </div>
              {smartResult.filterTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {smartResult.filterTags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full text-[9px]"
                      style={{
                        background: 'rgba(42,122,86,0.08)',
                        color: 'var(--t-verde)',
                        fontFamily: FONT.mono,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={resetSmart}
                className="flex-1 py-2.5 rounded-xl text-[12px] font-medium cursor-pointer"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--t-linen)',
                  color: 'var(--t-ink)',
                  fontFamily: FONT.sans,
                }}
              >
                Try again
              </button>
              <button
                onClick={handleSmartCreate}
                className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold cursor-pointer flex items-center justify-center gap-1.5"
                style={{
                  background: 'var(--t-ink)',
                  color: 'white',
                  border: 'none',
                  fontFamily: FONT.sans,
                }}
              >
                Create
                <PerriandIcon name="sparkle" size={10} color="white" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Shimmer animation for AI thinking */}
      <style>{`
        @keyframes smartShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
    </div>
    </>
  );
}


// ═══════════════════════════════════════════
// Add to Trip Sheet — quick-add from Library
// ═══════════════════════════════════════════

import type { Trip } from '@/types';
import { FONT, INK } from '@/constants/theme';

function AddToTripSheet({ place, trips, onClose, onAdd }: {
  place: ImportedPlace;
  trips: Trip[];
  onClose: () => void;
  onAdd: (tripId: string) => void;
}) {
  const isDesktop = useIsDesktop();
  return (
    <div
      className={isDesktop ? "fixed inset-0 z-50 flex items-center justify-center" : "fixed inset-0 z-50 flex items-end justify-center"}
      style={{ height: '100dvh' }}
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.3)', ...(isDesktop ? { opacity: 0, animation: 'fadeInBackdrop 200ms ease both' } : {}) }} />
      <div
        onClick={(e) => e.stopPropagation()}
        className={isDesktop ? "relative rounded-2xl px-7 pt-6 pb-8" : "relative w-full rounded-t-2xl px-5 pt-5 pb-8"}
        style={isDesktop ? {
          width: 440, background: 'var(--t-cream)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.12)',
          opacity: 0, animation: 'fadeInUp 250ms ease both',
        } : { maxWidth: 480, background: 'var(--t-cream)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[14px] font-semibold" style={{ color: 'var(--t-ink)', fontFamily: FONT.serif }}>
              Add to trip
            </div>
            <div className="text-[11px]" style={{ color: INK['70'] }}>
              {place.name}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center"
            style={{ color: INK['70'], background: 'none', border: 'none', cursor: 'pointer', width: 24, height: 24 }}
          >
            <PerriandIcon name="close" size={16} color={INK['50']} />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {trips.map(trip => (
            <button
              key={trip.id}
              onClick={() => onAdd(trip.id)}
              className="flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all card-hover"
              style={{ background: 'white', border: '1px solid var(--t-linen)' }}
            >
              <div>
                <div className="text-[13px] font-semibold" style={{ color: 'var(--t-ink)' }}>
                  {trip.name}
                </div>
                <div className="text-[10px]" style={{ color: INK['70'] }}>
                  {trip.location} {trip.startDate && `· ${trip.startDate}`}
                </div>
              </div>
              <span className="text-[11px]" style={{ color: '#8a6a2a' }}>Add →</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

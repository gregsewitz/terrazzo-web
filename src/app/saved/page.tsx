'use client';

import { motion } from 'framer-motion';
import { useMemo, useState, useCallback } from 'react';
import PageTransition from '@/components/ui/PageTransition';
import { useRouter } from 'next/navigation';
import TabBar from '@/components/ui/TabBar';
import DesktopNav from '@/components/ui/DesktopNav';
import ProfileAvatar from '@/components/profile/ProfileAvatar';
import CollectionCard from '@/components/library/CollectionCard';
import { useSavedStore } from '@/stores/savedStore';
import { useTripStore } from '@/stores/tripStore';
import { PlaceType, ImportedPlace, SOURCE_STYLES } from '@/types';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';
import PlaceSearchBar from '@/components/place/PlaceSearchBar';
import { PlaceDetailProvider, usePlaceDetail } from '@/context/PlaceDetailContext';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import FilterSortBar from '@/components/ui/FilterSortBar';
import { TYPE_CHIPS_WITH_ALL } from '@/constants/placeTypes';
import { FONT, INK, TEXT, COLOR } from '@/constants/theme';
import BrandLoader from '@/components/ui/BrandLoader';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { PlaceCard, CreateCollectionModal, AddToTripSheet } from '@/components/saved';
import { useAddBarStore } from '@/stores/addBarStore';
import { useFirstActionPrompt } from '@/hooks/useFirstActionPrompts';
import FirstActionCard from '@/components/ui/FirstActionCard';
import { useMilestoneToast } from '@/hooks/useMilestoneToast';
import { useMilestoneToastUI } from '@/components/ui/MilestoneToast';

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
  const dbHydrated = useOnboardingStore(s => s.dbHydrated);
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
  const openAddBar = useAddBarStore(s => s.open);
  const [addToTripItem, setAddToTripItem] = useState<ImportedPlace | null>(null);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [collectionsExpanded, setCollectionsExpanded] = useState(false);

  // ─── First-action prompts ───
  const { isVisible: showCollectIntro, dismiss: dismissCollectIntro } = useFirstActionPrompt('collect_intro');

  // ─── Milestone toasts ───
  const [showToast, ToastContainer] = useMilestoneToastUI();
  const userSavedCount = myPlaces.filter(p => p.source?.type !== 'terrazzo').length;
  useMilestoneToast([
    { key: 'first_save', condition: userSavedCount >= 1, message: 'Saved. Your library is growing.' },
    { key: 'five_saves', condition: userSavedCount >= 5, message: 'Five places saved. Terrazzo is starting to see patterns.' },
    { key: 'ten_saves', condition: userSavedCount >= 10, message: 'Ten places. Your taste map is getting rich.' },
  ], showToast);

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
      const src = p.source?.type || 'manual';
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
      places = places.filter(p => (p.source?.type || 'manual') === sourceFilter);
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
      case 'source': sorted.sort((a, b) => (a.source?.type || '').localeCompare(b.source?.type || '')); break;
    }
    return sorted;
  }, [myPlaces, searchQuery, typeFilter, cityFilter, sourceFilter, sortBy, parseLocation]);


  // ─── Uncollected places (not in any collection) ───
  const uncollectedPlaces = useMemo(() => {
    const collectedIds = new Set(collections.flatMap(sl => sl.placeIds));
    return filteredPlaces.filter(p => !collectedIds.has(p.id));
  }, [filteredPlaces, collections]);

  // Wait for DB hydration before rendering
  if (!dbHydrated) {
    return <BrandLoader message="Loading your library…" />;
  }

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
                    color: TEXT.primary,
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  Collect
                </h1>
              </motion.div>
              <p style={{ fontFamily: FONT.mono, fontSize: 12, color: TEXT.secondary, margin: '6px 0 0' }}>
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

          {/* ═══ First-action prompt ═══ */}
          {myPlaces.length > 0 && (
            <FirstActionCard
              isVisible={showCollectIntro}
              onDismiss={dismissCollectIntro}
              icon="sparkle"
              message="These are places we think you'd love. Save ones that resonate — or add your own from Google Maps, articles, or email."
              hint="Tap any place to see why it matches your taste."
            />
          )}

          {/* ═══ Collections section ═══ */}
          {sortedCollections.length > 0 && (
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 20, color: TEXT.primary, margin: 0 }}>
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
                  onSortChange={(v) => setCollectionSortBy(v as 'recent' | 'name' | 'places' | 'updated')}
                  compact
                />
              </div>
              {/* Cap at ~2 rows (10 items) when not expanded */}
              <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className="grid gap-3"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
              >
                {(collectionsExpanded ? sortedCollections : sortedCollections.slice(0, 10)).map(sl => (
                  <motion.div key={sl.id} variants={cardVariants}>
                    <CollectionCard
                      collection={sl}
                      places={myPlaces}
                      onClick={() => router.push(`/saved/collections/${sl.id}`)}
                    />
                  </motion.div>
                ))}
              </motion.div>
              {sortedCollections.length > 10 && (
                <motion.button
                  onClick={() => setCollectionsExpanded(!collectionsExpanded)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="flex items-center justify-center gap-1.5 mt-4 px-5 py-2 rounded-lg cursor-pointer mx-auto"
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--t-linen)',
                    fontFamily: FONT.sans,
                    fontSize: 12,
                    fontWeight: 500,
                    color: TEXT.secondary,
                  }}
                >
                  {collectionsExpanded
                    ? <>Show less <span style={{ fontSize: 10 }}>▲</span></>
                    : <>Show all {sortedCollections.length} collections <span style={{ fontSize: 10 }}>▼</span></>
                  }
                </motion.button>
              )}
            </div>
          )}

          {/* ═══ All Places grid ═══ */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 20, color: TEXT.primary, margin: 0 }}>
                {typeFilter !== 'all' ? `${TYPE_CHIPS_WITH_ALL.find(c => c.value === typeFilter)?.label || 'Filtered'} places` : 'All places'}
                <span style={{ fontFamily: FONT.mono, fontSize: 12, color: TEXT.secondary, fontStyle: 'normal', marginLeft: 8 }}>
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
                onSortChange={(v) => setSortBy(v as 'recent' | 'match' | 'name' | 'type' | 'source')}
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
                  <motion.div key={place.id} variants={cardVariants} className="h-full">
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
            ) : searchQuery || typeFilter !== 'all' || cityFilter !== 'all' ? (
              <div className="text-center py-16">
                <PerriandIcon name="discover" size={36} color={TEXT.secondary} />
                <p className="text-[13px] mt-3" style={{ color: TEXT.secondary }}>No places match your current filters</p>
                <p className="text-[11px] mt-1" style={{ color: TEXT.secondary }}>Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="text-center py-16 px-6">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(58,128,136,0.06)' }}>
                    <PerriandIcon name="saved" size={32} color="var(--t-dark-teal)" />
                  </div>
                </div>
                <h3 style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 20, color: TEXT.primary, margin: '0 0 8px' }}>
                  Your place library
                </h3>
                <p className="text-[13px] leading-relaxed max-w-xs mx-auto" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>
                  This is where taste meets territory. Import from Google Maps, paste an article link, or explore your Discover feed to start building.
                </p>
                <div className="flex flex-col gap-2 mt-6 max-w-[240px] mx-auto">
                  <button
                    onClick={() => openAddBar()}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-none cursor-pointer transition-all hover:opacity-90"
                    style={{ background: 'var(--t-navy)', color: 'white', fontFamily: FONT.sans, fontSize: 13, fontWeight: 600 }}
                  >
                    <PerriandIcon name="add" size={14} color="white" />
                    Add your first place
                  </button>
                  <button
                    onClick={() => router.push('/discover')}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl cursor-pointer transition-all hover:opacity-90"
                    style={{ background: 'transparent', border: '1px solid var(--t-linen)', color: TEXT.secondary, fontFamily: FONT.sans, fontSize: 13, fontWeight: 500 }}
                  >
                    <PerriandIcon name="discover" size={14} color={TEXT.secondary} />
                    Browse Discover feed
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ═══ Uncollected section ═══ */}
          {uncollectedPlaces.length > 0 && uncollectedPlaces.length < filteredPlaces.length && typeFilter === 'all' && (
            <div className="mt-10 pt-8" style={{ borderTop: '1px solid var(--t-linen)' }}>
              <h2 style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 18, color: TEXT.secondary, margin: '0 0 12px' }}>
                Uncollected
                <span style={{ fontFamily: FONT.mono, fontSize: 12, color: TEXT.secondary, fontStyle: 'normal', marginLeft: 8 }}>
                  {uncollectedPlaces.length}
                </span>
              </h2>
              <p style={{ fontFamily: FONT.sans, fontSize: 12, color: TEXT.secondary, margin: '0 0 16px' }}>
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
                  <motion.div key={place.id} variants={cardVariants} className="h-full">
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
        <ToastContainer />
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
                color: TEXT.primary,
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Collect
            </h1>
            <span style={{ fontFamily: FONT.mono, fontSize: 10, color: TEXT.secondary }}>
              {myPlaces.length} places
            </span>
          </div>
          <ProfileAvatar />
        </div>

        {/* ═══ Search ═══ */}
        <div className="mb-3"><PlaceSearchBar /></div>

        {/* ═══ First-action prompt ═══ */}
        {myPlaces.length > 0 && (
          <FirstActionCard
            isVisible={showCollectIntro}
            onDismiss={dismissCollectIntro}
            icon="sparkle"
            message="These are places we think you'd love. Save ones that resonate — or add your own from Google Maps, articles, or email."
            hint="Tap any place to see why it matches your taste."
          />
        )}

        {/* ═══ Collections section ═══ */}
        {sortedCollections.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 16, color: TEXT.primary, margin: 0 }}>
                Collections
                <span style={{ fontFamily: FONT.mono, fontSize: 10, color: TEXT.secondary, fontStyle: 'normal', marginLeft: 6 }}>
                  {sortedCollections.length}
                </span>
              </h2>
              <div className="flex items-center gap-2">
                {sortedCollections.length > 6 && !collectionsExpanded && (
                  <button
                    onClick={() => setCollectionsExpanded(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full cursor-pointer"
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--t-linen)',
                      fontFamily: FONT.sans,
                      fontSize: 11,
                      fontWeight: 500,
                      color: TEXT.secondary,
                    }}
                  >
                    See all
                  </button>
                )}
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
            </div>

            {/* ≤6 collections: always show grid (no carousel needed) */}
            {/* >6 collections: carousel by default, expandable to grid */}
            {sortedCollections.length <= 6 || collectionsExpanded ? (
              /* ── Full 2-column grid ── */
              <>
                <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  {sortedCollections.map(sl => (
                    <div key={sl.id}>
                      <CollectionCard collection={sl} places={myPlaces} onClick={() => router.push(`/saved/collections/${sl.id}`)} />
                    </div>
                  ))}
                </div>
                {sortedCollections.length > 6 && (
                  <button
                    onClick={() => setCollectionsExpanded(false)}
                    className="w-full flex items-center justify-center gap-1 mt-3 py-2 rounded-lg cursor-pointer"
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--t-linen)',
                      fontFamily: FONT.sans,
                      fontSize: 12,
                      fontWeight: 500,
                      color: TEXT.secondary,
                    }}
                  >
                    Show less
                    <span style={{ fontSize: 10, marginTop: -1 }}>▲</span>
                  </button>
                )}
              </>
            ) : (
              /* ── Collapsed: horizontal scroll carousel ── */
              <div
                className="collections-carousel flex gap-2.5 overflow-x-auto"
                style={{
                  scrollSnapType: 'x mandatory',
                  WebkitOverflowScrolling: 'touch',
                  paddingBottom: 2,
                  /* hide scrollbar */
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                <style>{`.collections-carousel::-webkit-scrollbar { display: none; }`}</style>
                {sortedCollections.map(sl => (
                  <div
                    key={sl.id}
                    className="flex-shrink-0"
                    style={{ width: 160, scrollSnapAlign: 'start' }}
                  >
                    <CollectionCard collection={sl} places={myPlaces} onClick={() => router.push(`/saved/collections/${sl.id}`)} />
                  </div>
                ))}
                {/* See All moved to header row for visibility */}
              </div>
            )}
          </div>
        )}

        {/* ═══ All Places ═══ */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 16, color: TEXT.primary, margin: 0 }}>
              {typeFilter !== 'all' ? `${TYPE_CHIPS_WITH_ALL.find(c => c.value === typeFilter)?.label || 'Filtered'}` : 'All places'}
              <span style={{ fontFamily: FONT.mono, fontSize: 10, color: TEXT.secondary, fontStyle: 'normal', marginLeft: 6 }}>
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
              onSortChange={(v) => setSortBy(v as 'recent' | 'match' | 'name' | 'type' | 'source')}
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
          ) : searchQuery || typeFilter !== 'all' || sourceFilter !== 'all' || cityFilter !== 'all' ? (
            <div className="text-center py-16">
              <PerriandIcon name="discover" size={36} color={TEXT.secondary} />
              <p className="text-[13px] mt-3" style={{ color: TEXT.secondary }}>No places match your current filters</p>
              <p className="text-[11px] mt-1" style={{ color: TEXT.secondary }}>Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="text-center py-16 px-6">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(58,128,136,0.06)' }}>
                  <PerriandIcon name="saved" size={32} color="var(--t-dark-teal)" />
                </div>
              </div>
              <h3 style={{ fontFamily: FONT.serif, fontStyle: 'italic', fontSize: 20, color: TEXT.primary, margin: '0 0 8px' }}>
                Your place library
              </h3>
              <p className="text-[13px] leading-relaxed max-w-xs mx-auto" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>
                This is where taste meets territory. Import from Google Maps, paste an article link, or explore your Discover feed to start building.
              </p>
              <div className="flex flex-col gap-2 mt-6 max-w-[240px] mx-auto">
                <button
                  onClick={() => openAddBar()}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-none cursor-pointer transition-all hover:opacity-90"
                  style={{ background: 'var(--t-navy)', color: 'white', fontFamily: FONT.sans, fontSize: 13, fontWeight: 600 }}
                >
                  <PerriandIcon name="add" size={14} color="white" />
                  Add your first place
                </button>
                <button
                  onClick={() => router.push('/discover')}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl cursor-pointer transition-all hover:opacity-90"
                  style={{ background: 'transparent', border: '1px solid var(--t-linen)', color: TEXT.secondary, fontFamily: FONT.sans, fontSize: 13, fontWeight: 500 }}
                >
                  <PerriandIcon name="discover" size={14} color={TEXT.secondary} />
                  Browse Discover feed
                </button>
              </div>
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
      <ToastContainer />
      <TabBar />
    </div>
  );
}


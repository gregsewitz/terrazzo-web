'use client';

import { useMemo, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TabBar from '@/components/TabBar';
import DesktopNav from '@/components/DesktopNav';
import ShortlistCard from '@/components/ShortlistCard';
import { useSavedStore } from '@/stores/savedStore';
import { useTripStore } from '@/stores/tripStore';
import { REACTIONS, PlaceType, ImportedPlace, SOURCE_STYLES } from '@/types';
import ImportDrawer from '@/components/ImportDrawer';
import { useImportStore } from '@/stores/importStore';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';
import PlaceSearchBar from '@/components/PlaceSearchBar';
import { PlaceDetailProvider, usePlaceDetail } from '@/context/PlaceDetailContext';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import FilterSortBar from '@/components/ui/FilterSortBar';
import { TYPE_ICONS, THUMB_GRADIENTS } from '@/constants/placeTypes';

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

function SavedPageContent() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const { openDetail, openShortlistPicker } = usePlaceDetail();
  const myPlaces = useSavedStore(s => s.myPlaces);
  const shortlists = useSavedStore(s => s.shortlists);
  const activeView = useSavedStore(s => s.activeView);
  const setActiveView = useSavedStore(s => s.setActiveView);
  const searchQuery = useSavedStore(s => s.searchQuery);
  const setSearchQuery = useSavedStore(s => s.setSearchQuery);
  const typeFilter = useSavedStore(s => s.typeFilter);
  const setTypeFilter = useSavedStore(s => s.setTypeFilter);
  const cityFilter = useSavedStore(s => s.cityFilter);
  const setCityFilter = useSavedStore(s => s.setCityFilter);
  const toggleStar = useSavedStore(s => s.toggleStar);
  const createShortlistAsync = useSavedStore(s => s.createShortlistAsync);
  const createSmartShortlist = useSavedStore(s => s.createSmartShortlist);
  const trips = useTripStore(s => s.trips);
  const importOpen = useImportStore(s => s.isOpen);
  const importPatch = useImportStore(s => s.patch);
  const resetImport = useImportStore(s => s.reset);

  const [addToTripItem, setAddToTripItem] = useState<ImportedPlace | null>(null);
  const [showCreateShortlist, setShowCreateShortlist] = useState(false);

  // ─── Shortlist sorting ───
  const [shortlistSortBy, setShortlistSortBy] = useState<'recent' | 'name' | 'places' | 'updated'>('recent');

  const sortedShortlists = useMemo(() => {
    const sorted = [...shortlists];
    switch (shortlistSortBy) {
      case 'name': sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'places': sorted.sort((a, b) => b.placeIds.length - a.placeIds.length); break;
      case 'updated': sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()); break;
      default: sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
    }
    return sorted;
  }, [shortlists, shortlistSortBy]);

  // ─── Library filtering ───
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [neighborhoodFilter, setNeighborhoodFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'match' | 'name' | 'type' | 'source'>('match');

  // Parse city from second segment, neighborhood from first
  const parseLocation = useCallback((loc: string) => {
    const parts = loc.split(',').map(s => s.trim());
    // Format: "Neighborhood, City" or just "City"
    if (parts.length >= 2) {
      return { neighborhood: parts[0], city: parts[1] };
    }
    return { neighborhood: '', city: parts[0] };
  }, []);

  // Build city → neighborhoods map
  const { allCities, cityNeighborhoods } = useMemo(() => {
    const cityCount: Record<string, number> = {};
    const neighborhoods: Record<string, Set<string>> = {};
    myPlaces.forEach(p => {
      const { city, neighborhood } = parseLocation(p.location);
      if (city) {
        cityCount[city] = (cityCount[city] || 0) + 1;
        if (!neighborhoods[city]) neighborhoods[city] = new Set();
        if (neighborhood) neighborhoods[city].add(neighborhood);
      }
    });
    // Sort by count descending, then alphabetically
    const sorted = Object.entries(cityCount)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([city]) => city);
    const nbMap: Record<string, string[]> = {};
    for (const [city, set] of Object.entries(neighborhoods)) {
      nbMap[city] = Array.from(set).sort();
    }
    return { allCities: sorted, cityNeighborhoods: nbMap };
  }, [myPlaces, parseLocation]);

  // Reset neighborhood when city changes
  const handleCityFilter = useCallback((city: string) => {
    setCityFilter(city);
    setNeighborhoodFilter('all');
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
    if (neighborhoodFilter !== 'all') {
      places = places.filter(p => {
        const { neighborhood } = parseLocation(p.location);
        return neighborhood.toLowerCase() === neighborhoodFilter.toLowerCase();
      });
    }
    if (sourceFilter !== 'all') {
      places = places.filter(p => {
        if (sourceFilter === 'friend') return !!p.friendAttribution;
        return p.ghostSource === sourceFilter;
      });
    }
    // Sort
    const sorted = [...places];
    switch (sortBy) {
      case 'match': sorted.sort((a, b) => b.matchScore - a.matchScore); break;
      case 'name': sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'type': sorted.sort((a, b) => a.type.localeCompare(b.type)); break;
      case 'source': sorted.sort((a, b) => (a.ghostSource || '').localeCompare(b.ghostSource || '')); break;
    }
    return sorted;
  }, [myPlaces, searchQuery, typeFilter, cityFilter, neighborhoodFilter, sourceFilter, sortBy, parseLocation]);


  /* ─── Desktop Collect layout ─── */
  if (isDesktop) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--t-cream)' }}>
        <DesktopNav />
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '36px 48px 48px' }}>
          {/* ═══ Header row ═══ */}
          <div className="flex items-end justify-between mb-8">
            <div>
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
              <p style={{ fontFamily: FONT.mono, fontSize: 12, color: INK['60'], margin: '6px 0 0' }}>
                {myPlaces.length} places across {allCities.length} {allCities.length === 1 ? 'city' : 'cities'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => importPatch({ isOpen: true })}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-full cursor-pointer btn-hover"
                style={{
                  background: 'rgba(232,115,58,0.08)',
                  border: '1px solid rgba(232,115,58,0.15)',
                  color: '#c45020',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: FONT.mono,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M2 12L8 3L14 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 8.5H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Import
              </button>
              <button
                onClick={() => setShowCreateShortlist(true)}
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
                <span>+</span> New Shortlist
              </button>
            </div>
          </div>

          {/* ═══ View toggle ═══ */}
          <div className="flex items-center gap-1.5 mb-7">
            {(['shortlists', 'library'] as const).map(view => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className="px-5 py-2.5 rounded-full text-[13px] font-medium cursor-pointer btn-hover"
                style={{
                  background: activeView === view ? 'var(--t-ink)' : 'transparent',
                  color: activeView === view ? 'white' : INK['60'],
                  border: activeView === view ? 'none' : '1px solid var(--t-linen)',
                  fontFamily: FONT.sans,
                  transition: 'all 150ms ease',
                }}
              >
                {view === 'shortlists' ? `Shortlists (${shortlists.length})` : `Library (${filteredPlaces.length})`}
              </button>
            ))}
          </div>

          {/* ═══ Shortlists — Desktop grid ═══ */}
          {activeView === 'shortlists' && (
            <>
              <div className="flex items-center gap-4 mb-5">
                <div style={{ maxWidth: 400, flex: 1 }}>
                  <PlaceSearchBar />
                </div>
                <FilterSortBar
                  sortOptions={[
                    { value: 'recent', label: 'Recently created' },
                    { value: 'updated', label: 'Recently updated' },
                    { value: 'name', label: 'A–Z' },
                    { value: 'places', label: 'Most places' },
                  ]}
                  sortValue={shortlistSortBy}
                  onSortChange={(v) => setShortlistSortBy(v as any)}
                  compact
                />
              </div>
              {sortedShortlists.length > 0 ? (
                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
                >
                  {sortedShortlists.map(sl => (
                    <ShortlistCard
                      key={sl.id}
                      shortlist={sl}
                      places={myPlaces}
                      onClick={() => router.push(`/saved/shortlists/${sl.id}`)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <PerriandIcon name="saved" size={36} color={INK['15']} />
                  <p className="text-[13px] mt-3" style={{ color: INK['70'] }}>No shortlists yet</p>
                </div>
              )}
            </>
          )}

          {/* ═══ Library — Desktop sidebar filters + grid ═══ */}
          {activeView === 'library' && (
            <div className="flex gap-8">
              {/* Left sidebar: filters */}
              <div className="flex-shrink-0" style={{ width: 220 }}>
                <div className="mb-5">
                  <PlaceSearchBar />
                </div>

                <FilterSortBar
                  filterGroups={[
                    {
                      key: 'type',
                      label: 'Type',
                      options: [
                        { value: 'all', label: 'All types' },
                        { value: 'restaurant', label: 'Restaurant' },
                        { value: 'bar', label: 'Bar' },
                        { value: 'cafe', label: 'Café' },
                        { value: 'hotel', label: 'Hotel' },
                        { value: 'museum', label: 'Museum' },
                        { value: 'activity', label: 'Activity' },
                      ],
                      value: typeFilter,
                      onChange: (v) => setTypeFilter(v as any),
                    },
                    ...(allCities.length > 1 ? [{
                      key: 'city',
                      label: 'City',
                      options: [
                        { value: 'all', label: 'All cities' },
                        ...allCities.map(c => ({ value: c, label: c })),
                      ],
                      value: cityFilter,
                      onChange: (v: string) => handleCityFilter(v),
                    }] : []),
                    ...(cityFilter !== 'all' && cityNeighborhoods[cityFilter] && cityNeighborhoods[cityFilter].length > 1 ? [{
                      key: 'neighborhood',
                      label: 'Neighborhood',
                      options: [
                        { value: 'all', label: 'All areas' },
                        ...cityNeighborhoods[cityFilter].map(nb => ({ value: nb, label: nb })),
                      ],
                      value: neighborhoodFilter,
                      onChange: (v: string) => setNeighborhoodFilter(v),
                    }] : []),
                    {
                      key: 'source',
                      label: 'Source',
                      options: [
                        { value: 'all', label: 'All sources' },
                        { value: 'friend', label: 'Friends' },
                        { value: 'article', label: 'Articles' },
                        { value: 'maps', label: 'Maps' },
                        { value: 'email', label: 'Email' },
                      ],
                      value: sourceFilter,
                      onChange: (v) => setSourceFilter(v),
                    },
                  ]}
                  sortOptions={[
                    { value: 'match', label: 'Match %' },
                    { value: 'name', label: 'A–Z' },
                    { value: 'type', label: 'Type' },
                    { value: 'source', label: 'Source' },
                  ]}
                  sortValue={sortBy}
                  onSortChange={(v) => setSortBy(v as any)}
                  onResetAll={() => { setTypeFilter('all'); handleCityFilter('all'); setSourceFilter('all'); setSortBy('match'); }}
                />
              </div>

              {/* Right: place grid */}
              <div className="flex-1 min-w-0">
                {filteredPlaces.length > 0 ? (
                  <div
                    className="grid gap-4"
                    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
                  >
                    {filteredPlaces.map(place => (
                      <PlaceCard
                        key={place.id}
                        place={place}
                        onTap={() => openDetail(place)}
                        onToggleStar={() => openShortlistPicker(place)}
                        onLongPress={() => setAddToTripItem(place)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <PerriandIcon name="discover" size={36} color={INK['15']} />
                    <p className="text-[13px] mt-3" style={{ color: INK['70'] }}>
                      {searchQuery || typeFilter !== 'all' || cityFilter !== 'all' || sourceFilter !== 'all'
                        ? 'No places match your filters'
                        : 'No saved places yet'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ═══ Shared overlays ═══ */}
        {showCreateShortlist && (
          <CreateShortlistModal
            onClose={() => setShowCreateShortlist(false)}
            onCreate={async (name, emoji) => {
              setShowCreateShortlist(false);
              const realId = await createShortlistAsync(name, emoji);
              router.push(`/saved/shortlists/${realId}`);
            }}
            onCreateSmart={(name, emoji, query, filterTags, placeIds) => {
              createSmartShortlist(name, emoji, query, filterTags, placeIds);
              setShowCreateShortlist(false);
            }}
          />
        )}
        {addToTripItem && trips.length > 0 && (
          <AddToTripSheet
            place={addToTripItem}
            trips={trips}
            onClose={() => setAddToTripItem(null)}
            onAdd={(tripId) => {
              if (!addToTripItem.isShortlisted) {
                toggleStar(addToTripItem.id);
              }
              setAddToTripItem(null);
            }}
          />
        )}
        {importOpen && (
          <ImportDrawer onClose={() => { resetImport(); importPatch({ isOpen: false }); }} />
        )}
      </div>
    );
  }

  /* ─── Mobile Collect layout (unchanged) ─── */
  return (
    <div className="min-h-screen" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto', paddingBottom: 64, overflowX: 'hidden', boxSizing: 'border-box' }}>
      <div className="px-4 pt-5">
        {/* ═══ Header ═══ */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span
              onClick={() => setActiveView('shortlists')}
              className="cursor-pointer transition-all"
              style={{
                fontFamily: FONT.serif,
                fontStyle: 'italic',
                fontSize: activeView === 'shortlists' ? 22 : 14,
                color: activeView === 'shortlists' ? 'var(--t-ink)' : INK['70'],
                lineHeight: 1.2,
              }}
            >
              Shortlists
            </span>
            <span style={{ color: INK['12'], fontSize: 16, fontWeight: 300 }}>|</span>
            <span
              onClick={() => setActiveView('library')}
              className="cursor-pointer transition-all"
              style={{
                fontFamily: FONT.serif,
                fontStyle: 'italic',
                fontSize: activeView === 'library' ? 22 : 14,
                color: activeView === 'library' ? 'var(--t-ink)' : INK['70'],
                lineHeight: 1.2,
              }}
            >
              Library
            </span>
            <span style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['70'] }}>
              {activeView === 'library' ? filteredPlaces.length : shortlists.length}
            </span>
          </div>
        </div>

        {/* Shortlists */}
        {activeView === 'shortlists' && (
          <div>
            <div className="mb-3"><PlaceSearchBar /></div>
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setShowCreateShortlist(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full cursor-pointer transition-all hover:opacity-90"
                style={{
                  background: 'var(--t-ink)',
                  color: 'white',
                  border: 'none',
                  fontFamily: FONT.sans,
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontSize: 15, lineHeight: 1, fontWeight: 400 }}>+</span> New Shortlist
              </button>
              <FilterSortBar
                sortOptions={[
                  { value: 'recent', label: 'Recently created' },
                  { value: 'updated', label: 'Recently updated' },
                  { value: 'name', label: 'A–Z' },
                  { value: 'places', label: 'Most places' },
                ]}
                sortValue={shortlistSortBy}
                onSortChange={(v) => setShortlistSortBy(v as any)}
                compact
              />
            </div>
            {sortedShortlists.length > 0 ? (
              <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                {sortedShortlists.map(sl => (
                  <ShortlistCard key={sl.id} shortlist={sl} places={myPlaces} onClick={() => router.push(`/saved/shortlists/${sl.id}`)} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <PerriandIcon name="saved" size={36} color={INK['15']} />
                <p className="text-[13px] mt-3" style={{ color: INK['70'] }}>No shortlists yet</p>
                <p className="text-[11px] mt-1" style={{ color: INK['70'] }}>Create one to start curating your places</p>
              </div>
            )}
          </div>
        )}

        {/* Library */}
        {activeView === 'library' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <PlaceSearchBar />
              <button
                onClick={() => importPatch({ isOpen: true })}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '9px 12px', borderRadius: 10, background: 'rgba(232,115,58,0.08)', border: '1px solid rgba(232,115,58,0.15)', color: '#c45020', fontSize: 10, fontWeight: 600, fontFamily: FONT.mono, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 12L8 3L14 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M5 8.5H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                Import
              </button>
            </div>
            <div className="mb-4">
              <FilterSortBar
                filterGroups={[
                  {
                    key: 'type',
                    label: 'Type',
                    options: [
                      { value: 'all', label: 'All types' },
                      { value: 'restaurant', label: 'Restaurant' },
                      { value: 'bar', label: 'Bar' },
                      { value: 'cafe', label: 'Café' },
                      { value: 'hotel', label: 'Hotel' },
                      { value: 'museum', label: 'Museum' },
                      { value: 'activity', label: 'Activity' },
                    ],
                    value: typeFilter,
                    onChange: (v) => setTypeFilter(v as any),
                  },
                  ...(allCities.length > 1 ? [{
                    key: 'city',
                    label: 'City',
                    options: [
                      { value: 'all', label: 'All cities' },
                      ...allCities.map(c => ({ value: c, label: c })),
                    ],
                    value: cityFilter,
                    onChange: (v: string) => handleCityFilter(v),
                  }] : []),
                  ...(cityFilter !== 'all' && cityNeighborhoods[cityFilter] && cityNeighborhoods[cityFilter].length > 1 ? [{
                    key: 'neighborhood',
                    label: 'Neighborhood',
                    options: [
                      { value: 'all', label: 'All areas' },
                      ...cityNeighborhoods[cityFilter].map(nb => ({ value: nb, label: nb })),
                    ],
                    value: neighborhoodFilter,
                    onChange: (v: string) => setNeighborhoodFilter(v),
                  }] : []),
                  {
                    key: 'source',
                    label: 'Source',
                    options: [
                      { value: 'all', label: 'All sources' },
                      { value: 'friend', label: 'Friends' },
                      { value: 'article', label: 'Articles' },
                      { value: 'maps', label: 'Maps' },
                      { value: 'email', label: 'Email' },
                    ],
                    value: sourceFilter,
                    onChange: (v) => setSourceFilter(v),
                  },
                ]}
                sortOptions={[
                  { value: 'match', label: 'Match %' },
                  { value: 'name', label: 'A–Z' },
                  { value: 'type', label: 'Type' },
                  { value: 'source', label: 'Source' },
                ]}
                sortValue={sortBy}
                onSortChange={(v) => setSortBy(v as any)}
                onResetAll={() => { setTypeFilter('all'); handleCityFilter('all'); setSourceFilter('all'); setSortBy('match'); }}
              />
            </div>
            {filteredPlaces.length > 0 ? (
              <div className="flex flex-col gap-2">
                {filteredPlaces.map(place => (
                  <PlaceCard key={place.id} place={place} onTap={() => openDetail(place)} onToggleStar={() => openShortlistPicker(place)} onLongPress={() => setAddToTripItem(place)} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <PerriandIcon name="discover" size={36} color={INK['15']} />
                <p className="text-[13px] mt-3" style={{ color: INK['70'] }}>{searchQuery || typeFilter !== 'all' || cityFilter !== 'all' || sourceFilter !== 'all' ? 'No places match your filters' : 'No saved places yet'}</p>
                <p className="text-[11px] mt-1" style={{ color: INK['70'] }}>{searchQuery || typeFilter !== 'all' || cityFilter !== 'all' || sourceFilter !== 'all' ? 'Try adjusting your search or filters' : 'Import places to get started'}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showCreateShortlist && (
        <CreateShortlistModal
          onClose={() => setShowCreateShortlist(false)}
          onCreate={async (name, emoji) => { setShowCreateShortlist(false); const realId = await createShortlistAsync(name, emoji); router.push(`/saved/shortlists/${realId}`); }}
          onCreateSmart={(name, emoji, query, filterTags, placeIds) => { createSmartShortlist(name, emoji, query, filterTags, placeIds); setShowCreateShortlist(false); }}
        />
      )}
      {addToTripItem && trips.length > 0 && (
        <AddToTripSheet place={addToTripItem} trips={trips} onClose={() => setAddToTripItem(null)} onAdd={(tripId) => { if (!addToTripItem.isShortlisted) { toggleStar(addToTripItem.id); } setAddToTripItem(null); }} />
      )}
      {importOpen && (
        <ImportDrawer onClose={() => { resetImport(); importPatch({ isOpen: false }); }} />
      )}
      <TabBar />
    </div>
  );
}


// ═══════════════════════════════════════════
// Place Card — Library view card
// ═══════════════════════════════════════════

function PlaceCard({ place, onTap, onToggleStar, onLongPress }: {
  place: ImportedPlace;
  onTap: () => void;
  onToggleStar: () => void;
  onLongPress: () => void;
}) {
  const isStarred = !!place.isShortlisted;
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
        background: isStarred ? 'rgba(42,122,86,0.03)' : 'white',
        border: isStarred ? '1.5px solid var(--t-verde)' : '1px solid var(--t-linen)',
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

            {/* Star toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all flex-shrink-0"
              style={{
                background: isStarred ? 'var(--t-verde)' : INK['06'],
                color: isStarred ? 'white' : INK['50'],
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <PerriandIcon name="star" size={12} color={isStarred ? 'white' : INK['50']} />
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
// Create Shortlist Modal
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

function CreateShortlistModal({ onClose, onCreate, onCreateSmart }: {
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
            New Shortlist
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
              placeholder="Shortlist name..."
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
              Create Shortlist
            </button>
          </>
        )}

        {/* ═══ Smart / AI Mode ═══ */}
        {isSmartMode && smartStep === 'input' && (
          <div>
            {/* Description input — 16px font prevents iOS zoom */}
            <input
              type="text"
              placeholder="Describe your shortlist..."
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

'use client';

import { useMemo, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import TabBar from '@/components/TabBar';
import { useSavedStore } from '@/stores/savedStore';
import { REACTIONS, ImportedPlace, SOURCE_STYLES, PlaceType, GhostSourceType } from '@/types';
import { PlaceDetailProvider, usePlaceDetail } from '@/context/PlaceDetailContext';
import { PerriandIcon, isPerriandIconName } from '@/components/icons/PerriandIcons';
import GoogleMapView from '@/components/GoogleMapView';
import ShareSheet from '@/components/ShareSheet';
import DesktopNav from '@/components/DesktopNav';
import PlaceSearchBar from '@/components/PlaceSearchBar';
import FilterSortBar from '@/components/ui/FilterSortBar';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import { FONT, INK } from '@/constants/theme';
import { TYPE_COLORS_VIBRANT, THUMB_GRADIENTS, TYPE_CHIPS_WITH_ALL } from '@/constants/placeTypes';

export default function CollectionDetailPage() {
  const ratePlace = useSavedStore(s => s.ratePlace);

  return (
    <PlaceDetailProvider config={{
      onRate: (place, rating) => ratePlace(place.id, rating),
    }}>
      <CollectionDetailContent />
    </PlaceDetailProvider>
  );
}

function CollectionDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { openDetail } = usePlaceDetail();
  const collectionId = params.id as string;
  const isDesktop = useIsDesktop();

  const myPlaces = useSavedStore(s => s.myPlaces);
  const collections = useSavedStore(s => s.collections);
  const removePlaceFromCollection = useSavedStore(s => s.removePlaceFromCollection);
  const addPlaceToCollection = useSavedStore(s => s.addPlaceToCollection);
  const deleteCollection = useSavedStore(s => s.deleteCollection);
  const updateCollection = useSavedStore(s => s.updateCollection);

  // Auto-add newly searched places to this collection
  const handlePlaceAdded = useCallback((place: ImportedPlace) => {
    addPlaceToCollection(collectionId, place.id);
  }, [addPlaceToCollection, collectionId]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [mapOpen, setMapOpen] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);

  // Filter & sort
  const [typeFilter, setTypeFilter] = useState<PlaceType | 'all'>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [collectionSearch, setCollectionSearch] = useState('');
  const [detailSortBy, setDetailSortBy] = useState<'added' | 'name' | 'type' | 'rating'>('added');

  const collection = collections.find(s => s.id === collectionId);

  const allPlacesInCollection = useMemo(() => {
    if (!collection) return [];
    return collection.placeIds
      .map(id => myPlaces.find(p => p.id === id))
      .filter(Boolean) as ImportedPlace[];
  }, [collection, myPlaces]);

  // Unique types present in this collection (for filter options)
  const typeOptions = useMemo(() => {
    const types = new Set(allPlacesInCollection.map(p => p.type));
    return Array.from(types).sort();
  }, [allPlacesInCollection]);

  // Unique cities in this collection (for destination filter chips)
  const cityOptions = useMemo(() => {
    const cityCount: Record<string, number> = {};
    allPlacesInCollection.forEach(p => {
      const parts = p.location.split(',').map(s => s.trim());
      const city = parts.length >= 2 ? parts[1] : parts[0];
      if (city) cityCount[city] = (cityCount[city] || 0) + 1;
    });
    return Object.entries(cityCount)
      .sort((a, b) => b[1] - a[1])
      .map(([city, count]) => ({ city, count }));
  }, [allPlacesInCollection]);

  // Filtered + sorted
  const placesInCollection = useMemo(() => {
    let items = [...allPlacesInCollection];
    if (typeFilter !== 'all') {
      items = items.filter(p => p.type === typeFilter);
    }
    if (cityFilter !== 'all') {
      items = items.filter(p => {
        const parts = p.location.split(',').map(s => s.trim());
        const city = parts.length >= 2 ? parts[1] : parts[0];
        return city.toLowerCase() === cityFilter.toLowerCase();
      });
    }
    if (collectionSearch.trim()) {
      const q = collectionSearch.toLowerCase();
      items = items.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.tasteNote?.toLowerCase().includes(q) ||
        p.type.includes(q)
      );
    }
    switch (detailSortBy) {
      case 'name': items.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'type': items.sort((a, b) => a.type.localeCompare(b.type)); break;
      case 'rating': items.sort((a, b) => (b.google?.rating ?? 0) - (a.google?.rating ?? 0)); break;
      // 'added' keeps original order (insertion order from placeIds)
    }
    return items;
  }, [allPlacesInCollection, typeFilter, cityFilter, collectionSearch, detailSortBy]);

  if (!collection) {
    return (
      <div className="min-h-screen pb-16" style={{ background: 'var(--t-cream)', maxWidth: isDesktop ? undefined : 480, margin: '0 auto', overflowX: 'hidden' }}>
        {isDesktop && <DesktopNav />}
        <div className="px-4 pt-5 text-center">
          <p style={{ color: INK['70'] }}>Collection not found</p>
          <button
            onClick={() => router.back()}
            className="mt-4 text-[12px] cursor-pointer"
            style={{ color: 'var(--t-verde)', background: 'none', border: 'none' }}
          >
            ← Back
          </button>
        </div>
        {!isDesktop && <TabBar />}
      </div>
    );
  }

  const isPerriandIcon = collection.emoji ? isPerriandIconName(collection.emoji) : false;


  const startEditing = () => {
    setEditName(collection.name);
    setEditDescription(collection.description || '');
    setIsEditing(true);
  };

  const saveEditing = () => {
    updateCollection(collection.id, {
      name: editName.trim() || collection.name,
      description: editDescription.trim() || undefined,
    });
    setIsEditing(false);
  };

  /* ── Action buttons shared between layouts ── */
  const actionButtons = (
    <div className="flex items-center gap-2">
      {placesInCollection.length > 0 && (
        <>
          <button
            onClick={() => setShowShareSheet(true)}
            className="text-[10px] px-2.5 py-1.5 rounded-full cursor-pointer flex items-center gap-1"
            style={{
              background: 'rgba(42,122,86,0.08)',
              color: 'var(--t-verde)',
              border: 'none',
              fontFamily: FONT.mono,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Share
          </button>
          {!isDesktop && (
            <button
              onClick={() => setMapOpen(true)}
              className="text-[10px] px-2.5 py-1.5 rounded-full cursor-pointer flex items-center gap-1"
              style={{
                background: 'rgba(200,146,58,0.08)',
                color: '#8a6a2a',
                border: 'none',
                fontFamily: FONT.mono,
              }}
            >
              <PerriandIcon name="pin" size={10} color="var(--t-honey)" />
              Map
            </button>
          )}
        </>
      )}
      {!collection.isDefault && (
        <>
          <button
            onClick={startEditing}
            className="text-[10px] px-2.5 py-1.5 rounded-full cursor-pointer"
            style={{
              background: INK['04'],
              color: INK['70'],
              border: 'none',
              fontFamily: FONT.mono,
            }}
          >
            Edit
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-[10px] px-2.5 py-1.5 rounded-full cursor-pointer"
            style={{
              background: 'rgba(214,48,32,0.06)',
              color: 'var(--t-signal-red)',
              border: 'none',
              fontFamily: FONT.mono,
            }}
          >
            Delete
          </button>
        </>
      )}
    </div>
  );

  /* ── Collection info block shared between layouts ── */
  const collectionInfo = (
    <div className="mb-6 pb-4 border-b" style={{ borderColor: 'var(--t-linen)' }}>
      <div className="flex items-start gap-3">
        <span style={{ fontSize: isPerriandIcon ? 28 : 36 }}>
          {isPerriandIcon ? (
            <PerriandIcon name={collection.emoji as any} size={28} color="var(--t-ink)" />
          ) : (
            collection.emoji
          )}
        </span>
        <div className="flex-1">
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                className="w-full text-[16px] rounded-lg px-2 py-1"
                style={{
                  fontFamily: FONT.serif,
                  fontStyle: 'italic',
                  color: 'var(--t-ink)',
                  background: 'white',
                  border: '1px solid var(--t-linen)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Add a description..."
                className="w-full text-[11px] rounded-lg px-2 py-1"
                style={{
                  fontFamily: FONT.sans,
                  color: INK['70'],
                  background: 'white',
                  border: '1px solid var(--t-linen)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={saveEditing}
                  className="text-[10px] px-3 py-1.5 rounded-full cursor-pointer"
                  style={{ background: 'var(--t-ink)', color: 'white', border: 'none', fontFamily: FONT.mono }}
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-[10px] px-3 py-1.5 rounded-full cursor-pointer"
                  style={{ background: INK['06'], color: INK['70'], border: 'none', fontFamily: FONT.mono }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1
                className="text-[22px] mb-1"
                style={{ fontFamily: FONT.serif, fontStyle: 'italic', color: 'var(--t-ink)' }}
              >
                {collection.name}
              </h1>
              {collection.description && (
                <p className="text-[11px] mb-2" style={{ color: INK['70'], fontFamily: FONT.sans }}>
                  {collection.description}
                </p>
              )}
            </>
          )}

          <div className="flex items-center gap-2 mt-1">
            <span style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['70'] }}>
              {placesInCollection.length} {placesInCollection.length === 1 ? 'place' : 'places'}
            </span>
            {collection.cities.length > 0 && (
              <>
                <span style={{ color: INK['15'], fontSize: 10 }}>·</span>
                <span style={{ fontFamily: FONT.sans, fontSize: 10, color: INK['70'] }}>
                  {collection.cities.slice(0, 3).join(', ')}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Smart collection badge */}
      {collection.isSmartCollection && (
        <div className="mt-3">
          <span
            className="text-[9px] px-2 py-1 rounded-full"
            style={{
              fontFamily: FONT.mono,
              background: 'rgba(42,122,86,0.08)',
              color: 'var(--t-verde)',
            }}
          >
            Auto-updating · Curated Collection
          </span>
          {collection.query && (
            <p className="text-[10px] mt-2" style={{ color: INK['70'], fontFamily: FONT.mono }}>
              Query: &ldquo;{collection.query}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* Filter tags */}
      {collection.filterTags && collection.filterTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {collection.filterTags.map(tag => (
            <span
              key={tag}
              className="px-2 py-1 rounded-full text-[9px]"
              style={{
                background: 'var(--t-verde)',
                color: 'white',
                fontFamily: FONT.mono,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  /* ── Search bar for adding places directly ── */
  const searchBar = !collection.isSmartCollection && (
    <div className="mb-3">
      <PlaceSearchBar
        placeholder={`Filter places in ${collection.name}...`}
      />
    </div>
  );

  /* ── Destination filter chips ── */
  const destinationChips = cityOptions.length > 1 && (
    <div
      className="flex gap-1.5 mb-3"
      style={{ overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
    >
      <button
        onClick={() => setCityFilter('all')}
        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium cursor-pointer flex-shrink-0"
        style={{
          background: cityFilter === 'all' ? 'var(--t-ink)' : 'white',
          color: cityFilter === 'all' ? 'white' : INK['60'],
          border: cityFilter === 'all' ? '1px solid var(--t-ink)' : '1px solid var(--t-linen)',
          fontFamily: FONT.sans,
          transition: 'all 150ms ease',
        }}
      >
        <PerriandIcon name="discover" size={11} color={cityFilter === 'all' ? 'white' : INK['50']} />
        All cities
      </button>
      {cityOptions.map(({ city, count }) => (
        <button
          key={city}
          onClick={() => setCityFilter(city)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium cursor-pointer flex-shrink-0"
          style={{
            background: cityFilter === city ? 'var(--t-ink)' : 'white',
            color: cityFilter === city ? 'white' : INK['60'],
            border: cityFilter === city ? '1px solid var(--t-ink)' : '1px solid var(--t-linen)',
            fontFamily: FONT.sans,
            transition: 'all 150ms ease',
          }}
        >
          <PerriandIcon name="pin" size={11} color={cityFilter === city ? 'white' : INK['50']} />
          {city}
          <span style={{ fontFamily: FONT.mono, fontSize: 9, opacity: 0.7 }}>{count}</span>
        </button>
      ))}
    </div>
  );

  /* ── Type filter chips ── */
  const typeChips = typeOptions.length > 1 && (
    <div
      className="flex gap-1.5 mb-3"
      style={{ overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
    >
      {TYPE_CHIPS_WITH_ALL.filter(c => c.value === 'all' || (typeOptions as string[]).includes(c.value)).map(chip => (
        <button
          key={chip.value}
          onClick={() => setTypeFilter(chip.value as PlaceType | 'all')}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium cursor-pointer flex-shrink-0"
          style={{
            background: typeFilter === chip.value ? 'var(--t-ink)' : 'white',
            color: typeFilter === chip.value ? 'white' : INK['60'],
            border: typeFilter === chip.value ? '1px solid var(--t-ink)' : '1px solid var(--t-linen)',
            fontFamily: FONT.sans,
            transition: 'all 150ms ease',
          }}
        >
          <PerriandIcon name={chip.icon} size={11} color={typeFilter === chip.value ? 'white' : INK['50']} />
          {chip.label}
        </button>
      ))}
    </div>
  );

  /* ── Inline search within collection ── */
  const inlineSearch = allPlacesInCollection.length > 3 && (
    <div className="mb-3">
      <div className="relative">
        <PerriandIcon
          name="discover"
          size={13}
          color={INK['40']}
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
        />
        <input
          type="text"
          placeholder={`Search ${allPlacesInCollection.length} places...`}
          value={collectionSearch}
          onChange={(e) => setCollectionSearch(e.target.value)}
          className="w-full rounded-lg py-2 pr-3 text-[13px]"
          style={{
            paddingLeft: 30,
            background: 'white',
            border: '1px solid var(--t-linen)',
            color: 'var(--t-ink)',
            fontFamily: FONT.sans,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {collectionSearch && (
          <button
            onClick={() => setCollectionSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: INK['06'], border: 'none', cursor: 'pointer' }}
          >
            <PerriandIcon name="close" size={8} color={INK['40']} />
          </button>
        )}
      </div>
    </div>
  );

  /* ── Sort bar ── */
  const sortBar = allPlacesInCollection.length > 1 && (
    <div className="flex items-center justify-between mb-3">
      <span style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['50'] }}>
        {placesInCollection.length} {placesInCollection.length === 1 ? 'place' : 'places'}
        {(typeFilter !== 'all' || cityFilter !== 'all' || collectionSearch) && ' (filtered)'}
      </span>
      <FilterSortBar
        sortOptions={[
          { value: 'added', label: 'Order added' },
          { value: 'name', label: 'A–Z' },
          { value: 'type', label: 'Type' },
          { value: 'rating', label: 'Rating' },
        ]}
        sortValue={detailSortBy}
        onSortChange={(v) => setDetailSortBy(v as any)}
        compact
      />
    </div>
  );

  /* ── "Plan a trip" CTA ── */
  const planTripCta = allPlacesInCollection.length >= 2 && (
    <div
      className="mt-6 p-4 rounded-xl flex items-center justify-between"
      style={{
        background: 'rgba(200,146,58,0.06)',
        border: '1px solid rgba(200,146,58,0.12)',
      }}
    >
      <div>
        <div className="text-[13px] font-semibold" style={{ fontFamily: FONT.sans, color: 'var(--t-ink)' }}>
          Plan a trip with these places
        </div>
        <div className="text-[11px] mt-0.5" style={{ fontFamily: FONT.sans, color: INK['60'] }}>
          {cityOptions.length === 1
            ? `${allPlacesInCollection.length} places in ${cityOptions[0].city}`
            : `${allPlacesInCollection.length} places across ${cityOptions.length} cities`}
        </div>
      </div>
      <button
        onClick={() => {
          // Navigate to trips — in the future this would pre-populate a new trip
          router.push('/trips');
        }}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full cursor-pointer btn-hover"
        style={{
          background: 'var(--t-ink)',
          color: 'white',
          border: 'none',
          fontSize: 12,
          fontWeight: 600,
          fontFamily: FONT.sans,
          whiteSpace: 'nowrap',
        }}
      >
        <PerriandIcon name="trips" size={13} color="white" />
        Plan trip
      </button>
    </div>
  );

  /* ── Places list shared ── */
  const placesList = (
    <>
      {searchBar}
      {destinationChips}
      {typeChips}
      {inlineSearch}
      {sortBar}
      {placesInCollection.length > 0 ? (
        <div className={isDesktop ? 'grid gap-3' : 'flex flex-col gap-2'} style={isDesktop ? { gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' } : undefined}>
          {placesInCollection.map(place => (
            <CollectionPlaceCard
              key={place.id}
              place={place}
              onTap={() => openDetail(place)}
              onRemove={!collection.isSmartCollection ? () => removePlaceFromCollection(collection.id, place.id) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <PerriandIcon name="discover" size={32} color={INK['15']} />
          <p className="text-[12px] mt-3" style={{ color: INK['70'] }}>
            {collectionSearch || typeFilter !== 'all' || cityFilter !== 'all'
              ? 'No places match your filters'
              : 'No places in this collection yet'}
          </p>
          <p className="text-[11px] mt-1" style={{ color: INK['70'] }}>
            {collectionSearch || typeFilter !== 'all' || cityFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Use the search bar above to find and add places'}
          </p>
        </div>
      )}
      {planTripCta}
    </>
  );

  /* ═══════════════════════════════════════════
     Desktop Layout
     ═══════════════════════════════════════════ */
  if (isDesktop) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--t-cream)' }}>
        <DesktopNav />
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 48px 48px' }}>
          {/* Header row */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.back()}
              className="cursor-pointer flex items-center gap-1.5 link-hover"
              style={{ color: 'var(--t-verde)', background: 'none', border: 'none', fontSize: 13, fontFamily: FONT.sans }}
            >
              ← Back to Library
            </button>
            <div className="flex-1" />
            {actionButtons}
          </div>

          {/* Two-column: info+places on left, map on right */}
          <div className="flex gap-8" style={{ alignItems: 'flex-start' }}>
            {/* Left column — info + places */}
            <div className="flex-1 min-w-0">
              {collectionInfo}
              {placesList}
            </div>

            {/* Right column — persistent full-height map */}
            {placesInCollection.length > 0 && (
              <div
                className="flex-shrink-0 rounded-2xl overflow-hidden"
                style={{
                  width: 420,
                  height: 'calc(100vh - 160px)',
                  position: 'sticky',
                  top: 88,
                  border: '1px solid var(--t-linen)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
                <GoogleMapView
                  markers={placesInCollection.map(p => ({
                    id: p.id,
                    name: p.name,
                    location: p.location,
                    type: p.type,
                    matchScore: p.matchScore,
                    tasteNote: p.tasteNote,
                    lat: p.google?.lat,
                    lng: p.google?.lng,
                  }))}
                  height={800}
                  fallbackDestination={collection.cities[0]}
                />
              </div>
            )}
          </div>
        </div>

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.3)' }} />
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative rounded-2xl px-6 py-5 mx-5"
              style={{ maxWidth: 320, background: 'var(--t-cream)' }}
            >
              <p className="text-[14px] font-semibold mb-2" style={{ color: 'var(--t-ink)', fontFamily: FONT.serif }}>
                Delete &ldquo;{collection.name}&rdquo;?
              </p>
              <p className="text-[11px] mb-5" style={{ color: INK['70'] }}>
                This won&apos;t remove the places from your library.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    deleteCollection(collection.id);
                    router.back();
                  }}
                  className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold cursor-pointer"
                  style={{ background: 'var(--t-signal-red)', color: 'white', border: 'none' }}
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl text-[12px] cursor-pointer"
                  style={{ background: INK['06'], color: INK['70'], border: 'none' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showShareSheet && collection && (
          <ShareSheet
            resourceType="collection"
            resourceId={collection.id}
            resourceName={collection.name}
            onClose={() => setShowShareSheet(false)}
          />
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     Mobile Layout
     ═══════════════════════════════════════════ */
  return (
    <div className="min-h-screen pb-16" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <div className="px-4 pt-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => router.back()}
            className="cursor-pointer"
            style={{ color: 'var(--t-verde)', background: 'none', border: 'none', fontSize: 16 }}
          >
            ←
          </button>
          <div className="flex-1" />
          {actionButtons}
        </div>

        {collectionInfo}
        {placesList}
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.3)' }} />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative rounded-2xl px-6 py-5 mx-5"
            style={{ maxWidth: 320, background: 'var(--t-cream)' }}
          >
            <p className="text-[14px] font-semibold mb-2" style={{ color: 'var(--t-ink)', fontFamily: FONT.serif }}>
              Delete "{collection.name}"?
            </p>
            <p className="text-[11px] mb-5" style={{ color: INK['70'] }}>
              This won't remove the places from your library.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  deleteCollection(collection.id);
                  router.back();
                }}
                className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold cursor-pointer"
                style={{ background: 'var(--t-signal-red)', color: 'white', border: 'none' }}
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-[12px] cursor-pointer"
                style={{ background: INK['06'], color: INK['70'], border: 'none' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen Map Overlay */}
      {mapOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ height: '100dvh', background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}
        >
          {/* Map header bar */}
          <div
            className="flex items-center gap-3 px-4 flex-shrink-0"
            style={{
              height: 56,
              background: 'rgba(245,240,230,0.92)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderBottom: '1px solid var(--t-linen)',
            }}
          >
            <button
              onClick={() => setMapOpen(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer flex-shrink-0"
              style={{
                background: 'rgba(255,255,255,0.7)',
                border: '1px solid var(--t-linen)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8L10 13" stroke="var(--t-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold truncate" style={{ fontFamily: FONT.serif, fontStyle: 'italic', color: 'var(--t-ink)' }}>
                {collection.name}
              </div>
              <div className="text-[10px]" style={{ fontFamily: FONT.mono, color: INK['70'] }}>
                {placesInCollection.length} {placesInCollection.length === 1 ? 'place' : 'places'}
                {collection.cities.length > 0 && ` · ${collection.cities.slice(0, 3).join(', ')}`}
              </div>
            </div>
          </div>

          {/* Map fills remaining space */}
          <div className="relative" style={{ height: 'calc(100dvh - 56px)', overflow: 'hidden' }}>
            <GoogleMapView
              markers={placesInCollection.map(p => ({
                id: p.id,
                name: p.name,
                location: p.location,
                type: p.type,
                matchScore: p.matchScore,
                tasteNote: p.tasteNote,
                lat: p.google?.lat,
                lng: p.google?.lng,
              }))}
              height={typeof window !== 'undefined' ? window.innerHeight - 56 : 600}
              fallbackDestination={collection.cities[0]}
            />

            {/* Floating legend */}
            <div
              className="absolute bottom-5 left-4 right-4 flex items-center justify-between px-3.5 py-2.5 rounded-xl"
              style={{
                background: 'rgba(245,240,230,0.92)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid var(--t-linen)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              }}
            >
              <div className="flex items-center gap-2">
                {(() => {
                  const types = new Set(placesInCollection.map(p => p.type));
                  return Array.from(types).slice(0, 4).map(type => (
                    <div key={type} className="flex items-center gap-1">
                      <PerriandIcon name={type as any} size={11} color={TYPE_COLORS_VIBRANT[type as PlaceType] || INK['60']} />
                      <span style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['70'] }}>
                        {placesInCollection.filter(p => p.type === type).length}
                      </span>
                    </div>
                  ));
                })()}
              </div>
              <span style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['50'] }}>
                Tap pins for details
              </span>
            </div>
          </div>
        </div>
      )}

      {/* PlaceDetailSheet, RatingSheet, BriefingView, AddToCollectionSheet
           are all rendered by PlaceDetailProvider — no duplication needed */}

      {/* Share Sheet */}
      {showShareSheet && collection && (
        <ShareSheet
          resourceType="collection"
          resourceId={collection.id}
          resourceName={collection.name}
          onClose={() => setShowShareSheet(false)}
        />
      )}

      <TabBar />
    </div>
  );
}


// ═══════════════════════════════════════════
// Collection Place Card
// ═══════════════════════════════════════════

function CollectionPlaceCard({ place, onTap, onRemove }: {
  place: ImportedPlace;
  onTap: () => void;
  onRemove?: () => void;
}) {
  const rating = place.rating;
  const reaction = rating ? REACTIONS.find(r => r.id === rating.reaction) : null;
  const typeIcon = place.type;

  return (
    <div
      onClick={onTap}
      className="p-3 rounded-xl cursor-pointer transition-all"
      style={{ background: 'white', border: '1px solid var(--t-linen)' }}
    >
      <div className="flex gap-3">
        {/* Thumbnail */}
        <div
          className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center"
          style={{ background: THUMB_GRADIENTS[place.type] || THUMB_GRADIENTS.restaurant }}
        >
          <PerriandIcon name={typeIcon as any} size={18} color={INK['60']} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <h3 className="text-[13px] font-semibold truncate" style={{ color: 'var(--t-ink)', fontFamily: FONT.sans }}>
              {place.name}
            </h3>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {reaction && (
                <PerriandIcon name={reaction.icon as any} size={14} color={reaction.color} />
              )}
              {onRemove && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(); }}
                  className="w-5 h-5 rounded-full flex items-center justify-center cursor-pointer"
                  style={{ background: INK['04'], border: 'none' }}
                >
                  <PerriandIcon name="close" size={8} color={INK['30']} />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span style={{ fontFamily: FONT.sans, fontSize: 10, color: INK['70'] }}>
              {place.type.charAt(0).toUpperCase() + place.type.slice(1)}
            </span>
            <span style={{ fontSize: 10, color: INK['70'] }}>· {place.location.split(',')[0]}</span>
            {place.google?.rating && (
              <span style={{ fontFamily: FONT.mono, fontSize: 9, color: INK['70'] }}>
                ★ {place.google.rating}
              </span>
            )}
          </div>
          {place.tasteNote && (
            <p className="text-[10px] mt-1" style={{ color: INK['70'], fontStyle: 'italic', lineHeight: 1.3 }}>
              {place.tasteNote.length > 80 ? place.tasteNote.slice(0, 77) + '…' : place.tasteNote}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

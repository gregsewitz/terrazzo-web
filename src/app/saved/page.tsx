'use client';

import { useMemo, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TabBar from '@/components/TabBar';
import PlaceDetailSheet from '@/components/PlaceDetailSheet';
import RatingSheet from '@/components/RatingSheet';
import ShortlistCard from '@/components/ShortlistCard';
import AddToShortlistSheet from '@/components/AddToShortlistSheet';
import { useSavedStore } from '@/stores/savedStore';
import { useTripStore } from '@/stores/tripStore';
import { REACTIONS, PlaceType, ImportedPlace, PlaceRating, SOURCE_STYLES } from '@/types';
import BriefingView from '@/components/BriefingView';
import ImportDrawer from '@/components/ImportDrawer';
import { useImportStore } from '@/stores/importStore';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';

const TYPE_ICONS: Record<string, string> = {
  restaurant: 'restaurant',
  hotel: 'hotel',
  bar: 'bar',
  cafe: 'cafe',
  museum: 'museum',
  activity: 'activity',
  neighborhood: 'location',
  shop: 'shop',
};

const THUMB_GRADIENTS: Record<string, string> = {
  restaurant: 'linear-gradient(135deg, #d8c8ae, #c0ab8e)',
  hotel: 'linear-gradient(135deg, #d0c8d8, #b8b0c0)',
  bar: 'linear-gradient(135deg, #c0d0c8, #a8c0b0)',
  cafe: 'linear-gradient(135deg, #d8d0c0, #c8c0b0)',
  museum: 'linear-gradient(135deg, #c0c8d0, #a8b0b8)',
  activity: 'linear-gradient(135deg, #c0d0c8, #a8b8a8)',
  neighborhood: 'linear-gradient(135deg, #d0d8c8, #b8c0a8)',
  shop: 'linear-gradient(135deg, #d8c8b8, #c0b0a0)',
};

export default function SavedPage() {
  const router = useRouter();
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
  const ratePlace = useSavedStore(s => s.ratePlace);
  const toggleStar = useSavedStore(s => s.toggleStar);
  const createShortlist = useSavedStore(s => s.createShortlist);
  const injectGhostCandidates = useTripStore(s => s.injectGhostCandidates);
  const trips = useTripStore(s => s.trips);
  const { isOpen: importOpen, setOpen: setImportOpen, reset: resetImport } = useImportStore();

  const [detailItem, setDetailItem] = useState<ImportedPlace | null>(null);
  const [ratingItem, setRatingItem] = useState<ImportedPlace | null>(null);
  const [briefingPlace, setBriefingPlace] = useState<{ id: string; name: string; matchScore?: number } | null>(null);
  const [addToTripItem, setAddToTripItem] = useState<ImportedPlace | null>(null);
  const [showCreateShortlist, setShowCreateShortlist] = useState(false);
  const [shortlistPickerItem, setShortlistPickerItem] = useState<ImportedPlace | null>(null);

  // ─── Library filtering ───
  const allCities = useMemo(() => {
    const cities = new Set<string>();
    myPlaces.forEach(p => {
      const city = p.location.split(',')[0].trim();
      if (city) cities.add(city);
    });
    return Array.from(cities).sort();
  }, [myPlaces]);

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
      places = places.filter(p => p.location.toLowerCase().includes(cityFilter.toLowerCase()));
    }
    return places;
  }, [myPlaces, searchQuery, typeFilter, cityFilter]);

  const handleRate = (rating: PlaceRating) => {
    if (ratingItem) {
      ratePlace(ratingItem.id, rating);
      setDetailItem(prev => prev?.id === ratingItem.id ? { ...prev, rating } : prev);
      if (rating.reaction === 'myPlace' || rating.reaction === 'enjoyed') {
        injectGhostCandidates([{ ...ratingItem, rating }]);
      }
      setRatingItem(null);
    }
  };

  return (
    <div className="min-h-screen pb-16" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}>
      <div className="px-5 pt-6">
        {/* ═══ Header ═══ */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span
              onClick={() => setActiveView('shortlists')}
              className="cursor-pointer transition-all"
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontStyle: 'italic',
                fontSize: activeView === 'shortlists' ? 22 : 14,
                color: activeView === 'shortlists' ? 'var(--t-ink)' : 'rgba(28,26,23,0.5)',
                lineHeight: 1.2,
              }}
            >
              Shortlists
            </span>
            <span style={{ color: 'rgba(28,26,23,0.12)', fontSize: 16, fontWeight: 300 }}>|</span>
            <span
              onClick={() => setActiveView('library')}
              className="cursor-pointer transition-all"
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontStyle: 'italic',
                fontSize: activeView === 'library' ? 22 : 14,
                color: activeView === 'library' ? 'var(--t-ink)' : 'rgba(28,26,23,0.5)',
                lineHeight: 1.2,
              }}
            >
              Library
            </span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: 'rgba(28,26,23,0.4)' }}>
              {activeView === 'library' ? filteredPlaces.length : shortlists.length}
            </span>
          </div>
          <button
            onClick={() => setImportOpen(true)}
            className="text-[10px] font-semibold px-2.5 py-1.5 rounded-full cursor-pointer transition-colors hover:opacity-80"
            style={{
              background: 'rgba(232,115,58,0.08)',
              color: 'var(--t-panton-orange)',
              border: 'none',
              fontFamily: "'Space Mono', monospace",
            }}
          >
            + Import
          </button>
        </div>

        {/* ═══════════════════════════════════ */}
        {/* SHORTLISTS VIEW                     */}
        {/* ═══════════════════════════════════ */}
        {activeView === 'shortlists' && (
          <div>
            {/* Create shortlist button */}
            <button
              onClick={() => setShowCreateShortlist(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl mb-4 cursor-pointer transition-all hover:opacity-80"
              style={{
                background: 'none',
                border: '1.5px dashed rgba(28,26,23,0.15)',
                color: 'rgba(28,26,23,0.5)',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
              }}
            >
              <span style={{ fontSize: 14 }}>+</span>
              Create Shortlist
            </button>

            {/* Shortlist cards */}
            <div className="flex flex-col gap-3">
              {shortlists.map(sl => (
                <ShortlistCard
                  key={sl.id}
                  shortlist={sl}
                  places={myPlaces}
                  onClick={() => router.push(`/saved/shortlists/${sl.id}`)}
                />
              ))}
            </div>

            {shortlists.length === 0 && (
              <div className="text-center py-12">
                <PerriandIcon name="saved" size={36} color="rgba(28,26,23,0.15)" />
                <p className="text-[13px] mt-3" style={{ color: 'rgba(28,26,23,0.5)' }}>
                  No shortlists yet
                </p>
                <p className="text-[11px] mt-1" style={{ color: 'rgba(28,26,23,0.35)' }}>
                  Create one to start curating your places
                </p>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════ */}
        {/* LIBRARY VIEW                        */}
        {/* ═══════════════════════════════════ */}
        {activeView === 'library' && (
          <div>
            {/* Search bar */}
            <div className="relative mb-3">
              <PerriandIcon
                name="discover"
                size={14}
                color="rgba(28,26,23,0.35)"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Search places..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg py-2.5 pl-9 pr-3 text-[12px]"
                style={{
                  background: 'white',
                  border: '1px solid var(--t-linen)',
                  color: 'var(--t-ink)',
                  fontFamily: "'DM Sans', sans-serif",
                  outline: 'none',
                }}
              />
            </div>

            {/* Filter chips */}
            <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {/* Type filter */}
              {(['all', 'restaurant', 'bar', 'cafe', 'hotel', 'museum', 'activity'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className="px-2.5 py-1.5 rounded-full whitespace-nowrap text-[10px] transition-all cursor-pointer"
                  style={{
                    background: typeFilter === type ? 'var(--t-ink)' : 'white',
                    color: typeFilter === type ? 'white' : 'rgba(28,26,23,0.6)',
                    border: typeFilter === type ? 'none' : '1px solid var(--t-linen)',
                    fontFamily: "'Space Mono', monospace",
                  }}
                >
                  {type === 'all' ? 'All types' : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            {/* City filter row */}
            {allCities.length > 1 && (
              <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                <button
                  onClick={() => setCityFilter('all')}
                  className="px-2.5 py-1.5 rounded-full whitespace-nowrap text-[10px] transition-all cursor-pointer"
                  style={{
                    background: cityFilter === 'all' ? 'var(--t-verde)' : 'white',
                    color: cityFilter === 'all' ? 'white' : 'rgba(28,26,23,0.6)',
                    border: cityFilter === 'all' ? 'none' : '1px solid var(--t-linen)',
                    fontFamily: "'Space Mono', monospace",
                  }}
                >
                  All cities
                </button>
                {allCities.map(city => (
                  <button
                    key={city}
                    onClick={() => setCityFilter(city)}
                    className="px-2.5 py-1.5 rounded-full whitespace-nowrap text-[10px] transition-all cursor-pointer"
                    style={{
                      background: cityFilter === city ? 'var(--t-verde)' : 'white',
                      color: cityFilter === city ? 'white' : 'rgba(28,26,23,0.6)',
                      border: cityFilter === city ? 'none' : '1px solid var(--t-linen)',
                      fontFamily: "'Space Mono', monospace",
                    }}
                  >
                    {city}
                  </button>
                ))}
              </div>
            )}

            {/* Place list */}
            {filteredPlaces.length > 0 ? (
              <div className="flex flex-col gap-2">
                {filteredPlaces.map(place => (
                  <PlaceCard
                    key={place.id}
                    place={place}
                    onTap={() => setDetailItem(place)}
                    onToggleStar={() => setShortlistPickerItem(place)}
                    onLongPress={() => setAddToTripItem(place)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <PerriandIcon name="discover" size={36} color="rgba(28,26,23,0.15)" />
                <p className="text-[13px] mt-3" style={{ color: 'rgba(28,26,23,0.5)' }}>
                  {searchQuery || typeFilter !== 'all' || cityFilter !== 'all'
                    ? 'No places match your filters'
                    : 'No saved places yet'}
                </p>
                <p className="text-[11px] mt-1" style={{ color: 'rgba(28,26,23,0.35)' }}>
                  {searchQuery || typeFilter !== 'all' || cityFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Import places to get started'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ Create Shortlist Modal ═══ */}
      {showCreateShortlist && (
        <CreateShortlistModal
          onClose={() => setShowCreateShortlist(false)}
          onCreate={(name, emoji) => {
            createShortlist(name, emoji);
            setShowCreateShortlist(false);
          }}
        />
      )}

      {/* ═══ Add to Shortlist sheet ═══ */}
      {shortlistPickerItem && (
        <AddToShortlistSheet
          place={shortlistPickerItem}
          onClose={() => setShortlistPickerItem(null)}
        />
      )}

      {/* ═══ Add to Trip sheet ═══ */}
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

      {/* ═══ Place Detail Sheet ═══ */}
      {detailItem && (
        <PlaceDetailSheet
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onRate={() => setRatingItem(detailItem)}
          onViewBriefing={() => {
            const placeId = (detailItem.google as Record<string, unknown> & { placeId?: string })?.placeId;
            if (placeId) {
              setBriefingPlace({ id: placeId, name: detailItem.name, matchScore: detailItem.matchScore });
            }
          }}
          siblingPlaces={detailItem.importBatchId
            ? myPlaces.filter(p => p.importBatchId === detailItem.importBatchId && p.id !== detailItem.id)
            : undefined}
        />
      )}

      {/* Briefing View */}
      {briefingPlace && (
        <BriefingView
          googlePlaceId={briefingPlace.id}
          placeName={briefingPlace.name}
          matchScore={briefingPlace.matchScore}
          onClose={() => setBriefingPlace(null)}
        />
      )}

      {/* Rating Sheet */}
      {ratingItem && (
        <RatingSheet
          item={ratingItem}
          onClose={() => setRatingItem(null)}
          onSave={handleRate}
        />
      )}

      {/* Import Drawer */}
      {importOpen && (
        <ImportDrawer onClose={() => { resetImport(); setImportOpen(false); }} />
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
      className="rounded-xl cursor-pointer transition-all overflow-hidden"
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
          <PerriandIcon name={typeIcon as any} size={20} color="rgba(28,26,23,0.7)" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--t-ink)', fontFamily: "'DM Sans', sans-serif" }}>
                {place.name}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: 'rgba(28,26,23,0.5)' }}>
                  {place.type.charAt(0).toUpperCase() + place.type.slice(1)}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(28,26,23,0.5)' }}>· {place.location.split(',')[0]}</span>
              </div>
            </div>

            {/* Star toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all flex-shrink-0"
              style={{
                background: isStarred ? 'var(--t-verde)' : 'rgba(28,26,23,0.06)',
                color: isStarred ? 'white' : 'rgba(28,26,23,0.5)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <PerriandIcon name="star" size={12} color={isStarred ? 'white' : 'rgba(28,26,23,0.5)'} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-3 pt-2 pb-3">
        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
          {place.friendAttribution && (
            <span
              className="px-1.5 py-0.5 rounded flex items-center gap-1"
              style={{ fontSize: 9, fontWeight: 600, background: 'rgba(42,122,86,0.06)', color: 'var(--t-verde)', fontFamily: "'Space Mono', monospace" }}
            >
              <PerriandIcon name="friend" size={10} color="var(--t-verde)" /> {place.friendAttribution.name}
            </span>
          )}
          {google?.rating && (
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: 'rgba(28,26,23,0.5)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <PerriandIcon name="star" size={10} color="rgba(28,26,23,0.5)" /> {google.rating}
            </span>
          )}
          {priceStr && (
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: 'rgba(28,26,23,0.4)' }}>
              {priceStr}
            </span>
          )}
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, fontWeight: 600, color: 'var(--t-honey)' }}>
            {place.matchScore}%
          </span>
        </div>

        {truncSub && (
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            color: 'rgba(28,26,23,0.6)',
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

function CreateShortlistModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (name: string, emoji: string) => void;
}) {
  const [name, setName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('pin');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.3)' }} />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full rounded-t-2xl px-5 pt-5 pb-8"
        style={{ maxWidth: 480, background: 'var(--t-cream)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <span
            style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, fontStyle: 'italic', color: 'var(--t-ink)' }}
          >
            New Shortlist
          </span>
          <button
            onClick={onClose}
            style={{ color: 'rgba(28,26,23,0.5)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <PerriandIcon name="close" size={16} color="rgba(28,26,23,0.5)" />
          </button>
        </div>

        {/* Icon picker */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {ICON_OPTIONS.map(icon => (
            <button
              key={icon.name}
              onClick={() => setSelectedEmoji(icon.name)}
              className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-all"
              style={{
                background: selectedEmoji === icon.name ? 'var(--t-ink)' : 'white',
                border: selectedEmoji === icon.name ? 'none' : '1px solid var(--t-linen)',
              }}
            >
              <PerriandIcon
                name={icon.name}
                size={16}
                color={selectedEmoji === icon.name ? 'white' : 'rgba(28,26,23,0.5)'}
              />
            </button>
          ))}
        </div>

        {/* Name input */}
        <input
          type="text"
          placeholder="Shortlist name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="w-full rounded-lg py-3 px-4 text-[14px] mb-4"
          style={{
            background: 'white',
            border: '1px solid var(--t-linen)',
            color: 'var(--t-ink)',
            fontFamily: "'DM Sans', sans-serif",
            outline: 'none',
          }}
        />

        {/* Create button */}
        <button
          onClick={() => {
            if (name.trim()) {
              onCreate(name.trim(), selectedEmoji);
            }
          }}
          disabled={!name.trim()}
          className="w-full py-3 rounded-xl text-[13px] font-semibold transition-all cursor-pointer"
          style={{
            background: name.trim() ? 'var(--t-ink)' : 'rgba(28,26,23,0.1)',
            color: name.trim() ? 'white' : 'rgba(28,26,23,0.3)',
            border: 'none',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Create Shortlist
        </button>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════
// Add to Trip Sheet — quick-add from Library
// ═══════════════════════════════════════════

import type { Trip } from '@/types';

function AddToTripSheet({ place, trips, onClose, onAdd }: {
  place: ImportedPlace;
  trips: Trip[];
  onClose: () => void;
  onAdd: (tripId: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.3)' }} />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full rounded-t-2xl px-5 pt-5 pb-8"
        style={{ maxWidth: 480, background: 'var(--t-cream)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[14px] font-semibold" style={{ color: 'var(--t-ink)', fontFamily: "'DM Serif Display', serif" }}>
              Add to trip
            </div>
            <div className="text-[11px]" style={{ color: 'rgba(28,26,23,0.6)' }}>
              {place.name}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center"
            style={{ color: 'rgba(28,26,23,0.5)', background: 'none', border: 'none', cursor: 'pointer', width: 24, height: 24 }}
          >
            <PerriandIcon name="close" size={16} color="rgba(28,26,23,0.5)" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {trips.map(trip => (
            <button
              key={trip.id}
              onClick={() => onAdd(trip.id)}
              className="flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all hover:scale-[1.01]"
              style={{ background: 'white', border: '1px solid var(--t-linen)' }}
            >
              <div>
                <div className="text-[13px] font-semibold" style={{ color: 'var(--t-ink)' }}>
                  {trip.name}
                </div>
                <div className="text-[10px]" style={{ color: 'rgba(28,26,23,0.5)' }}>
                  {trip.location} {trip.startDate && `· ${trip.startDate}`}
                </div>
              </div>
              <span className="text-[11px]" style={{ color: 'var(--t-honey)' }}>Add →</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

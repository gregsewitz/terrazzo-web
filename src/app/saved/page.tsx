'use client';

import { useMemo, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TabBar from '@/components/TabBar';
import PlaceDetailSheet from '@/components/PlaceDetailSheet';
import RatingSheet from '@/components/RatingSheet';
import { useSavedStore } from '@/stores/savedStore';
import { useTripStore } from '@/stores/tripStore';
import { REACTIONS, PlaceType, ImportedPlace, PlaceRating, SOURCE_STYLES } from '@/types';
import IntelligenceView from '@/components/IntelligenceView';
import ImportDrawer from '@/components/ImportDrawer';
import { useImportStore } from '@/stores/importStore';

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

function getSourceTag(place: ImportedPlace): { label: string; bg: string; color: string } | null {
  if (place.friendAttribution) {
    return { label: `👤 ${place.friendAttribution.name}`, bg: 'rgba(42,122,86,0.1)', color: 'var(--t-verde)' };
  }
  if (place.matchScore && place.matchScore >= 80) {
    return { label: `${place.matchScore}% match`, bg: 'rgba(200,146,58,0.1)', color: 'var(--t-honey)' };
  }
  if (place.ghostSource === 'maps') {
    return { label: '📍 Maps', bg: 'rgba(232,115,58,0.08)', color: 'var(--t-panton-orange)' };
  }
  if (place.ghostSource === 'article') {
    return { label: `📄 ${place.source?.name || 'Article'}`, bg: 'rgba(200,146,58,0.1)', color: 'var(--t-honey)' };
  }
  return null;
}

type CollectTab = 'picks' | 'all';

export default function SavedPage() {
  const router = useRouter();
  const myPlaces = useSavedStore(s => s.myPlaces);
  const ratePlace = useSavedStore(s => s.ratePlace);
  const toggleStar = useSavedStore(s => s.toggleStar);
  const injectGhostCandidates = useTripStore(s => s.injectGhostCandidates);
  const trips = useTripStore(s => s.trips);
  const { isOpen: importOpen, setOpen: setImportOpen, reset: resetImport } = useImportStore();

  const [activeTab, setActiveTab] = useState<CollectTab>('picks');
  const [detailItem, setDetailItem] = useState<ImportedPlace | null>(null);
  const [ratingItem, setRatingItem] = useState<ImportedPlace | null>(null);
  const [intelligencePlace, setIntelligencePlace] = useState<{ id: string; name: string; matchScore?: number } | null>(null);
  const [addToTripItem, setAddToTripItem] = useState<ImportedPlace | null>(null);

  // All places now live in savedStore (unified)
  const allPlaces = myPlaces;

  // My Picks = shortlisted places
  const myPicks = useMemo(() =>
    allPlaces.filter(p => p.isShortlisted),
    [allPlaces]
  );

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

  const displayPlaces = activeTab === 'picks' ? myPicks : allPlaces;

  return (
    <div className="min-h-screen pb-16" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}>
      <div className="px-5 pt-6">
        {/* Compact header — toggle + import on one line */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span
              onClick={() => setActiveTab('picks')}
              className="cursor-pointer transition-all"
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontStyle: 'italic',
                fontSize: activeTab === 'picks' ? 22 : 14,
                fontWeight: activeTab === 'picks' ? 400 : 400,
                color: activeTab === 'picks' ? 'var(--t-ink)' : 'rgba(28,26,23,0.75)',
                lineHeight: 1.2,
              }}
            >
              ✦ Shortlist
            </span>
            <span style={{ color: 'rgba(28,26,23,0.12)', fontSize: 16, fontWeight: 300 }}>|</span>
            <span
              onClick={() => setActiveTab('all')}
              className="cursor-pointer transition-all"
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontStyle: 'italic',
                fontSize: activeTab === 'all' ? 22 : 14,
                fontWeight: activeTab === 'all' ? 400 : 400,
                color: activeTab === 'all' ? 'var(--t-ink)' : 'rgba(28,26,23,0.75)',
                lineHeight: 1.2,
              }}
            >
              All Places
            </span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: 'rgba(28,26,23,0.75)', marginLeft: 2 }}>
              {activeTab === 'picks' ? myPicks.length : allPlaces.length}
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

        {/* Helpful hint for All Places tab */}
        {activeTab === 'all' && (
          <div
            className="text-[10px] leading-relaxed mb-3 px-3 py-2 rounded-lg"
            style={{ color: 'rgba(28,26,23,0.85)', background: 'rgba(28,26,23,0.03)' }}
          >
            This is everything you've saved — tap ✦ to shortlist places.
          </div>
        )}

        {/* Place list */}
        {displayPlaces.length > 0 ? (
          <div className="flex flex-col gap-2">
            {displayPlaces.map(place => (
              <PlaceCard
                key={place.id}
                place={place}
                variant={activeTab === 'picks' ? 'minimal' : 'full'}
                onTap={() => setDetailItem(place)}
                onToggleStar={toggleStar}
                onLongPress={() => setAddToTripItem(place)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <span className="text-3xl mb-3 block">
              {activeTab === 'picks' ? '♡' : '◇'}
            </span>
            <p className="text-[13px] mb-1" style={{ color: 'rgba(28,26,23,0.9)' }}>
              {activeTab === 'picks' ? 'No shortlisted places yet' : 'No saved places'}
            </p>
            <p className="text-[11px]" style={{ color: 'rgba(28,26,23,0.85)' }}>
              {activeTab === 'picks'
                ? 'Shortlist places from "All Places" to add them here'
                : 'Import places to get started'}
            </p>
          </div>
        )}
      </div>

      {/* Add to Trip sheet */}
      {addToTripItem && trips.length > 0 && (
        <AddToTripSheet
          place={addToTripItem}
          trips={trips}
          onClose={() => setAddToTripItem(null)}
          onAdd={(tripId) => {
            // Shortlist if not already shortlisted
            if (!addToTripItem.isShortlisted) {
              toggleStar(addToTripItem.id);
            }
            setAddToTripItem(null);
          }}
        />
      )}

      {/* Place Detail Sheet */}
      {detailItem && (
        <PlaceDetailSheet
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onRate={() => setRatingItem(detailItem)}
          onViewIntelligence={() => {
            const placeId = (detailItem.google as Record<string, unknown> & { placeId?: string })?.placeId;
            if (placeId) {
              setIntelligencePlace({ id: placeId, name: detailItem.name, matchScore: detailItem.matchScore });
            }
          }}
          siblingPlaces={detailItem.importBatchId
            ? allPlaces.filter(p => p.importBatchId === detailItem.importBatchId && p.id !== detailItem.id)
            : undefined}
        />
      )}

      {/* Intelligence View */}
      {intelligencePlace && (
        <IntelligenceView
          googlePlaceId={intelligencePlace.id}
          placeName={intelligencePlace.name}
          matchScore={intelligencePlace.matchScore}
          onClose={() => setIntelligencePlace(null)}
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
// Place Card — supports minimal & full variants
// ═══════════════════════════════════════════

function PlaceCard({ place, variant, onTap, onToggleStar, onLongPress }: {
  place: ImportedPlace;
  variant: 'minimal' | 'full';
  onTap: () => void;
  onToggleStar: (id: string) => void;
  onLongPress: () => void;
}) {
  const isStarred = !!place.isShortlisted;
  const typeIcon = TYPE_ICONS[place.type] || '📍';
  const google = place.google;
  const priceStr = google?.priceLevel ? '$'.repeat(google.priceLevel) : null;
  const srcStyle = SOURCE_STYLES[place.ghostSource as keyof typeof SOURCE_STYLES] || SOURCE_STYLES.manual;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Best subtitle: friend note > personal note > terrazzo insight > taste note
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
        background: variant === 'full' && isStarred ? 'rgba(42,122,86,0.03)' : 'white',
        border: variant === 'full' && isStarred ? '1.5px solid var(--t-verde)' : '1px solid var(--t-linen)',
      }}
    >
      {/* Top row: thumbnail + name + meta */}
      <div className="flex gap-2.5 p-3 pb-0">
        {/* Thumbnail */}
        <div
          className="rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            width: 48, height: 48,
            background: THUMB_GRADIENTS[place.type] || THUMB_GRADIENTS.restaurant,
            fontSize: 20,
          }}
        >
          {typeIcon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--t-ink)', fontFamily: "'DM Sans', sans-serif" }}>
                {place.name}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: 'rgba(28,26,23,0.85)' }}>
                  {place.type.charAt(0).toUpperCase() + place.type.slice(1)}
                </span>
                {google?.category && google.category.toLowerCase() !== place.type && (
                  <span style={{ fontSize: 10, color: 'rgba(28,26,23,0.8)' }}>· {google.category}</span>
                )}
                <span style={{ fontSize: 10, color: 'rgba(28,26,23,0.8)' }}>· {place.location.split(',')[0]}</span>
              </div>
            </div>

            {/* Star toggle — only shown in All Places view */}
            {variant === 'full' ? (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleStar(place.id); }}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-all flex-shrink-0"
                style={{
                  background: isStarred ? 'var(--t-verde)' : 'rgba(28,26,23,0.06)',
                  color: isStarred ? 'white' : 'rgba(28,26,23,0.85)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                ✦
              </button>
            ) : (
              /* Match score in picks view */
              <span
                className="px-1.5 py-0.5 rounded-md flex-shrink-0"
                style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, background: 'rgba(200,146,58,0.08)', color: 'var(--t-honey)' }}
              >
                {place.matchScore}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom section: badges + subtitle */}
      <div className="px-3 pt-2 pb-3">
        {/* Badges row: source, google rating, price */}
        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
          <span
            className="px-1.5 py-0.5 rounded"
            style={{ fontSize: 9, fontWeight: 600, background: srcStyle.bg, color: srcStyle.color, fontFamily: "'Space Mono', monospace" }}
          >
            {srcStyle.icon} {place.source?.name || srcStyle.label}
          </span>
          {place.friendAttribution && (
            <span
              className="px-1.5 py-0.5 rounded"
              style={{ fontSize: 9, fontWeight: 600, background: 'rgba(42,122,86,0.06)', color: 'var(--t-verde)', fontFamily: "'Space Mono', monospace" }}
            >
              👤 {place.friendAttribution.name}
            </span>
          )}
          {google?.rating && (
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: 'rgba(28,26,23,0.85)' }}>
              ★ {google.rating}
            </span>
          )}
          {priceStr && (
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: 'rgba(28,26,23,0.8)' }}>
              {priceStr}
            </span>
          )}
          {google?.placeId && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                window.open(`https://www.google.com/maps/place/?q=place_id:${google.placeId}`, '_blank');
              }}
              style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: 'rgba(28,26,23,0.8)', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: 'rgba(28,26,23,0.2)' }}
            >
              Maps ↗
            </span>
          )}
          {/* Match score in full variant */}
          {variant === 'full' && (
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, fontWeight: 600, color: 'var(--t-honey)' }}>
              {place.matchScore}%
            </span>
          )}
        </div>

        {/* Subtitle — insight or note */}
        {truncSub && (
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            color: 'rgba(28,26,23,0.9)',
            fontStyle: 'italic',
            lineHeight: 1.4,
          }}>
            {truncSub}
          </div>
        )}

        {/* What to order pills — picks view only, if available */}
        {variant === 'minimal' && place.whatToOrder && place.whatToOrder.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {place.whatToOrder.slice(0, 3).map((item, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full"
                style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 9, background: 'rgba(28,26,23,0.04)', color: 'rgba(28,26,23,0.9)' }}
              >
                {item}
              </span>
            ))}
            {place.whatToOrder.length > 3 && (
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, color: 'rgba(28,26,23,0.75)' }}>
                +{place.whatToOrder.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════
// Add to Trip Sheet — quick-add from Collect
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
            <div className="text-[11px]" style={{ color: 'rgba(28,26,23,0.9)' }}>
              {place.name}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-lg"
            style={{ color: 'rgba(28,26,23,0.85)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ✕
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
                <div className="text-[10px]" style={{ color: 'rgba(28,26,23,0.9)' }}>
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

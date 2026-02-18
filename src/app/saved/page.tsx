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

  // My Picks = starred places
  const myPicks = useMemo(() =>
    myPlaces.filter(p => p.rating?.reaction === 'myPlace'),
    [myPlaces]
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

  const displayPlaces = activeTab === 'picks' ? myPicks : myPlaces;

  return (
    <div className="min-h-screen pb-16" style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}>
      <div className="px-5 pt-6">
        {/* Header */}
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h1
              className="text-[24px]"
              style={{ fontFamily: "'DM Serif Display', serif", fontStyle: 'italic', color: 'var(--t-ink)' }}
            >
              Collect
            </h1>
            <div className="text-[11px] mt-0.5" style={{ color: 'rgba(28,26,23,0.7)' }}>
              {myPicks.length} picks · {myPlaces.length} saved
            </div>
          </div>
          <button
            onClick={() => setImportOpen(true)}
            className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full border-2 cursor-pointer transition-colors hover:opacity-80"
            style={{
              background: 'transparent',
              color: 'var(--t-panton-orange)',
              borderColor: 'var(--t-panton-orange)',
              fontFamily: "'Space Mono', monospace",
            }}
          >
            + Import
          </button>
        </div>

        {/* Tab toggle: My Picks / All Saved */}
        <div
          className="flex gap-1 p-0.5 rounded-lg mb-5"
          style={{ background: 'var(--t-linen)' }}
        >
          {(['picks', 'all'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition-all"
              style={{
                background: activeTab === tab ? 'white' : 'transparent',
                color: activeTab === tab ? 'var(--t-ink)' : 'rgba(28,26,23,0.5)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {tab === 'picks' ? `My Picks (${myPicks.length})` : `All Saved (${myPlaces.length})`}
            </button>
          ))}
        </div>

        {/* Helpful hint for All Saved tab */}
        {activeTab === 'all' && (
          <div
            className="text-[10px] leading-relaxed mb-3 px-3 py-2 rounded-lg"
            style={{ color: 'rgba(28,26,23,0.6)', background: 'rgba(42,122,86,0.04)' }}
          >
            Tap ★ to add places to your picks — only picks appear in the trip planner.
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
            <p className="text-[13px] mb-1" style={{ color: 'rgba(28,26,23,0.65)' }}>
              {activeTab === 'picks' ? 'No picks yet' : 'No saved places'}
            </p>
            <p className="text-[11px]" style={{ color: 'rgba(28,26,23,0.45)' }}>
              {activeTab === 'picks'
                ? 'Star places from "All Saved" to add them here'
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
            // Star if not already starred
            if (addToTripItem.rating?.reaction !== 'myPlace') {
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
            ? myPlaces.filter(p => p.importBatchId === detailItem.importBatchId && p.id !== detailItem.id)
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
  const isStarred = place.rating?.reaction === 'myPlace';
  const sourceTag = getSourceTag(place);
  const typeIcon = TYPE_ICONS[place.type] || '📍';
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      className="flex gap-2.5 p-3 rounded-xl cursor-pointer transition-all"
      style={{
        background: isStarred ? 'rgba(42,122,86,0.03)' : 'white',
        border: isStarred ? '1.5px solid var(--t-verde)' : '1px solid var(--t-linen)',
      }}
    >
      {/* Type icon or thumbnail */}
      {variant === 'minimal' ? (
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
          style={{ background: 'rgba(28,26,23,0.04)' }}
        >
          {typeIcon}
        </div>
      ) : (
        <div
          className="w-12 h-12 rounded-[10px] flex-shrink-0"
          style={{ background: THUMB_GRADIENTS[place.type] || THUMB_GRADIENTS.restaurant }}
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold truncate" style={{ color: 'var(--t-ink)' }}>
              {place.name}
            </div>
            <div className="text-[10px]" style={{ color: 'rgba(28,26,23,0.65)' }}>
              {place.location}
            </div>
          </div>

          {/* Star toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleStar(place.id); }}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all flex-shrink-0"
            style={{
              background: isStarred ? 'var(--t-verde)' : 'rgba(28,26,23,0.06)',
              color: isStarred ? 'white' : 'rgba(28,26,23,0.45)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            {isStarred ? '★' : '☆'}
          </button>
        </div>

        {/* Source tag — only in full variant */}
        {variant === 'full' && sourceTag && (
          <div className="flex gap-1 mt-1">
            <span
              className="text-[9px] font-semibold px-2 py-0.5 rounded-md"
              style={{ background: sourceTag.bg, color: sourceTag.color }}
            >
              {sourceTag.label}
            </span>
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
            <div className="text-[11px]" style={{ color: 'rgba(28,26,23,0.6)' }}>
              {place.name}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-lg"
            style={{ color: 'rgba(28,26,23,0.5)', background: 'none', border: 'none', cursor: 'pointer' }}
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
                <div className="text-[10px]" style={{ color: 'rgba(28,26,23,0.6)' }}>
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

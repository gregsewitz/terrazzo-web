'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { ImportedPlace, PlaceRating } from '@/types';
import { useSavedStore } from '@/stores/savedStore';
import { FONT, INK } from '@/constants/theme';
import PlaceDetailSheet from '@/components/PlaceDetailSheet';
import RatingSheet from '@/components/RatingSheet';
import BriefingView from '@/components/BriefingView';
import AddToCollectionSheet from '@/components/AddToCollectionSheet';

// ─── Config: each page provides its own callbacks ───

interface PlaceDetailConfig {
  /** Called when user saves a rating — page wires this to the appropriate store.
   *  Receives the full place object so the page can do post-rating work (e.g. ghost injection). */
  onRate: (place: ImportedPlace, rating: PlaceRating) => void;
  /** For search preview on saved/page — saves a preview place to the library */
  onSavePreview?: (place: ImportedPlace) => void;
  /** Get sibling places for the detail sheet (e.g. same import batch) */
  getSiblingPlaces?: (place: ImportedPlace) => ImportedPlace[];
}

// ─── Public API returned by usePlaceDetail() ───

interface PlaceDetailAPI {
  /** Open full detail sheet for a library place */
  openDetail: (place: ImportedPlace) => void;
  /** Open detail sheet in preview mode (search result, not yet saved) */
  openPreview: (place: ImportedPlace) => void;
  /** Close the detail sheet */
  closeDetail: () => void;
  /** Currently open detail item (for pages that need to reference it) */
  detailItem: ImportedPlace | null;
  /** Open the "Add to Collection" picker for a place (can be called from cards, etc.) */
  openCollectionPicker: (place: ImportedPlace) => void;
}

const PlaceDetailContext = createContext<PlaceDetailAPI | null>(null);

export function usePlaceDetail(): PlaceDetailAPI {
  const ctx = useContext(PlaceDetailContext);
  if (!ctx) throw new Error('usePlaceDetail must be used within <PlaceDetailProvider>');
  return ctx;
}

// ─── Provider ───

interface PlaceDetailProviderProps {
  config: PlaceDetailConfig;
  children: ReactNode;
}

export function PlaceDetailProvider({ config, children }: PlaceDetailProviderProps) {
  // ─── Internal state ───
  const [detailItem, setDetailItem] = useState<ImportedPlace | null>(null);
  const [isDetailPreview, setIsDetailPreview] = useState(false);
  const [ratingItem, setRatingItem] = useState<ImportedPlace | null>(null);
  const [ratingInitialStep, setRatingInitialStep] = useState<'gut' | 'details' | 'note'>('gut');
  const [briefingPlace, setBriefingPlace] = useState<{ id: string; name: string; matchScore?: number; place?: ImportedPlace } | null>(null);
  const [collectionPickerItem, setCollectionPickerItem] = useState<ImportedPlace | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<ImportedPlace | null>(null);
  const removePlace = useSavedStore(s => s.removePlace);

  // ─── Public API ───
  const openDetail = useCallback((place: ImportedPlace) => {
    setDetailItem(place);
    setIsDetailPreview(false);
  }, []);

  const openPreview = useCallback((place: ImportedPlace) => {
    setDetailItem(place);
    setIsDetailPreview(true);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailItem(null);
    setIsDetailPreview(false);
  }, []);

  // ─── Internal handlers ───
  const handleRate = useCallback(() => {
    if (!detailItem) return;
    setRatingInitialStep('gut');
    setRatingItem(detailItem);
  }, [detailItem]);

  const handleEditRating = useCallback(() => {
    if (!detailItem) return;
    setRatingInitialStep('details');
    setRatingItem(detailItem);
  }, [detailItem]);

  const handleViewBriefing = useCallback(() => {
    if (!detailItem) return;
    const placeId = (detailItem.google as Record<string, unknown> & { placeId?: string })?.placeId;
    if (placeId) {
      setBriefingPlace({ id: placeId, name: detailItem.name, matchScore: detailItem.matchScore, place: detailItem });
    }
  }, [detailItem]);

  const handleCollectionTap = useCallback(() => {
    if (detailItem) setCollectionPickerItem(detailItem);
  }, [detailItem]);

  const handleDeletePlace = useCallback(() => {
    if (detailItem) setDeleteConfirmItem(detailItem);
  }, [detailItem]);

  const confirmDeletePlace = useCallback(() => {
    if (!deleteConfirmItem) return;
    removePlace(deleteConfirmItem.id);
    setDeleteConfirmItem(null);
    setDetailItem(null);
  }, [deleteConfirmItem, removePlace]);

  const openCollectionPicker = useCallback((place: ImportedPlace) => {
    setCollectionPickerItem(place);
  }, []);

  const handleSaveFromPreview = useCallback(() => {
    if (!detailItem || !config.onSavePreview) return;
    config.onSavePreview(detailItem);
    // After saving, transition out of preview — the page's onSavePreview
    // should add the place and we re-open it as a library item
    setIsDetailPreview(false);
  }, [detailItem, config]);

  const handleRatingSave = useCallback((rating: PlaceRating) => {
    if (!ratingItem) return;
    config.onRate(ratingItem, rating);
    // Update the detail item in-place so the badge refreshes
    setDetailItem(prev => prev?.id === ratingItem.id ? { ...prev, rating } : prev);
    setRatingItem(null);
  }, [ratingItem, config]);

  const siblingPlaces = detailItem && config.getSiblingPlaces
    ? config.getSiblingPlaces(detailItem)
    : undefined;

  const api: PlaceDetailAPI = { openDetail, openPreview, closeDetail, detailItem, openCollectionPicker };

  return (
    <PlaceDetailContext.Provider value={api}>
      {children}

      {/* ═══ Place Detail Sheet ═══ */}
      {detailItem && (
        <PlaceDetailSheet
          item={detailItem}
          onClose={closeDetail}
          onRate={isDetailPreview ? undefined : handleRate}
          onEditRating={isDetailPreview ? undefined : handleEditRating}
          onCollectionTap={isDetailPreview ? undefined : handleCollectionTap}
          onViewBriefing={isDetailPreview ? undefined : handleViewBriefing}
          onDelete={isDetailPreview ? undefined : handleDeletePlace}
          siblingPlaces={siblingPlaces}
        />
      )}

      {/* ═══ Briefing View ═══ */}
      {briefingPlace && (
        <BriefingView
          googlePlaceId={briefingPlace.id}
          placeName={briefingPlace.name}
          matchScore={briefingPlace.matchScore}
          place={briefingPlace.place}
          onClose={() => setBriefingPlace(null)}
        />
      )}

      {/* ═══ Rating Sheet ═══ */}
      {ratingItem && (
        <RatingSheet
          item={ratingItem}
          onClose={() => { setRatingItem(null); setRatingInitialStep('gut'); }}
          onSave={handleRatingSave}
          initialStep={ratingInitialStep}
        />
      )}

      {/* ═══ Add to Collection Sheet ═══ */}
      {collectionPickerItem && (
        <AddToCollectionSheet
          place={collectionPickerItem}
          onClose={() => setCollectionPickerItem(null)}
        />
      )}

      {/* ═══ Delete Place Confirmation ═══ */}
      {deleteConfirmItem && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setDeleteConfirmItem(null)}
        >
          <div
            className="rounded-2xl p-6 mx-6"
            style={{
              background: 'white',
              maxWidth: 340,
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{
              fontFamily: FONT.serif,
              fontStyle: 'italic',
              fontSize: 18,
              color: 'var(--t-ink)',
              margin: '0 0 8px',
            }}>
              Remove place?
            </h3>
            <p style={{
              fontFamily: FONT.sans,
              fontSize: 13,
              color: INK['70'],
              lineHeight: 1.5,
              margin: '0 0 20px',
            }}>
              <strong>{deleteConfirmItem.name}</strong> will be removed from your library and all collections. You can re-add it anytime.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="flex-1 py-2.5 rounded-lg cursor-pointer"
                style={{
                  fontFamily: FONT.sans,
                  fontSize: 13,
                  fontWeight: 600,
                  background: INK['04'],
                  border: '1px solid var(--t-linen)',
                  color: 'var(--t-ink)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeletePlace}
                className="flex-1 py-2.5 rounded-lg cursor-pointer"
                style={{
                  fontFamily: FONT.sans,
                  fontSize: 13,
                  fontWeight: 600,
                  background: 'var(--t-signal-red, #d63020)',
                  border: 'none',
                  color: 'white',
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </PlaceDetailContext.Provider>
  );
}

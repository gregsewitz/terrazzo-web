'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { ImportedPlace, PlaceRating } from '@/types';
import PlaceDetailSheet from '@/components/PlaceDetailSheet';
import RatingSheet from '@/components/RatingSheet';
import BriefingView from '@/components/BriefingView';
import AddToShortlistSheet from '@/components/AddToShortlistSheet';

// ─── Config: each page provides its own callbacks ───

interface PlaceDetailConfig {
  /** Called when user saves a rating — page wires this to the appropriate store */
  onRate: (placeId: string, rating: PlaceRating) => void;
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
  const [briefingPlace, setBriefingPlace] = useState<{ id: string; name: string; matchScore?: number } | null>(null);
  const [shortlistPickerItem, setShortlistPickerItem] = useState<ImportedPlace | null>(null);

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
      setBriefingPlace({ id: placeId, name: detailItem.name, matchScore: detailItem.matchScore });
    }
  }, [detailItem]);

  const handleShortlistTap = useCallback(() => {
    if (detailItem) setShortlistPickerItem(detailItem);
  }, [detailItem]);

  const handleSaveFromPreview = useCallback(() => {
    if (!detailItem || !config.onSavePreview) return;
    config.onSavePreview(detailItem);
    // After saving, transition out of preview — the page's onSavePreview
    // should add the place and we re-open it as a library item
    setIsDetailPreview(false);
  }, [detailItem, config]);

  const handleRatingSave = useCallback((rating: PlaceRating) => {
    if (!ratingItem) return;
    config.onRate(ratingItem.id, rating);
    // Update the detail item in-place so the badge refreshes
    setDetailItem(prev => prev?.id === ratingItem.id ? { ...prev, rating } : prev);
    setRatingItem(null);
  }, [ratingItem, config]);

  const siblingPlaces = detailItem && config.getSiblingPlaces
    ? config.getSiblingPlaces(detailItem)
    : undefined;

  const api: PlaceDetailAPI = { openDetail, openPreview, closeDetail, detailItem };

  return (
    <PlaceDetailContext.Provider value={api}>
      {children}

      {/* ═══ Place Detail Sheet ═══ */}
      {detailItem && (
        <PlaceDetailSheet
          item={detailItem}
          onClose={closeDetail}
          onRate={isDetailPreview ? undefined : handleRate}
          onViewBriefing={isDetailPreview ? undefined : handleViewBriefing}
          siblingPlaces={siblingPlaces}
        />
      )}

      {/* ═══ Briefing View ═══ */}
      {briefingPlace && (
        <BriefingView
          googlePlaceId={briefingPlace.id}
          placeName={briefingPlace.name}
          matchScore={briefingPlace.matchScore}
          onClose={() => setBriefingPlace(null)}
        />
      )}

      {/* ═══ Rating Sheet ═══ */}
      {ratingItem && (
        <RatingSheet
          item={ratingItem}
          onClose={() => setRatingItem(null)}
          onSave={handleRatingSave}
        />
      )}

      {/* ═══ Add to Shortlist Sheet ═══ */}
      {shortlistPickerItem && (
        <AddToShortlistSheet
          place={shortlistPickerItem}
          onClose={() => setShortlistPickerItem(null)}
        />
      )}
    </PlaceDetailContext.Provider>
  );
}

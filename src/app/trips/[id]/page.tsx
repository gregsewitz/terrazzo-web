'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useTripStore } from '@/stores/tripStore';
import { useSavedStore } from '@/stores/savedStore';
import { useImportStore } from '@/stores/importStore';
import { usePoolStore } from '@/stores/poolStore';
import { ImportedPlace, PlaceRating } from '@/types';
import TabBar from '@/components/TabBar';
import DayPlanner from '@/components/DayPlanner';
import PoolTray from '@/components/PoolTray';
import PlaceDetailSheet from '@/components/PlaceDetailSheet';
import RatingSheet from '@/components/RatingSheet';
import ImportDrawer from '@/components/ImportDrawer';
import ChatSidebar from '@/components/ChatSidebar';

export default function TripDetailPage() {
  const params = useParams();
  const setCurrentTrip = useTripStore(s => s.setCurrentTrip);
  const ratePlace = useTripStore(s => s.ratePlace);
  const injectGhostCandidates = useTripStore(s => s.injectGhostCandidates);
  const trips = useTripStore(s => s.trips);
  const currentTripId = useTripStore(s => s.currentTripId);
  const trip = useMemo(() => trips.find(t => t.id === currentTripId), [trips, currentTripId]);
  const myPlaces = useSavedStore(s => s.myPlaces);
  const { isOpen: importOpen, setOpen: setImportOpen, reset: resetImport } = useImportStore();
  const { setExpanded } = usePoolStore();

  const [detailItem, setDetailItem] = useState<ImportedPlace | null>(null);
  const [ratingItem, setRatingItem] = useState<ImportedPlace | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [ghostsInjected, setGhostsInjected] = useState(false);

  useEffect(() => {
    if (params.id) {
      setCurrentTrip(params.id as string);
    }
  }, [params.id, setCurrentTrip]);

  // On trip load, inject starred My Places as ghost candidates (once)
  useEffect(() => {
    if (trip && !ghostsInjected) {
      const starredPlaces = myPlaces.filter(p =>
        p.rating?.reaction === 'myPlace' || p.rating?.reaction === 'enjoyed'
      );
      if (starredPlaces.length > 0) {
        injectGhostCandidates(starredPlaces);
      }
      setGhostsInjected(true);
    }
  }, [trip, myPlaces, ghostsInjected, injectGhostCandidates]);

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--t-cream)' }}>
        <p style={{ color: 'rgba(28,26,23,0.4)' }}>Trip not found</p>
      </div>
    );
  }

  const handleRate = (rating: PlaceRating) => {
    if (ratingItem) {
      ratePlace(ratingItem.id, rating);
      // Update local state so detail sheet reflects the change
      setDetailItem(prev => prev?.id === ratingItem.id ? { ...prev, rating } : prev);
      setRatingItem(null);
    }
  };

  return (
    <div
      className="min-h-screen relative"
      style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}
    >
      {/* Chat toggle */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed top-4 right-4 z-30 w-10 h-10 rounded-full border-none cursor-pointer flex items-center justify-center text-sm shadow-md"
        style={{ background: 'var(--t-ink)', color: 'var(--t-cream)' }}
        title="Ask Terrazzo"
      >
        💬
      </button>

      {/* Day Planner */}
      <DayPlanner
        onTapDetail={setDetailItem}
        onOpenUnsorted={() => setExpanded(true)}
      />

      {/* Pool Tray */}
      <PoolTray
        onTapDetail={setDetailItem}
        onOpenImport={() => setImportOpen(true)}
      />

      {/* Tab Bar */}
      <TabBar />

      {/* Place Detail Sheet */}
      {detailItem && (
        <PlaceDetailSheet
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onRate={() => setRatingItem(detailItem)}
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
        <ImportDrawer
          onClose={() => {
            setImportOpen(false);
            resetImport();
          }}
        />
      )}

      {/* Chat Sidebar */}
      <ChatSidebar
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </div>
  );
}

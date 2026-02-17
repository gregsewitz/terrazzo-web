'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTripStore } from '@/stores/tripStore';
import { useSavedStore } from '@/stores/savedStore';
import { useImportStore } from '@/stores/importStore';
import { usePoolStore, SlotContext } from '@/stores/poolStore';
import { ImportedPlace, PlaceRating } from '@/types';
import TabBar from '@/components/TabBar';
import DayPlanner from '@/components/DayPlanner';
import type { TripViewMode, DropTarget } from '@/components/DayPlanner';
import TripMyPlaces from '@/components/TripMyPlaces';
import PoolTray from '@/components/PoolTray';
import PlaceDetailSheet from '@/components/PlaceDetailSheet';
import RatingSheet from '@/components/RatingSheet';
import ImportDrawer from '@/components/ImportDrawer';
import ChatSidebar from '@/components/ChatSidebar';
import IntelligenceView from '@/components/IntelligenceView';
import DragOverlay from '@/components/DragOverlay';

import ExportToMaps from '@/components/ExportToMaps';

export default function TripDetailPage() {
  const params = useParams();
  const setCurrentTrip = useTripStore(s => s.setCurrentTrip);
  const ratePlace = useTripStore(s => s.ratePlace);
  const placeFromSaved = useTripStore(s => s.placeFromSaved);
  const injectGhostCandidates = useTripStore(s => s.injectGhostCandidates);
  const trips = useTripStore(s => s.trips);
  const currentTripId = useTripStore(s => s.currentTripId);
  const trip = useMemo(() => trips.find(t => t.id === currentTripId), [trips, currentTripId]);
  const myPlaces = useSavedStore(s => s.myPlaces);
  const { isOpen: importOpen, setOpen: setImportOpen, reset: resetImport } = useImportStore();
  const { setExpanded, openForSlot } = usePoolStore();

  const [detailItem, setDetailItem] = useState<ImportedPlace | null>(null);
  const [ratingItem, setRatingItem] = useState<ImportedPlace | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const [exportOpen, setExportOpen] = useState(false);
  const [ghostsInjected, setGhostsInjected] = useState(false);
  const [intelligencePlace, setIntelligencePlace] = useState<{ id: string; name: string; matchScore?: number } | null>(null);
  const [viewMode, setViewMode] = useState<TripViewMode>('planner');

  // ─── DRAG & DROP STATE ───
  const [dragItem, setDragItem] = useState<ImportedPlace | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const slotRects = useRef<Map<string, { dayNumber: number; slotId: string; rect: DOMRect }>>(new Map());

  const handleRegisterSlotRef = useCallback((dayNumber: number, slotId: string, rect: DOMRect | null) => {
    const key = `${dayNumber}-${slotId}`;
    if (rect) {
      slotRects.current.set(key, { dayNumber, slotId, rect });
    } else {
      slotRects.current.delete(key);
    }
  }, []);

  const hitTestSlots = useCallback((x: number, y: number): DropTarget | null => {
    for (const [, entry] of slotRects.current) {
      const { rect, dayNumber, slotId } = entry;
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return { dayNumber, slotId };
      }
    }
    return null;
  }, []);

  const handleDragStart = useCallback((item: ImportedPlace, e: React.PointerEvent) => {
    setDragItem(item);
    setDragPos({ x: e.clientX, y: e.clientY });
    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(10);
  }, []);

  // Global pointer move / up while dragging
  useEffect(() => {
    if (!dragItem) return;

    const handleMove = (e: PointerEvent) => {
      e.preventDefault();
      setDragPos({ x: e.clientX, y: e.clientY });
      const target = hitTestSlots(e.clientX, e.clientY);
      setDropTarget(target);
    };

    const handleUp = () => {
      if (dropTarget && dragItem) {
        placeFromSaved(dragItem, dropTarget.dayNumber, dropTarget.slotId);
        if (navigator.vibrate) navigator.vibrate(15);
      }
      setDragItem(null);
      setDragPos(null);
      setDropTarget(null);
    };

    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [dragItem, dropTarget, hitTestSlots, placeFromSaved]);

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
      setDetailItem(prev => prev?.id === ratingItem.id ? { ...prev, rating } : prev);
      setRatingItem(null);
    }
  };

  return (
    <div
      className="min-h-screen relative"
      style={{
        background: 'var(--t-cream)',
        maxWidth: 480,
        margin: '0 auto',
        touchAction: dragItem ? 'none' : 'auto',
      }}
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

      {/* Day Planner (includes header + 3-way toggle for all modes) */}
      <DayPlanner
        viewMode={viewMode}
        onSetViewMode={setViewMode}
        onTapDetail={setDetailItem}
        onOpenUnsorted={() => setExpanded(true)}
        onOpenForSlot={(ctx: SlotContext) => openForSlot(ctx)}
        dropTarget={dropTarget}
        onRegisterSlotRef={handleRegisterSlotRef}
      />

      {/* My Places — only in myPlaces mode */}
      {viewMode === 'myPlaces' && (
        <TripMyPlaces onTapDetail={setDetailItem} />
      )}

      {/* Pool Tray — only in planner mode */}
      {viewMode === 'planner' && (
        <PoolTray
          onTapDetail={setDetailItem}
          onCurateMore={() => setViewMode('myPlaces')}
          onOpenExport={() => setExportOpen(true)}
          onDragStart={handleDragStart}
          dragItemId={dragItem?.id ?? null}
        />
      )}

      {/* Drag Overlay — floating card following pointer */}
      {dragItem && dragPos && (
        <DragOverlay
          item={dragItem}
          x={dragPos.x}
          y={dragPos.y}
          isOverTarget={!!dropTarget}
        />
      )}

      {/* Tab Bar */}
      <TabBar />

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
        <ImportDrawer
          onClose={() => {
            setImportOpen(false);
            resetImport();
          }}
        />
      )}

      {/* Export to Maps */}
      {exportOpen && (
        <ExportToMaps
          places={myPlaces.filter(p => p.rating?.reaction === 'myPlace')}
          collectionName={trip.name}
          onClose={() => setExportOpen(false)}
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

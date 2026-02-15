'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTripStore } from '@/stores/tripStore';
import { useImportStore } from '@/stores/importStore';
import { ImportedPlace } from '@/types';
import TabBar from '@/components/TabBar';
import DayPlanner from '@/components/DayPlanner';
import PoolTray from '@/components/PoolTray';
import PlaceDetailSheet from '@/components/PlaceDetailSheet';
import ImportDrawer from '@/components/ImportDrawer';
import ChatSidebar from '@/components/ChatSidebar';

export default function TripDetailPage() {
  const params = useParams();
  const setCurrentTrip = useTripStore(s => s.setCurrentTrip);
  const trip = useTripStore(s => s.currentTrip());
  const { isOpen: importOpen, setOpen: setImportOpen, reset: resetImport } = useImportStore();

  const [detailItem, setDetailItem] = useState<ImportedPlace | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (params.id) {
      setCurrentTrip(params.id as string);
    }
  }, [params.id, setCurrentTrip]);

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--t-cream)' }}>
        <p style={{ color: 'rgba(28,26,23,0.4)' }}>Trip not found</p>
      </div>
    );
  }

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
      <DayPlanner onTapDetail={setDetailItem} />

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

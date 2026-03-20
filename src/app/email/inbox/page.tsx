'use client';

import { useRouter } from 'next/navigation';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT } from '@/constants/theme';
import { useEmailReservations, type ActiveTab } from '@/hooks/useEmailReservations';
import { UpcomingTab } from '@/components/email/UpcomingTab';
import { HistoryTab } from '@/components/email/HistoryTab';
import { ImportBottomBar } from '@/components/email/ImportBottomBar';

// ─── Tab config ─────────────────────────────────────────────────────────────

const TABS: { key: ActiveTab; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'history', label: 'History' },
];

// ─── Page ───────────────────────────────────────────────────────────────────

export default function EmailReservationsPage() {
  const router = useRouter();
  const {
    tripGroups,
    yearGroups,
    upcomingReservations,
    historyReservations,
    allHistoryReservations,
    activeTab,
    selectedIds,
    tripLinkEnabled,
    ratings,
    typeFilter,
    loading,
    importing,
    creatingTrip,
    existingTrips,
    collections,
    selectedCollectionId,
    creatingCollection,
    error,
    selectedCount,
    switchTab,
    toggleSelect,
    selectAllVisible,
    deselectAll,
    toggleTripLink,
    setRating,
    setTypeFilter,
    createTripForGroup,
    addToExistingTrip,
    removeTripAssignment,
    createdTrips,
    perReservationTrips,
    assignReservationToTrip,
    removeReservationTrip,
    selectCollection,
    createCollectionInline,
    importSelected,
    dismissSelected,
  } = useEmailReservations();

  const totalVisible = activeTab === 'upcoming'
    ? upcomingReservations.length
    : historyReservations.length;

  return (
    <div className="min-h-screen" style={{ background: 'var(--t-cream)', fontFamily: FONT.sans }}>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 px-5 pt-14 pb-3" style={{ background: 'var(--t-cream)' }}>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.back()}
            className="bg-transparent border-none cursor-pointer p-1"
            style={{ color: 'var(--t-ink)' }}
            aria-label="Go back"
          >
            <PerriandIcon name="arrow-left" size={16} color="var(--t-ink)" />
          </button>
          <h1
            className="text-[18px] font-semibold m-0"
            style={{ color: 'var(--t-ink)', fontFamily: FONT.serif }}
          >
            Email Reservations
          </h1>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2">
          {TABS.map(({ key, label }) => {
            const count = key === 'upcoming' ? upcomingReservations.length : historyReservations.length;
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => switchTab(key)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-semibold border-none cursor-pointer transition-all"
                style={{
                  background: isActive ? 'var(--t-ink)' : INK['06'],
                  color: isActive ? 'white' : TEXT.secondary,
                }}
              >
                {label}
                {count > 0 && (
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{
                      background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)',
                      color: isActive ? 'white' : TEXT.secondary,
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="px-5 pb-40">
        {/* Error banner */}
        {error && (
          <div className="mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(214,48,32,0.06)' }}>
            <span className="text-[11px]" style={{ color: 'var(--t-signal-red)' }}>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="text-[12px]" style={{ color: TEXT.secondary }}>Loading…</span>
          </div>
        ) : (
          <>
            {activeTab === 'upcoming' && (
              <UpcomingTab
                tripGroups={tripGroups}
                selectedIds={selectedIds}
                tripLinkEnabled={tripLinkEnabled}
                selectedCount={selectedCount}
                totalCount={totalVisible}
                onToggleSelect={toggleSelect}
                onToggleTripLink={toggleTripLink}
                onSelectAll={selectAllVisible}
                onDeselectAll={deselectAll}
                onCreateTrip={createTripForGroup}
                onAddToExistingTrip={addToExistingTrip}
                onRemoveTripAssignment={removeTripAssignment}
                createdTrips={createdTrips}
                isCreatingTrip={creatingTrip}
                existingTrips={existingTrips}
                perReservationTrips={perReservationTrips}
                onAssignReservationToTrip={assignReservationToTrip}
                onRemoveReservationTrip={removeReservationTrip}
              />
            )}

            {activeTab === 'history' && (
              <HistoryTab
                yearGroups={yearGroups}
                selectedIds={selectedIds}
                ratings={ratings}
                typeFilter={typeFilter}
                selectedCount={selectedCount}
                totalCount={totalVisible}
                unfilteredCount={allHistoryReservations.length}
                onToggleSelect={toggleSelect}
                onRate={setRating}
                onTypeFilterChange={setTypeFilter}
                onSelectAll={selectAllVisible}
                onDeselectAll={deselectAll}
              />
            )}
          </>
        )}
      </div>

      {/* ── Bottom bar ────────────────────────────────────────────────── */}
      {!loading && (
        <ImportBottomBar
          selectedCount={selectedCount}
          activeTab={activeTab}
          importing={importing}
          onImport={importSelected}
          onDismiss={dismissSelected}
          collections={collections}
          selectedCollectionId={selectedCollectionId}
          onSelectCollection={selectCollection}
          onCreateCollection={createCollectionInline}
          creatingCollection={creatingCollection}
        />
      )}
    </div>
  );
}

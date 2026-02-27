'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useAddBarStore } from '@/stores/addBarStore';
import { useSavedStore } from '@/stores/savedStore';
import { streamImport } from '@/lib/importService';
import { detectInputType, DEMO_IMPORT_RESULTS } from '@/lib/import-helpers';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import { useTripStore } from '@/stores/tripStore';
import type { ImportedPlace } from '@/types';

// Sub-components (extracted from this file)
import { searchLibrary } from './add-bar/AddBarShared';
import AddBarSearch from './add-bar/AddBarSearch';
import AddBarImport from './add-bar/AddBarImport';
import AddBarPreview from './add-bar/AddBarPreview';
import AddBarCollections from './add-bar/AddBarCollections';

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

const UniversalAddBar = memo(function UniversalAddBar() {
  const isDesktop = useIsDesktop();
  const inputRef = useRef<HTMLInputElement>(null);

  // Add Bar store
  const {
    isOpen, mode, query, tripContext,
    libraryResults, googleResults, importProgress, importLabel, importResults,
    importSelectedIds,
    previewPlace, selectedCollectionIds,
    close, setQuery, setMode, setLibraryResults, setGoogleResults,
    setImportProgress, setImportResults,
    toggleImportSelected, selectAllImports, deselectAllImports,
    setPreviewPlace, toggleCollection,
  } = useAddBarStore();

  // Saved store
  const myPlaces = useSavedStore(s => s.myPlaces);
  const collections = useSavedStore(s => s.collections);
  const addPlace = useSavedStore(s => s.addPlace);
  const addPlaceToCollection = useSavedStore(s => s.addPlaceToCollection);
  const createCollectionAsync = useSavedStore(s => s.createCollectionAsync);

  // Trip store (for dual-write when in trip context)
  const placeFromSaved = useTripStore(s => s.placeFromSaved);
  const addToPool = useTripStore(s => s.addToPool);

  // Local UI state
  const [saving, setSaving] = useState(false);

  // ─── Auto-focus input when opened ──────────────────────────────────────
  useEffect(() => {
    if (isOpen && mode === 'search') {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen, mode]);

  // ─── Keyboard: Escape to close ─────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mode === 'collections') setMode('preview');
        else if (mode === 'preview') { setImportResults([]); setMode('search'); }
        else close();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, mode, close, setMode]);

  // ─── Search library as user types ──────────────────────────────────────
  useEffect(() => {
    if (mode !== 'search') return;
    const results = searchLibrary(myPlaces, query);
    setLibraryResults(results);
  }, [query, myPlaces, mode, setLibraryResults]);

  // ─── Search Google Places (debounced) ─────────────────────────────────
  useEffect(() => {
    if (mode !== 'search' || query.trim().length < 3) {
      setGoogleResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/places/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query.trim(), multi: true }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setGoogleResults(data);
        }
      } catch { /* network error — silently ignore */ }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, mode, setGoogleResults]);

  // ─── Input detection + action ──────────────────────────────────────────
  const handleInputSubmit = useCallback(async (overrideText?: string) => {
    const trimmed = (overrideText ?? query).trim();
    if (!trimmed) return;

    const inputType = detectInputType(trimmed);
    const isMultiLine = inputType === 'text' && trimmed.split('\n').filter(l => l.trim()).length >= 2;

    if (inputType === 'url' || inputType === 'google-maps' || isMultiLine) {
      setMode('importing');
      setImportProgress(0, isMultiLine ? 'Parsing list...' : 'Starting...');
      try {
        await streamImport(trimmed, {
          onProgress: (percent, label) => setImportProgress(percent, label),
          onResult: (places) => { setImportResults(places); setMode('preview'); },
          onError: () => { setImportResults(DEMO_IMPORT_RESULTS); setMode('preview'); },
        });
      } catch {
        setImportResults(DEMO_IMPORT_RESULTS);
        setMode('preview');
      }
    }
  }, [query, setMode, setImportProgress, setImportResults]);

  // ─── Save a single place ──────────────────────────────────────────────
  const handleSavePlace = useCallback((place: ImportedPlace) => {
    setPreviewPlace(place);
    setMode('collections');
  }, [setPreviewPlace, setMode]);

  // ─── Confirm save (library + optional collections + optional trip) ────
  const confirmSave = useCallback(() => {
    if (!previewPlace) return;
    setSaving(true);

    addPlace(previewPlace);
    selectedCollectionIds.forEach(slId => addPlaceToCollection(slId, previewPlace.id));

    if (tripContext) {
      const trip = useTripStore.getState().trips.find(t => t.id === tripContext.tripId);
      const day = trip?.days.find(d => d.dayNumber === tripContext.dayIndex);
      if (day) {
        const emptySlot = day.slots.find(s => s.places.length === 0);
        if (emptySlot) {
          placeFromSaved(previewPlace, tripContext.dayIndex, emptySlot.id);
        } else {
          addToPool([{ ...previewPlace, status: 'available' as const }]);
        }
      }
    }

    setTimeout(() => {
      setSaving(false);
      setPreviewPlace(null);
      setMode('search');
      setQuery('');
    }, 600);
  }, [previewPlace, selectedCollectionIds, tripContext, addPlace, addPlaceToCollection, placeFromSaved, addToPool, setPreviewPlace, setMode, setQuery]);

  // ─── Save selected import results ────────────────────────────────────
  const handleSaveSelected = useCallback((collectionIds: string[]) => {
    const selected = importResults.filter(p => importSelectedIds.has(p.id));
    selected.forEach(place => addPlace(place));
    collectionIds.forEach(slId => {
      selected.forEach(place => addPlaceToCollection(slId, place.id));
    });
    if (tripContext) {
      addToPool(selected.map(p => ({ ...p, status: 'available' as const })));
    }
    setImportResults([]);
    setMode('search');
    setQuery('');
  }, [importResults, importSelectedIds, tripContext, addPlace, addPlaceToCollection, addToPool, setImportResults, setMode, setQuery]);

  if (!isOpen) return null;

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  const maxW = isDesktop ? 560 : 480;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        style={{
          zIndex: 70,
          background: 'rgba(0,0,0,0.3)',
          opacity: 0,
          animation: 'fadeInBackdrop 200ms ease both',
        }}
        onClick={close}
      />

      {/* Panel */}
      <div
        className="fixed inset-0 flex items-start justify-center"
        style={{ zIndex: 71, pointerEvents: 'none' }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="rounded-2xl overflow-hidden flex flex-col"
          style={{
            pointerEvents: 'auto',
            width: '94vw',
            maxWidth: maxW,
            maxHeight: isDesktop ? '80vh' : '85dvh',
            marginTop: isDesktop ? '10vh' : '6dvh',
            background: 'var(--t-cream)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.16)',
            opacity: 0,
            animation: 'fadeInUp 200ms ease both',
          }}
        >
          {/* ── HEADER ── */}
          <div
            className="flex items-center gap-3 px-5 flex-shrink-0"
            style={{
              height: 56,
              borderBottom: '1px solid var(--t-linen)',
            }}
          >
            {(mode === 'collections' || mode === 'preview') ? (
              <button
                onClick={() => {
                  if (mode === 'collections') setMode('preview');
                  else { setImportResults([]); setMode('search'); }
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t-ink)', padding: 0 }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M11 4L6 9L11 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : null}

            <span style={{
              fontFamily: FONT.serif,
              fontSize: 17,
              fontStyle: 'italic',
              color: 'var(--t-ink)',
              flex: 1,
            }}>
              {mode === 'collections'
                ? 'Add to Collection'
                : mode === 'preview'
                  ? 'Review places'
                  : tripContext
                    ? `Add to Day ${tripContext.dayIndex + 1}`
                    : 'Save a place'}
            </span>

            <button
              onClick={close}
              className="flex items-center justify-center rounded-full"
              style={{
                width: 30, height: 30,
                background: INK['04'],
                border: 'none',
                cursor: 'pointer',
                color: 'var(--t-ink)',
                transition: 'background 150ms ease',
              }}
            >
              <PerriandIcon name="close" size={14} />
            </button>
          </div>

          {/* ── SEARCH INPUT ── */}
          {(mode === 'search' || mode === 'importing') && (
            <div className="px-5 pt-4 pb-2 flex-shrink-0">
              <div
                className="flex items-center gap-2.5 rounded-xl px-3.5"
                style={{
                  height: 44,
                  background: 'white',
                  border: '1.5px solid var(--t-linen)',
                  transition: 'border-color 200ms ease',
                }}
              >
                <PerriandIcon name="discover" size={16} color={INK['40']} />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleInputSubmit();
                    if (e.key === 'Escape') close();
                  }}
                  placeholder={tripContext ? `Search library or Google...` : 'Search or paste a link...'}
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontFamily: FONT.sans,
                    fontSize: 14,
                    color: 'var(--t-ink)',
                  }}
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: INK['30'] }}
                  >
                    <PerriandIcon name="close" size={12} color={INK['30']} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── SCROLLABLE CONTENT ── */}
          <div className="flex-1 overflow-y-auto px-5 pb-5">

            {mode === 'search' && (
              <AddBarSearch
                query={query}
                libraryResults={libraryResults}
                googleResults={googleResults}
                myPlaces={myPlaces}
                collections={collections}
                tripContext={tripContext}
                onSavePlace={handleSavePlace}
                onSearch={handleInputSubmit}
                setQuery={setQuery}
                setLibraryResults={setLibraryResults}
                setMode={setMode}
                inputRef={inputRef}
              />
            )}

            {mode === 'importing' && (
              <AddBarImport
                importProgress={importProgress}
                importLabel={importLabel}
              />
            )}

            {mode === 'preview' && (
              <AddBarPreview
                importResults={importResults}
                selectedIds={importSelectedIds}
                collections={collections}
                tripContext={tripContext}
                onToggleSelect={toggleImportSelected}
                onSelectAll={selectAllImports}
                onDeselectAll={deselectAllImports}
                onSaveSelected={handleSaveSelected}
              />
            )}

            {mode === 'collections' && previewPlace && (
              <AddBarCollections
                previewPlace={previewPlace}
                collections={collections}
                selectedCollectionIds={selectedCollectionIds}
                tripContext={tripContext}
                saving={saving}
                onToggleCollection={toggleCollection}
                onCreateCollection={createCollectionAsync}
                onConfirmSave={confirmSave}
              />
            )}

          </div>
        </div>
      </div>
    </>
  );
});

UniversalAddBar.displayName = 'UniversalAddBar';
export default UniversalAddBar;

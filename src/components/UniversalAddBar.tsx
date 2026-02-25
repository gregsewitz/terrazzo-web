'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAddBarStore } from '@/stores/addBarStore';
import { useSavedStore } from '@/stores/savedStore';
import { useImportStore } from '@/stores/importStore';
import { streamImport } from '@/lib/importService';
import { detectInputType, DEMO_IMPORT_RESULTS } from '@/lib/import-helpers';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import { useTripStore } from '@/stores/tripStore';
import type { ImportedPlace } from '@/types';

// ─── Library search helper ──────────────────────────────────────────────────

function searchLibrary(places: ImportedPlace[], query: string): ImportedPlace[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return places
    .filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.location && p.location.toLowerCase().includes(q)) ||
      p.type.toLowerCase().includes(q)
    )
    .slice(0, 8);
}

function searchLibraryByDestination(places: ImportedPlace[], destination: string): ImportedPlace[] {
  if (!destination) return [];
  const d = destination.toLowerCase();
  return places.filter(p => p.location && p.location.toLowerCase().includes(d)).slice(0, 12);
}

// ─── Recent saves (last 5) ─────────────────────────────────────────────────

function getRecentSaves(places: ImportedPlace[]): ImportedPlace[] {
  return [...places]
    .sort((a, b) => {
      const da = a.savedDate ? new Date(a.savedDate).getTime() : 0;
      const db = b.savedDate ? new Date(b.savedDate).getTime() : 0;
      return db - da;
    })
    .slice(0, 5);
}

// ─── Type badge color ───────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  restaurant: 'var(--t-honey)',
  hotel: 'var(--t-verde)',
  bar: '#C87B6B',
  cafe: '#B8956A',
  museum: '#8B7EC8',
  activity: '#6BA5C8',
  shop: '#C8A56B',
  neighborhood: '#7EC88B',
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function UniversalAddBar() {
  const isDesktop = useIsDesktop();
  const inputRef = useRef<HTMLInputElement>(null);

  // Add Bar store
  const {
    isOpen, mode, query, tripContext,
    libraryResults, googleResults, importProgress, importLabel, importResults,
    previewPlace, selectedCollectionIds,
    close, setQuery, setMode, setLibraryResults, setGoogleResults,
    setImportProgress, setImportResults, setPreviewPlace,
    toggleCollection,
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
  const [showCollectionCreate, setShowCollectionCreate] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [importCollectionIds, setImportCollectionIds] = useState<string[]>([]);

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
        if (mode === 'collections') setMode('search');
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

  // ─── Trip-context: pre-load destination matches ────────────────────────
  const destinationMatches = useMemo(() => {
    if (!tripContext?.destination) return [];
    return searchLibraryByDestination(myPlaces, tripContext.destination);
  }, [tripContext, myPlaces]);

  // ─── Recent saves ─────────────────────────────────────────────────────
  const recentSaves = useMemo(() => getRecentSaves(myPlaces), [myPlaces]);

  // ─── Trip context: collections with destination-matching places ──────
  const tripCollections = useMemo(() => {
    if (!tripContext?.destination) return [];
    const dest = tripContext.destination.toLowerCase();
    return collections
      .map(sl => {
        const matchingPlaces = sl.placeIds
          .map(id => myPlaces.find(p => p.id === id))
          .filter((p): p is ImportedPlace => !!p && p.location.toLowerCase().includes(dest));
        return { ...sl, matchingPlaces, matchCount: matchingPlaces.length };
      })
      .filter(sl => sl.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount);
  }, [tripContext, collections, myPlaces]);

  // ─── Input detection + action ──────────────────────────────────────────
  const handleInputSubmit = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    const inputType = detectInputType(trimmed);

    const isMultiLine = inputType === 'text' && trimmed.split('\n').filter(l => l.trim()).length >= 2;

    if (inputType === 'url' || inputType === 'google-maps' || isMultiLine) {
      // URL or multi-line text: trigger inline import
      setMode('importing');
      setImportProgress(0, isMultiLine ? 'Parsing list...' : 'Starting...');
      try {
        await streamImport(trimmed, {
          onProgress: (percent, label) => {
            setImportProgress(percent, label);
          },
          onResult: (places) => {
            setImportResults(places);
            setMode('preview');
          },
          onError: () => {
            setImportResults(DEMO_IMPORT_RESULTS);
            setMode('preview');
          },
        });
      } catch {
        setImportResults(DEMO_IMPORT_RESULTS);
        setMode('preview');
      }
    }
    // For single-line text search: library results already shown via useEffect
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

    // Save to library
    addPlace(previewPlace);

    // Add to selected collections
    selectedCollectionIds.forEach(slId => {
      addPlaceToCollection(slId, previewPlace.id);
    });

    // Dual-write: if opened from trip context, also place on trip day
    if (tripContext) {
      // Find the first available slot on the target day
      const trip = useTripStore.getState().trips.find(t => t.id === tripContext.tripId);
      const day = trip?.days.find(d => d.dayNumber === tripContext.dayIndex);
      if (day) {
        const emptySlot = day.slots.find(s => s.places.length === 0);
        if (emptySlot) {
          placeFromSaved(previewPlace, tripContext.dayIndex, emptySlot.id);
        } else {
          // No empty slot — add to trip pool instead
          addToPool([{ ...previewPlace, status: 'available' as const }]);
        }
      }
    }

    setTimeout(() => {
      setSaving(false);
      // Reset to search mode for next add
      setPreviewPlace(null);
      setMode('search');
      setQuery('');
    }, 600);
  }, [previewPlace, selectedCollectionIds, tripContext, addPlace, addPlaceToCollection, placeFromSaved, addToPool, setPreviewPlace, setMode, setQuery]);

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
            {mode === 'collections' ? (
              <button
                onClick={() => setMode('search')}
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
              {mode === 'collections' ? 'Add to Collection' : tripContext ? `Add to Day ${tripContext.dayIndex + 1}` : 'Save a place'}
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

            {/* ════ MODE: SEARCH (default) ════ */}
            {mode === 'search' && (
              <>
                {/* Typing: show library results first, then Google hint */}
                {query.trim().length > 0 && (
                  <>
                    {libraryResults.length > 0 && (
                      <SectionHeader label="In your library" />
                    )}
                    {libraryResults.map(place => (
                      <PlaceRow
                        key={place.id}
                        place={place}
                        inLibrary
                        collections={collections.filter(sl => sl.placeIds.includes(place.id))}
                        onTap={() => handleSavePlace(place)}
                      />
                    ))}

                    {/* Google results */}
                    <SectionHeader label="From Google" />
                    {googleResults.length > 0 ? (
                      googleResults.map(result => (
                        <PlaceRow
                          key={result.placeId}
                          place={{
                            id: `google-${result.placeId}`,
                            name: result.name,
                            type: result.type || 'activity',
                            location: result.address || '',
                            source: { type: 'google-maps', name: 'Google Places' },
                            matchScore: 0,
                            matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0 },
                            tasteNote: '',
                            status: 'available',
                            google: {
                              placeId: result.placeId,
                              address: result.address,
                              lat: result.lat,
                              lng: result.lng,
                              photoUrl: result.photoUrl,
                            },
                          } as ImportedPlace}
                          onTap={() => handleSavePlace({
                            id: `google-${result.placeId}`,
                            name: result.name,
                            type: result.type || 'activity',
                            location: result.address || '',
                            source: { type: 'google-maps', name: 'Google Places' },
                            matchScore: 0,
                            matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0 },
                            tasteNote: '',
                            status: 'available',
                            google: {
                              placeId: result.placeId,
                              address: result.address,
                              lat: result.lat,
                              lng: result.lng,
                              photoUrl: result.photoUrl,
                            },
                          } as ImportedPlace)}
                          action="save"
                        />
                      ))
                    ) : (
                      <button
                        onClick={handleInputSubmit}
                        className="flex items-center gap-2.5 w-full px-3 py-3 rounded-xl cursor-pointer transition-all"
                        style={{
                          background: 'white',
                          border: '1px solid var(--t-linen)',
                          textAlign: 'left',
                        }}
                      >
                        <PerriandIcon name="add" size={14} color="var(--t-verde)" />
                        <span style={{ fontFamily: FONT.sans, fontSize: 13, color: 'var(--t-ink)' }}>
                          Search Google for &ldquo;{query}&rdquo;
                        </span>
                      </button>
                    )}
                  </>
                )}

                {/* Empty state: trip-context or global */}
                {query.trim().length === 0 && (
                  <>
                    {tripContext ? (
                      /* ════ TRIP CONTEXT empty state ════ */
                      <>
                        {/* Collections with destination places */}
                        {tripCollections.length > 0 && (
                          <>
                            <SectionHeader label={`Collections with ${tripContext.destination || ''} places`} />
                            <div className="flex flex-col gap-1.5 mb-2">
                              {tripCollections.map(sl => (
                                <button
                                  key={sl.id}
                                  onClick={() => {
                                    // Show the matching places from this collection
                                    setLibraryResults(sl.matchingPlaces);
                                    setMode('search');
                                  }}
                                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl cursor-pointer transition-all text-left"
                                  style={{
                                    background: 'white',
                                    border: '1px solid var(--t-linen)',
                                  }}
                                >
                                  <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{sl.emoji}</span>
                                  <div className="flex-1 min-w-0">
                                    <p style={{ fontFamily: FONT.sans, fontSize: 13, fontWeight: 600, color: 'var(--t-ink)', margin: 0 }}>
                                      {sl.name}
                                    </p>
                                    <p style={{ fontFamily: FONT.mono, fontSize: 9, color: 'var(--t-verde)', margin: '1px 0 0' }}>
                                      {sl.matchCount} {sl.matchCount === 1 ? 'place' : 'places'} in {tripContext.destination}
                                    </p>
                                  </div>
                                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: 0.3 }}>
                                    <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                              ))}
                            </div>
                          </>
                        )}

                        {/* Destination matches from library */}
                        {destinationMatches.length > 0 && (
                          <>
                            <SectionHeader label={`All ${tripContext.destination || ''} places in Library`} />
                            {destinationMatches.slice(0, 6).map(place => (
                              <PlaceRow
                                key={place.id}
                                place={place}
                                inLibrary
                                collections={collections.filter(sl => sl.placeIds.includes(place.id))}
                                onTap={() => handleSavePlace(place)}
                              />
                            ))}
                            {destinationMatches.length > 6 && (
                              <p style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['40'], textAlign: 'center', margin: '8px 0 0' }}>
                                + {destinationMatches.length - 6} more — type to search
                              </p>
                            )}
                          </>
                        )}

                        {/* "Don't have what you need?" fallback */}
                        <div
                          className="mt-4 p-4 rounded-xl"
                          style={{
                            background: 'rgba(200,146,58,0.05)',
                            border: '1px solid rgba(200,146,58,0.12)',
                          }}
                        >
                          <p style={{ fontFamily: FONT.sans, fontSize: 13, fontWeight: 600, color: 'var(--t-ink)', margin: '0 0 8px' }}>
                            Don&apos;t have what you need?
                          </p>
                          <div className="flex flex-col gap-1.5">
                            <QuickAction
                              icon="discover"
                              label={`Search Google for ${tripContext.destination || ''} places`}
                              onTap={() => {
                                setQuery(tripContext.destination || '');
                                setTimeout(() => inputRef.current?.focus(), 50);
                              }}
                            />
                            <QuickAction
                              icon="article"
                              label="Paste a link or list"
                              onTap={async () => {
                                try {
                                  const text = await navigator.clipboard.readText();
                                  if (text) {
                                    setQuery(text);
                                    if (text.split('\n').filter(l => l.trim()).length >= 2) {
                                      setTimeout(() => handleInputSubmit(), 50);
                                    }
                                  }
                                } catch { /* clipboard permission denied */ }
                              }}
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      /* ════ GLOBAL (non-trip) empty state ════ */
                      <>
                        {/* Quick actions */}
                        <SectionHeader label="Quick actions" />
                        <div className="flex flex-col gap-1">
                          <QuickAction
                            icon="article"
                            label="Paste from clipboard"
                            onTap={async () => {
                              try {
                                const text = await navigator.clipboard.readText();
                                if (text) { setQuery(text); }
                              } catch { /* clipboard permission denied */ }
                            }}
                          />
                          <QuickAction
                            icon="email"
                            label="Import from email"
                            onTap={() => {
                              close();
                              useImportStore.getState().patch({ isOpen: true });
                            }}
                          />
                          <QuickAction
                            icon="article"
                            label="Paste a list"
                            onTap={async () => {
                              try {
                                const text = await navigator.clipboard.readText();
                                if (text && text.split('\n').filter(l => l.trim()).length >= 2) {
                                  setQuery(text);
                                  setTimeout(() => handleInputSubmit(), 50);
                                } else if (text) {
                                  setQuery(text);
                                }
                              } catch { /* clipboard permission denied */ }
                            }}
                          />
                        </div>

                        {/* Recent saves */}
                        {recentSaves.length > 0 && (
                          <>
                            <SectionHeader label="Recent saves" />
                            {recentSaves.map(place => (
                              <PlaceRow
                                key={place.id}
                                place={place}
                                inLibrary
                                collections={collections.filter(sl => sl.placeIds.includes(place.id))}
                                onTap={() => handleSavePlace(place)}
                                compact
                              />
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {/* ════ MODE: IMPORTING (inline URL import) ════ */}
            {mode === 'importing' && (
              <div className="py-6">
                <SectionHeader label="Importing" />
                <div className="flex items-center gap-3 py-4">
                  <div
                    className="flex items-center justify-center rounded-full"
                    style={{
                      width: 36, height: 36,
                      background: 'var(--t-linen)',
                      position: 'relative',
                    }}
                  >
                    <svg width="36" height="36" viewBox="0 0 36 36" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
                      <circle cx="18" cy="18" r="14" fill="none" stroke="var(--t-travertine)" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="14" fill="none"
                        stroke="var(--t-honey)" strokeWidth="3"
                        strokeDasharray={`${(importProgress / 100) * 87.96} 87.96`}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dasharray 0.3s ease' }}
                      />
                    </svg>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--t-ink)', position: 'relative', zIndex: 1 }}>
                      {Math.round(importProgress)}%
                    </span>
                  </div>
                  <div>
                    <p style={{ fontFamily: FONT.sans, fontSize: 13, fontWeight: 600, color: 'var(--t-ink)', margin: 0 }}>
                      Extracting places from link...
                    </p>
                    <p style={{ fontFamily: FONT.sans, fontSize: 11, color: INK['60'], margin: '2px 0 0' }}>
                      {importLabel || 'Working...'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ════ MODE: PREVIEW (import results) ════ */}
            {mode === 'preview' && importResults.length > 0 && (
              <>
                <SectionHeader label={`Found ${importResults.length} place${importResults.length === 1 ? '' : 's'}`} />
                {importResults.map(place => (
                  <PlaceRow
                    key={place.id}
                    place={place}
                    matchScore={place.matchScore}
                    onTap={() => handleSavePlace(place)}
                    action="save"
                  />
                ))}
                {/* Optional collection picker for batch save */}
                {collections.length > 0 && (
                  <div className="pt-3 mb-2 p-3 rounded-xl" style={{ background: INK['02'] }}>
                    <p style={{
                      fontFamily: FONT.mono, fontSize: 10, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      color: INK['40'], margin: '0 0 6px',
                    }}>
                      Also add to collections
                    </p>
                    <div className="flex flex-col gap-1">
                      {collections.map(sl => {
                        const isSelected = importCollectionIds.includes(sl.id);
                        return (
                          <button
                            key={sl.id}
                            onClick={() => setImportCollectionIds(prev =>
                              isSelected ? prev.filter(id => id !== sl.id) : [...prev, sl.id]
                            )}
                            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all text-left"
                            style={{
                              background: isSelected ? 'rgba(42,122,86,0.08)' : 'transparent',
                              border: isSelected ? '1px solid var(--t-verde)' : '1px solid transparent',
                            }}
                          >
                            <div
                              className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                              style={{ background: isSelected ? 'var(--t-verde)' : INK['08'] }}
                            >
                              {isSelected && <span style={{ color: 'white', fontSize: 9, fontWeight: 700 }}>&#10003;</span>}
                            </div>
                            <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{sl.emoji}</span>
                            <span style={{ fontFamily: FONT.sans, fontSize: 12, color: 'var(--t-ink)' }}>
                              {sl.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="pt-2">
                  <button
                    onClick={() => {
                      importResults.forEach(place => addPlace(place));
                      importCollectionIds.forEach(slId => {
                        importResults.forEach(place => addPlaceToCollection(slId, place.id));
                      });
                      // Dual-write: if in trip context, add all to trip pool
                      if (tripContext) {
                        addToPool(importResults.map(p => ({ ...p, status: 'available' as const })));
                      }
                      setImportResults([]);
                      setImportCollectionIds([]);
                      setMode('search');
                      setQuery('');
                    }}
                    className="w-full py-3 rounded-xl cursor-pointer transition-all"
                    style={{
                      background: 'var(--t-ink)',
                      color: 'white',
                      border: 'none',
                      fontFamily: FONT.sans,
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    Save all {importResults.length} to Library
                    {tripContext && ' + Trip'}
                    {importCollectionIds.length > 0 && ` + ${importCollectionIds.length} collection${importCollectionIds.length > 1 ? 's' : ''}`}
                  </button>
                </div>
              </>
            )}

            {/* ════ MODE: COLLECTIONS (post-save tagging) ════ */}
            {mode === 'collections' && previewPlace && (
              <>
                {/* Place card with photo + AI blurb */}
                <div
                  className="rounded-xl mt-3 mb-4 overflow-hidden"
                  style={{ background: 'white', border: '1px solid var(--t-linen)' }}
                >
                  {previewPlace.google?.photoUrl && (
                    <img
                      src={previewPlace.google.photoUrl}
                      alt={previewPlace.name}
                      style={{
                        width: '100%',
                        height: 140,
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  )}
                  <div className="px-4 py-3">
                    <p style={{ fontFamily: FONT.sans, fontSize: 14, fontWeight: 600, color: 'var(--t-ink)', margin: 0 }}>
                      {previewPlace.name}
                    </p>
                    <p style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['50'], margin: '3px 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {previewPlace.type}{previewPlace.location ? ` \u00B7 ${previewPlace.location}` : ''}
                    </p>
                    {previewPlace.matchScore ? (
                      <p style={{ fontFamily: FONT.mono, fontSize: 10, color: 'var(--t-verde)', margin: '3px 0 0' }}>
                        {previewPlace.matchScore}% taste match
                      </p>
                    ) : null}
                    {previewPlace.tasteNote && (
                      <p style={{
                        fontFamily: FONT.sans,
                        fontSize: 12,
                        fontStyle: 'italic',
                        color: INK['60'],
                        margin: '6px 0 0',
                        lineHeight: 1.4,
                      }}>
                        &ldquo;{previewPlace.tasteNote}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                <SectionHeader label="Add to collections" />
                <div className="flex flex-col gap-1.5 mb-2">
                  {collections.map(sl => {
                    const isIn = selectedCollectionIds.includes(sl.id);
                    return (
                      <button
                        key={sl.id}
                        onClick={() => toggleCollection(sl.id)}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all cursor-pointer w-full text-left"
                        style={{
                          background: isIn ? 'rgba(42,122,86,0.04)' : 'white',
                          border: isIn ? '1.5px solid var(--t-verde)' : '1px solid var(--t-linen)',
                        }}
                      >
                        <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{sl.emoji}</span>
                        <div className="flex-1 text-left">
                          <span style={{ fontFamily: FONT.sans, fontSize: 13, color: 'var(--t-ink)' }}>
                            {sl.name}
                          </span>
                          <span className="ml-2" style={{ fontFamily: FONT.mono, fontSize: 10, color: INK['50'] }}>
                            {sl.placeIds.length}
                          </span>
                        </div>
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: isIn ? 'var(--t-verde)' : INK['06'] }}
                        >
                          {isIn && <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>&#10003;</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Inline create new collection */}
                <div className="mb-4">
                  {showCollectionCreate ? (
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Collection name..."
                        value={newCollectionName}
                        onChange={(e) => setNewCollectionName(e.target.value)}
                        autoFocus
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && newCollectionName.trim()) {
                            const newId = await createCollectionAsync(newCollectionName.trim(), '📌');
                            toggleCollection(newId);
                            setNewCollectionName('');
                            setShowCollectionCreate(false);
                          }
                        }}
                        className="flex-1 min-w-0 rounded-lg py-2 px-3"
                        style={{
                          background: 'white',
                          border: '1px solid var(--t-linen)',
                          color: 'var(--t-ink)',
                          fontFamily: FONT.sans,
                          fontSize: 12,
                          outline: 'none',
                        }}
                      />
                      <button
                        onClick={async () => {
                          if (!newCollectionName.trim()) return;
                          const newId = await createCollectionAsync(newCollectionName.trim(), '📌');
                          toggleCollection(newId);
                          setNewCollectionName('');
                          setShowCollectionCreate(false);
                        }}
                        disabled={!newCollectionName.trim()}
                        className="px-3 py-2 rounded-lg cursor-pointer"
                        style={{
                          background: newCollectionName.trim() ? 'var(--t-ink)' : INK['10'],
                          color: newCollectionName.trim() ? 'white' : INK['30'],
                          border: 'none',
                          fontFamily: FONT.sans,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowCollectionCreate(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl cursor-pointer transition-all"
                      style={{
                        background: 'none',
                        border: `1.5px dashed ${INK['12']}`,
                        color: INK['50'],
                        fontFamily: FONT.sans,
                        fontSize: 12,
                      }}
                    >
                      <PerriandIcon name="add" size={12} color={INK['40']} />
                      New Collection
                    </button>
                  )}
                </div>

                {/* Save CTA */}
                <button
                  onClick={confirmSave}
                  disabled={saving}
                  className="w-full py-3.5 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: saving ? 'var(--t-verde)' : 'var(--t-ink)',
                    color: 'white',
                    border: 'none',
                    fontFamily: FONT.sans,
                    fontSize: 14,
                    fontWeight: 600,
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Saved' : tripContext
                    ? `Save to Library + Day ${tripContext.dayIndex + 1}`
                    : selectedCollectionIds.length > 0
                      ? `Save to Library + ${selectedCollectionIds.length} collection${selectedCollectionIds.length > 1 ? 's' : ''}`
                      : 'Save to Library'
                  }
                </button>
                <p style={{
                  fontFamily: FONT.sans,
                  fontSize: 11,
                  color: INK['40'],
                  textAlign: 'center',
                  marginTop: 6,
                }}>
                  {tripContext
                    ? 'Saved to Library and added to your trip'
                    : 'Collections are optional — you can organize later'}
                </p>
              </>
            )}

          </div>
        </div>
      </div>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═════════════════════════════════════════════════════════════════════════════

function SectionHeader({ label }: { label: string }) {
  return (
    <p
      className="pt-4 pb-1.5"
      style={{
        fontFamily: FONT.mono,
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: INK['40'],
        margin: 0,
      }}
    >
      {label}
    </p>
  );
}

function QuickAction({ icon, label, onTap }: { icon: PerriandIconName; label: string; onTap: () => void }) {
  return (
    <button
      onClick={onTap}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl cursor-pointer transition-all"
      style={{
        background: 'white',
        border: '1px solid var(--t-linen)',
        textAlign: 'left',
      }}
    >
      <PerriandIcon name={icon} size={15} color={INK['50']} />
      <span style={{ fontFamily: FONT.sans, fontSize: 13, color: 'var(--t-ink)' }}>
        {label}
      </span>
    </button>
  );
}

function PlaceRow({
  place,
  inLibrary,
  matchScore,
  collections,
  onTap,
  action,
  compact,
}: {
  place: ImportedPlace;
  inLibrary?: boolean;
  matchScore?: number;
  collections?: Array<{ name: string }>;
  onTap: () => void;
  action?: 'save';
  compact?: boolean;
}) {
  const typeColor = TYPE_COLORS[place.type] || INK['40'];

  return (
    <button
      onClick={onTap}
      className="flex items-center gap-3 w-full px-3 rounded-xl cursor-pointer transition-all text-left"
      style={{
        background: 'white',
        border: '1px solid var(--t-linen)',
        padding: compact ? '8px 12px' : '10px 12px',
        marginTop: 4,
      }}
    >
      {/* Type dot */}
      <div
        className="rounded-full flex-shrink-0"
        style={{ width: 8, height: 8, background: typeColor }}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p style={{
          fontFamily: FONT.sans,
          fontSize: compact ? 12 : 13,
          fontWeight: 600,
          color: 'var(--t-ink)',
          margin: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {inLibrary && <span style={{ color: 'var(--t-verde)', marginRight: 4, fontSize: 11 }}>&#10003;</span>}
          {place.name}
        </p>
        <p style={{
          fontFamily: FONT.mono,
          fontSize: 9,
          color: INK['50'],
          margin: '1px 0 0',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {place.type}
          {place.location ? ` \u00B7 ${place.location}` : ''}
          {(matchScore ?? place.matchScore) ? ` \u00B7 ${matchScore ?? place.matchScore}%` : ''}
        </p>
        {collections && collections.length > 0 && (
          <p style={{
            fontFamily: FONT.sans,
            fontSize: 10,
            color: INK['40'],
            margin: '2px 0 0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            in: {collections.map(c => c.name).join(', ')}
          </p>
        )}
      </div>

      {/* Action */}
      {action === 'save' ? (
        <div
          className="flex items-center justify-center rounded-full flex-shrink-0"
          style={{ width: 28, height: 28, background: INK['06'] }}
        >
          <PerriandIcon name="add" size={14} color="var(--t-verde)" />
        </div>
      ) : (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: 0.3 }}>
          <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

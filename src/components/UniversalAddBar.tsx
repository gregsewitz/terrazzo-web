'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useAddBarStore } from '@/stores/addBarStore';
import { useSavedStore } from '@/stores/savedStore';
import { streamImport, streamMapsImport, streamFileImport } from '@/lib/importService';
import { detectInput, extractPlaceIdFromMapsUrl, getPlatformLabel } from '@/lib/import-helpers';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import { useTripStore } from '@/stores/tripStore';
import type { ImportedPlace } from '@/types';

// Sub-components (extracted from this file)
import { searchLibrary } from './add-bar/AddBarShared';
import AddBarSearch from './add-bar/AddBarSearch';
import AddBarImport from './add-bar/AddBarImport';
import AddBarPreview from './add-bar/AddBarPreview';
import AddBarCollections, { AddBarCollectionsCTA } from './add-bar/AddBarCollections';

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
    importSelectedIds, importError,
    previewPlace, selectedCollectionIds,
    close, setQuery, setMode, setLibraryResults, setGoogleResults,
    setImportProgress, setImportResults, setImportError, isEnriching, setIsEnriching,
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
  const [isDragging, setIsDragging] = useState(false);

  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track client IDs saved during enrichment so onResult can back-fill
  const savedDuringEnrichRef = useRef<Map<string, string>>(new Map()); // clientId → name

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
        else if (mode === 'error') setMode('search');
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

  // ─── File upload handler ──────────────────────────────────────────────
  const handleFileUpload = useCallback(async (file: File) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'application/pdf', 'text/csv', 'text/plain', 'text/html'];
    if (!allowed.some(t => file.type.startsWith(t.split('/')[0]) || file.type === t) && !file.name.match(/\.(png|jpe?g|webp|heic|pdf|csv|txt|html?)$/i)) {
      setImportError('Unsupported file type. Try an image, PDF, CSV, or text file.');
      setMode('error');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setImportError('File is too large (max 20 MB).');
      setMode('error');
      return;
    }

    setMode('importing');
    const isImage = file.type.startsWith('image/') || file.name.match(/\.(png|jpe?g|webp|heic)$/i);
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    setImportProgress(0,
      isImage ? 'Looking at your screenshot…'
        : isPdf ? 'Reading the PDF…'
        : 'Reading the file…'
    );

    try {
      await streamFileImport(file, {
        onProgress: (percent: number, label: string) => setImportProgress(percent, label),
        onResult: (places: ImportedPlace[]) => { setImportResults(places); setMode('preview'); },
        onError: (err: string) => {
          setImportError(err || 'Could not extract places from this file');
          setMode('error');
        },
      });
    } catch {
      setImportError('Something went wrong — please try again');
      setMode('error');
    }
  }, [setMode, setImportProgress, setImportResults, setImportError]);

  // ─── Input detection + smart routing ───────────────────────────────────
  //
  // The UAB is the single entry point for all import types.
  // detectInput() classifies the input with rich metadata, then we route
  // to the correct streaming endpoint:
  //
  //   'google-maps-list'  → streamMapsImport()  → /api/import/maps-list
  //   'google-maps-place' → streamImport()       → /api/import/place (direct resolve)
  //   'url'               → streamImport()       → /api/import
  //   'text' (multi)      → streamImport()       → /api/import
  //
  const handleInputSubmit = useCallback(async (overrideText?: string) => {
    const trimmed = (overrideText ?? query).trim();
    if (!trimmed) return;

    const detected = detectInput(trimmed);
    const { type: inputType, platform } = detected;
    const isMultiLine = inputType === 'text' && trimmed.split('\n').filter(l => l.trim()).length >= 2;

    // Only proceed for importable input (URLs, maps links, multi-line lists)
    if (inputType !== 'url' && inputType !== 'google-maps-list' && inputType !== 'google-maps-place' && !isMultiLine) return;

    setMode('importing');
    const platformLabel = getPlatformLabel(platform);
    setImportProgress(0,
      inputType === 'google-maps-list' ? 'Opening your saved list…'
        : inputType === 'google-maps-place' ? 'Looking up this place…'
        : isMultiLine ? 'Reading your list…'
        : platform && platform !== 'generic' ? `Reading from ${platformLabel}…`
        : 'Getting started…'
    );

    try {
      if (inputType === 'google-maps-place') {
        // Single Google Maps place → extract name/coords and resolve via standard import
        const placeInfo = extractPlaceIdFromMapsUrl(detected.cleanedInput);
        // If we can extract the place name, send it as a text query to the import endpoint
        // which will use Claude to parse + Google Places to resolve
        const importContent = placeInfo?.placeName || detected.cleanedInput;
        await streamImport(importContent, {
          onProgress: (percent: number, label: string) => setImportProgress(percent, label),
          onResult: (places: ImportedPlace[]) => { setImportResults(places); setMode('preview'); },
          onError: (err: string) => {
            setImportError(err || 'Could not resolve this Google Maps place');
            setMode('error');
          },
        });
      } else if (inputType === 'google-maps-list') {
        // Google Maps saved lists → dedicated fast endpoint with lazy enrichment
        setIsEnriching(true);
        savedDuringEnrichRef.current = new Map();
        await streamMapsImport(trimmed, {
          onProgress: (percent: number, label: string) => setImportProgress(percent, label),
          onPreview: (places: ImportedPlace[]) => {
            // Show basic results immediately while enrichment continues
            setImportResults(places);
            setMode('preview');
          },
          onResult: (places: ImportedPlace[]) => {
            setIsEnriching(false);
            const savedMap = savedDuringEnrichRef.current;

            if (savedMap.size > 0) {
              // User already saved during preview — back-fill enriched data
              // into the store (match by name) and update DB records
              const currentPlaces = useSavedStore.getState().myPlaces;
              const patches: Partial<ImportedPlace>[] = [];
              const dbUpdates: Array<{ name: string; location?: string; enriched: Partial<ImportedPlace> }> = [];

              for (const enriched of places) {
                if (!savedMap.has(enriched.id)) continue;
                // Find in store by name (ID may have been swapped to server ID)
                const match = currentPlaces.find(
                  p => p.name === enriched.name && (p.location === enriched.location || !p.location)
                );
                if (match) {
                  const patch: Partial<ImportedPlace> = {
                    id: match.id,
                    type: enriched.type,
                    google: enriched.google,
                    matchScore: enriched.matchScore,
                    matchBreakdown: enriched.matchBreakdown,
                    tasteNote: enriched.tasteNote,
                    terrazzoInsight: enriched.terrazzoInsight,
                    enrichment: enriched.enrichment,
                    whatToOrder: enriched.whatToOrder,
                    tips: enriched.tips,
                    alsoKnownAs: enriched.alsoKnownAs,
                  };
                  patches.push(patch);
                  dbUpdates.push({
                    name: enriched.name,
                    location: enriched.location,
                    enriched: patch,
                  });
                }
              }

              if (patches.length > 0) {
                useSavedStore.getState().patchPlaces(patches);
                // Fire-and-forget DB back-fill
                fetch('/api/places/backfill-enrichment', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ updates: dbUpdates }),
                }).catch((err: unknown) => console.warn('[UniversalAddBar] action failed:', err));
              }

              savedDuringEnrichRef.current = new Map();
            } else {
              // User hasn't saved yet — just replace preview with enriched results
              setImportResults(places);
              setMode('preview');
            }
          },
          onError: (err: string) => {
            setIsEnriching(false);
            setImportError(err || 'Could not load places from this Google Maps link');
            setMode('error');
          },
        });
        // Safety: if stream completes without onResult (e.g. network glitch), unlock save
        setIsEnriching(false);
      } else {
        // Article URLs, text lists → general import pipeline
        await streamImport(trimmed, {
          onProgress: (percent: number, label: string) => setImportProgress(percent, label),
          onResult: (places: ImportedPlace[]) => { setImportResults(places); setMode('preview'); },
          onError: (err: string) => {
            setImportError(err || 'Could not extract places from this link');
            setMode('error');
          },
        });
      }
    } catch {
      setImportError('Something went wrong — please try again');
      setMode('error');
    }
  }, [query, setMode, setImportProgress, setImportResults, setImportError, setIsEnriching]);

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

    // If enrichment is still running, record which client IDs were saved
    // so onResult can back-fill enriched data into these places later.
    if (isEnriching) {
      selected.forEach(p => savedDuringEnrichRef.current.set(p.id, p.name));
    }

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
  }, [importResults, importSelectedIds, isEnriching, tripContext, addPlace, addPlaceToCollection, addToPool, setImportResults, setMode, setQuery]);

  if (!isOpen) return null;

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  const maxW = isDesktop ? 640 : 520;

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
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer?.files?.[0];
            if (file) handleFileUpload(file);
          }}
          className="rounded-2xl overflow-hidden flex flex-col relative"
          style={{
            pointerEvents: 'auto',
            width: '94vw',
            maxWidth: maxW,
            maxHeight: isDesktop ? '85vh' : '90dvh',
            marginTop: isDesktop ? '7vh' : '4dvh',
            background: 'var(--t-cream)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.16)',
            opacity: 0,
            animation: 'fadeInUp 200ms ease both',
            ...(isDragging ? { outline: '2px dashed var(--t-sage)', outlineOffset: -2 } : {}),
          }}
        >
          {/* ── DROP ZONE OVERLAY ── */}
          {isDragging && (
            <div
              className="absolute inset-0 flex items-center justify-center rounded-2xl"
              style={{
                zIndex: 100,
                background: 'rgba(255,255,255,0.92)',
                pointerEvents: 'none',
              }}
            >
              <div className="text-center">
                <svg width="32" height="32" viewBox="0 0 16 16" fill="none" style={{ margin: '0 auto 8px' }}>
                  <path d="M8 2v8M4 6l4-4 4 4" stroke="var(--t-sage)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="var(--t-sage)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p style={{ fontFamily: FONT.sans, fontSize: 14, fontWeight: 600, color: TEXT.primary, margin: 0 }}>
                  Drop to import
                </p>
                <p style={{ fontFamily: FONT.sans, fontSize: 12, color: TEXT.secondary, margin: '4px 0 0' }}>
                  Screenshots, PDFs, or text files
                </p>
              </div>
            </div>
          )}

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
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEXT.primary, padding: 0 }}
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
              color: TEXT.primary,
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
                color: TEXT.primary,
                transition: 'background 150ms ease',
              }}
            >
              <PerriandIcon name="close" size={14} />
            </button>
          </div>

          {/* ── SEARCH INPUT ── */}
          {(mode === 'search' || mode === 'importing' || mode === 'error') && (
            <div className="px-5 pt-4 pb-2 flex-shrink-0">
              <div
                className="flex items-center gap-2.5 rounded-xl px-3.5"
                style={{
                  height: 44,
                  background: 'white',
                  border: '1.5px solid var(--t-navy)',
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
                  onPaste={(e) => {
                    // Handle pasted files (e.g. screenshots from clipboard)
                    const items = e.clipboardData?.items;
                    if (items) {
                      for (const item of Array.from(items)) {
                        if (item.kind === 'file') {
                          e.preventDefault();
                          const file = item.getAsFile();
                          if (file) handleFileUpload(file);
                          return;
                        }
                      }
                    }
                  }}
                  placeholder={tripContext ? `Search library or Google...` : 'Search, paste a link, or drop a file...'}
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontFamily: FONT.sans,
                    fontSize: 14,
                    color: TEXT.primary,
                  }}
                />
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.csv,.txt,.html"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                    e.target.value = ''; // reset so same file can be re-selected
                  }}
                />
                {/* Upload button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload a screenshot, PDF, or file"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px',
                    color: TEXT.secondary,
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'color 150ms ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = TEXT.primary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = INK['30'])}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2v8M4 6l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {/* Submit arrow — shows when input looks importable (URL or multi-line) */}
                {query && (() => {
                  const d = detectInput(query.trim());
                  const isImportable = d.type === 'url' || d.type === 'google-maps-list' || d.type === 'google-maps-place'
                    || (d.type === 'text' && query.trim().split('\n').filter((l: string) => l.trim()).length >= 2);
                  return isImportable ? (
                    <button
                      onClick={() => handleInputSubmit()}
                      title="Import places from this link"
                      style={{
                        background: TEXT.primary,
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'opacity 150ms ease',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2.5 7h9M8 3.5L11.5 7 8 10.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ) : null;
                })()}
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: TEXT.secondary }}
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

            {mode === 'error' && (
              <div className="py-6 text-center">
                <div
                  className="flex items-center justify-center mx-auto mb-3 rounded-full"
                  style={{ width: 40, height: 40, background: 'var(--t-linen)' }}
                >
                  <PerriandIcon name="close" size={16} color={INK['40']} />
                </div>
                <p style={{
                  fontFamily: FONT.sans, fontSize: 14, fontWeight: 600,
                  color: TEXT.primary, margin: '0 0 4px',
                }}>
                  Import failed
                </p>
                <p style={{
                  fontFamily: FONT.sans, fontSize: 13,
                  color: TEXT.secondary, margin: '0 0 16px',
                  lineHeight: 1.4, maxWidth: 320, marginInline: 'auto',
                }}>
                  {importError || 'Something went wrong'}
                </p>
                <button
                  onClick={() => { setMode('search'); inputRef.current?.focus(); }}
                  className="rounded-lg px-4 py-2"
                  style={{
                    fontFamily: FONT.sans, fontSize: 13, fontWeight: 600,
                    background: TEXT.primary, color: 'white',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  Try again
                </button>
              </div>
            )}

            {mode === 'preview' && (
              <AddBarPreview
                importResults={importResults}
                selectedIds={importSelectedIds}
                collections={collections}
                tripContext={tripContext}
                isEnriching={isEnriching}
                onToggleSelect={toggleImportSelected}
                onSelectAll={selectAllImports}
                onDeselectAll={deselectAllImports}
                onSaveSelected={handleSaveSelected}
                onCreateCollection={createCollectionAsync}
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

          {/* ── STICKY SAVE CTA (collections mode) ── */}
          {mode === 'collections' && previewPlace && (
            <AddBarCollectionsCTA
              saving={saving}
              tripContext={tripContext}
              selectedCollectionIds={selectedCollectionIds}
              onConfirmSave={confirmSave}
            />
          )}
        </div>
      </div>
    </>
  );
});

UniversalAddBar.displayName = 'UniversalAddBar';
export default UniversalAddBar;

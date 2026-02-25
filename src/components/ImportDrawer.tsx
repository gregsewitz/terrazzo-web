'use client';

import { useState, useMemo, useEffect } from 'react';
import { useImportStore } from '@/stores/importStore';
import { useSavedStore } from '@/stores/savedStore';
import { streamImport, streamMapsImport } from '@/lib/importService';
import { ImportedPlace } from '@/types';
import { FONT, INK } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import { detectInputType, DEMO_IMPORT_RESULTS } from '@/lib/import-helpers';
import { ImportInputStep } from '@/components/import/ImportInputStep';
import { ImportProcessingStep } from '@/components/import/ImportProcessingStep';
import { ImportResultsStep } from '@/components/import/ImportResultsStep';
import { ImportSuccessStep } from '@/components/import/ImportSuccessStep';

type ImportStep = 'input' | 'processing' | 'results' | 'success';

interface ImportDrawerProps {
  onClose: () => void;
}

export default function ImportDrawer({ onClose }: ImportDrawerProps) {
  const {
    mode, inputValue,
    isProcessing, error,
    // Background task state from store
    isMinimized,
    progressPercent, progressLabel, discoveredNames,
    importResults, selectedIds: selectedIdsArray,
    sourceName,
    setProgress, resetBackgroundTask, patch,
  } = useImportStore();

  const isDesktop = useIsDesktop();
  const addPlace = useSavedStore(s => s.addPlace);
  const createSmartCollection = useSavedStore(s => s.createSmartCollection);

  // Local-only UI state (not needed across pages)
  const [step, setStep] = useState<ImportStep>('input');
  const [savedPlaces, setSavedPlaces] = useState<ImportedPlace[]>([]);
  const [createdCollectionName, setCreatedCollectionName] = useState('');
  const [showMapsInput, setShowMapsInput] = useState(false);
  const [mapsUrl, setMapsUrl] = useState('');

  // Convert store array to Set for UI
  const selectedIds = useMemo(() => new Set(selectedIdsArray), [selectedIdsArray]);

  // When re-opening from floating bar with results ready, jump to results step
  useEffect(() => {
    if (!isMinimized && importResults.length > 0 && step === 'input') {
      setStep('results');
    }
  }, [isMinimized, importResults.length, step]);

  // Detect destination(s) from results
  const detectedDestination = useMemo(() => {
    if (importResults.length === 0) return '';
    const locations = importResults.map(r => r.location).filter(Boolean);
    if (locations.length === 0) return '';

    const regions: Record<string, number> = {};
    locations.forEach(loc => {
      const parts = loc.split(',').map(p => p.trim()).filter(p => p.length > 1);
      const region = parts.length >= 2 ? parts.slice(-2).join(', ') : parts[parts.length - 1];
      if (region) regions[region] = (regions[region] || 0) + 1;
    });

    const sorted = Object.entries(regions).sort(([, a], [, b]) => b - a);
    if (sorted.length === 0) return '';
    const topCount = sorted[0][1];
    if (topCount > locations.length * 0.6) return sorted[0][0];
    const topRegions = sorted.slice(0, 3).map(([name]) => name);
    if (sorted.length > 3) return `${topRegions.join(', ')} + ${sorted.length - 3} more`;
    return topRegions.join(', ');
  }, [importResults]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    patch({ selectedIds: Array.from(next) });
  };

  const selectAll = () => patch({ selectedIds: importResults.map(r => r.id) });
  const deselectAll = () => patch({ selectedIds: [] });

  // ── Import handler: starts background stream + minimizes ──────────────
  async function handleImport() {
    if (!inputValue.trim()) return;
    const detectedMode = detectInputType(inputValue);
    patch({ mode: detectedMode, error: null });
    patch({ isProcessing: true });
    patch({ error: null });
    patch({ backgroundError: null });
    setProgress(0, 'Starting…');
    patch({ discoveredNames: [] });
    patch({ importResults: [] });

    // Minimize and close drawer — import runs in background
    patch({ isMinimized: true });
    onClose();

    try {
      await streamImport(inputValue, {
        onProgress: (percent, label, placeNames) => {
          setProgress(percent, label);
          if (placeNames) patch({ discoveredNames: placeNames });
        },
        onResult: (places) => {
          patch({ importResults: places, selectedIds: places.map(p => p.id), isProcessing: false });
          setProgress(100, 'Ready to review');
        },
        onError: () => {
          patch({ importResults: DEMO_IMPORT_RESULTS, selectedIds: DEMO_IMPORT_RESULTS.map(r => r.id), isProcessing: false });
          setProgress(100, 'Ready to review');
        },
      });
    } catch {
      patch({ importResults: DEMO_IMPORT_RESULTS, selectedIds: DEMO_IMPORT_RESULTS.map(r => r.id), isProcessing: false });
      setProgress(100, 'Ready to review');
    }
  }

  // ── Maps import handler: same minimize pattern ────────────────────────
  async function handleMapsImport() {
    if (!mapsUrl.trim()) return;
    patch({ isProcessing: true, error: null, backgroundError: null, discoveredNames: [], importResults: [], sourceName: 'Google Maps' });
    setProgress(0, 'Starting…');

    // Minimize and close drawer
    patch({ isMinimized: true });
    onClose();

    try {
      await streamMapsImport(mapsUrl, {
        onProgress: (percent, label, placeNames) => {
          setProgress(percent, label);
          if (placeNames) patch({ discoveredNames: placeNames });
        },
        onPreview: (places) => {
          patch({ importResults: places, selectedIds: places.map(p => p.id) });
          setProgress(50, 'Enriching with Google details…');
        },
        onResult: (places) => {
          patch({ importResults: places, selectedIds: places.map(p => p.id), isProcessing: false });
          setProgress(100, 'Ready to review');
        },
        onError: (errorMsg) => {
          patch({ backgroundError: errorMsg, isProcessing: false });
        },
      });
    } catch (err) {
      patch({ backgroundError: (err as Error).message || 'Maps import failed', isProcessing: false });
    }
  }

  function handleConfirmImport() {
    const selected = importResults.filter(r => selectedIds.has(r.id));
    if (selected.length === 0) return;

    // Save each place to My Places
    selected.forEach(place => addPlace(place));
    setSavedPlaces(selected);

    // Auto-create a collection for the import
    const dest = detectedDestination || 'Import';
    const collectionName = sourceName
      ? `${sourceName}: ${dest}`
      : `Imported: ${dest}`;
    setCreatedCollectionName(collectionName);
    createSmartCollection(
      collectionName,
      'discover',
      collectionName,
      [`source: ${sourceName || 'import'}`, `location: ${dest}`],
      selected.map(p => p.id),
    );

    setStep('success');
  }

  function handleClose() {
    // If we have results but haven't confirmed, keep them in store (user can come back via floating bar)
    if (step === 'results' && importResults.length > 0) {
      patch({ isMinimized: true });
    } else if (step === 'success') {
      resetBackgroundTask();
    }
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={handleClose} style={isDesktop ? { opacity: 0, animation: 'fadeInBackdrop 200ms ease both' } : undefined} />
      {/* Centering wrapper on desktop (flex avoids transform conflict with fadeInUp) */}
      <div
        className={isDesktop ? "fixed inset-0 flex items-center justify-center pointer-events-none" : "fixed bottom-0 left-0 right-0 z-50"}
        style={isDesktop ? { zIndex: 51 } : { maxWidth: 480, margin: '0 auto' }}
      >
      <div
        className={isDesktop ? "rounded-2xl overflow-y-auto pointer-events-auto" : "rounded-t-2xl overflow-y-auto"}
        style={isDesktop ? {
          width: 560, maxHeight: '80vh',
          background: 'var(--t-cream)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.12)',
          opacity: 0, animation: 'fadeInUp 250ms ease both',
        } : { background: 'var(--t-cream)', maxHeight: '90dvh' }}
      >
        {/* Handle bar — mobile only */}
        {!isDesktop && (
          <div className="flex justify-center pt-3 pb-1 sticky top-0" style={{ background: 'var(--t-cream)', zIndex: 1 }}>
            <div className="w-8 h-1 rounded-full" style={{ background: 'var(--t-travertine)' }} />
          </div>
        )}

        <div className={isDesktop ? "px-7 pb-8 pt-2" : "px-5 pb-20"}>

          {/* ========== STEP 1: INPUT ========== */}
          {step === 'input' && (
            <ImportInputStep
              onImport={handleImport}
              onMapsImport={handleMapsImport}
              inputValue={inputValue}
              onInputChange={value => patch({ inputValue: value, mode: detectInputType(value) })}
              mode={mode}
              sourceName={sourceName}
              onSourceNameChange={name => patch({ sourceName: name })}
              isProcessing={isProcessing}
              error={error}
              showMapsInput={showMapsInput}
              setShowMapsInput={setShowMapsInput}
              mapsUrl={mapsUrl}
              setMapsUrl={setMapsUrl}
              onClose={handleClose}
              isDesktop={isDesktop}
            />
          )}

          {/* ========== STEP 2: PROCESSING (fallback — usually minimized) ========== */}
          {step === 'processing' && (
            <ImportProcessingStep
              progressPercent={progressPercent}
              progressLabel={progressLabel}
              discoveredNames={discoveredNames}
              onMinimize={() => {
                patch({ isMinimized: true });
                onClose();
              }}
              isDesktop={isDesktop}
            />
          )}

          {/* ========== STEP 3: RESULTS ========== */}
          {step === 'results' && (
            <ImportResultsStep
              importResults={importResults}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onSelectAll={selectAll}
              onDeselectAll={deselectAll}
              onConfirm={handleConfirmImport}
              onImportMore={() => {
                setStep('input');
                resetBackgroundTask();
              }}
              sourceName={sourceName}
              detectedDestination={detectedDestination}
              isDesktop={isDesktop}
            />
          )}

          {/* ========== STEP 4: SUCCESS ========== */}
          {step === 'success' && (
            <ImportSuccessStep
              savedPlaces={savedPlaces}
              sourceName={sourceName}
              detectedDestination={detectedDestination}
              createdCollectionName={createdCollectionName}
              onClose={handleClose}
              onImportMore={() => {
                setStep('input');
                resetBackgroundTask();
                setSavedPlaces([]);
              }}
              isDesktop={isDesktop}
            />
          )}

        </div>
      </div>
      </div>
    </>
  );
}

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useImportStore, ImportMode } from '@/stores/importStore';
import { useSavedStore } from '@/stores/savedStore';
import { streamImport, streamMapsImport } from '@/lib/importService';
import { ImportedPlace, SOURCE_STYLES, GhostSourceType, PerriandIconName } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';

// Input type detection — Terrazzo figures out the rest
function detectInputType(input: string): ImportMode {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed) || /^(www\.)/i.test(trimmed)) {
    if (/google\.com\/maps/i.test(trimmed) || /maps\.app\.goo/i.test(trimmed)) return 'google-maps';
    return 'url';
  }
  return 'text';
}

// Category config for grouping imported results
const CATEGORY_CONFIG: Record<string, { icon: PerriandIconName; label: string }> = {
  restaurant: { icon: 'restaurant', label: 'Restaurants & bars' },
  hotel: { icon: 'hotel', label: 'Hotels' },
  bar: { icon: 'bar', label: 'Bars' },
  cafe: { icon: 'cafe', label: 'Coffee & sweet' },
  museum: { icon: 'museum', label: 'Sights & museums' },
  activity: { icon: 'activity', label: 'Activities' },
  neighborhood: { icon: 'neighborhood', label: 'Neighborhoods' },
  shop: { icon: 'shop', label: 'Shops' },
};

// Demo imported results for prototype
const DEMO_IMPORT_RESULTS: ImportedPlace[] = [
  {
    id: 'imp-1', name: 'Casa Caldera', type: 'restaurant', location: 'Yaiza, Lanzarote',
    source: { type: 'url', name: 'CN Traveller' }, matchScore: 91,
    matchBreakdown: { Design: 0.95, Character: 0.9, Service: 0.85, Food: 0.92, Location: 0.8, Wellness: 0.4 },
    tasteNote: 'Volcanic stone dining room — the grilled octopus at sunset is unforgettable',
    status: 'available', ghostSource: 'article', importBatchId: 'batch-lanzarote',
    whatToOrder: ['Grilled octopus ★', 'Papas arrugadas', 'Local wine'],
    tips: ['⏰ Book ahead for sunset table', '🍷 Ask for the volcanic Malvasía'],
  },
  {
    id: 'imp-2', name: 'Finca de Arrieta', type: 'hotel', location: 'Arrieta, Lanzarote',
    source: { type: 'url', name: 'CN Traveller' }, matchScore: 88,
    matchBreakdown: { Design: 0.92, Character: 0.88, Service: 0.8, Food: 0.5, Location: 0.85, Wellness: 0.9 },
    tasteNote: 'Eco-chic finca with volcanic views — the silence here is the luxury',
    status: 'available', ghostSource: 'article', importBatchId: 'batch-lanzarote',
  },
  {
    id: 'imp-3', name: 'El Lago', type: 'restaurant', location: 'Teguise, Lanzarote',
    source: { type: 'url', name: 'CN Traveller' }, matchScore: 85,
    matchBreakdown: { Design: 0.88, Character: 0.82, Service: 0.9, Food: 0.88, Location: 0.7, Wellness: 0.3 },
    tasteNote: 'Michelin-starred in a former granary — tasting menu tells the island\'s story',
    status: 'available', ghostSource: 'article', importBatchId: 'batch-lanzarote',
    whatToOrder: ['Tasting menu ★', 'Island cheese board'],
    tips: ['📅 Reserve well in advance', '👔 Smart casual dress code'],
  },
  {
    id: 'imp-4', name: 'Jameos del Agua', type: 'museum', location: 'Haría, Lanzarote',
    source: { type: 'url', name: 'CN Traveller' }, matchScore: 93,
    matchBreakdown: { Design: 0.99, Character: 0.95, Service: 0.6, Food: 0.1, Location: 0.9, Wellness: 0.7 },
    tasteNote: 'César Manrique\'s masterwork — a concert hall inside a lava tube',
    status: 'available', ghostSource: 'article', importBatchId: 'batch-lanzarote',
  },
  {
    id: 'imp-5', name: 'Bodega La Geria', type: 'activity', location: 'La Geria, Lanzarote',
    source: { type: 'url', name: 'CN Traveller' }, matchScore: 82,
    matchBreakdown: { Design: 0.85, Character: 0.9, Service: 0.7, Food: 0.75, Location: 0.95, Wellness: 0.6 },
    tasteNote: 'Volcanic wine tasting — vines growing in craters, Malvasía that tastes like the island',
    status: 'available', ghostSource: 'article', importBatchId: 'batch-lanzarote',
    whatToOrder: ['Malvasía volcánica ★', 'Moscatel dulce'],
    tips: ['🕐 Open afternoons only', '📸 Incredible photo ops in the vineyard craters'],
  },
  {
    id: 'imp-6', name: 'La Tegala', type: 'bar', location: 'Puerto del Carmen, Lanzarote',
    source: { type: 'url', name: 'CN Traveller' }, matchScore: 79,
    matchBreakdown: { Design: 0.7, Character: 0.85, Service: 0.8, Food: 0.6, Location: 0.65, Wellness: 0.4 },
    tasteNote: 'Local favorite — Canarian wines and volcanic cheese on a terrace with no tourists',
    status: 'available', ghostSource: 'article', importBatchId: 'batch-lanzarote',
    whatToOrder: ['Volcanic cheese board ★', 'Canarian wines by the glass'],
  },
];

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

  const addPlace = useSavedStore(s => s.addPlace);
  const createSmartShortlist = useSavedStore(s => s.createSmartShortlist);

  // Local-only UI state (not needed across pages)
  const [step, setStep] = useState<ImportStep>('input');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
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

  // Group results by category
  const groupedResults = useMemo(() => {
    const groups: Record<string, ImportedPlace[]> = {};
    importResults.forEach(item => {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
    });
    return Object.entries(groups).sort(([, a], [, b]) => b.length - a.length);
  }, [importResults]);

  // Top matches for success screen
  const topMatches = useMemo(() => {
    return [...savedPlaces].sort((a, b) => b.matchScore - a.matchScore).slice(0, 4);
  }, [savedPlaces]);

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

    // Auto-create a shortlist for the import
    const dest = detectedDestination || 'Import';
    const collectionName = sourceName
      ? `${sourceName}: ${dest}`
      : `Imported: ${dest}`;
    setCreatedCollectionName(collectionName);
    createSmartShortlist(
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
      <div className="fixed inset-0 z-50 bg-black/30" onClick={handleClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl overflow-y-auto"
        style={{ maxWidth: 480, margin: '0 auto', background: 'var(--t-cream)', maxHeight: '90vh' }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 sticky top-0" style={{ background: 'var(--t-cream)', zIndex: 1 }}>
          <div className="w-8 h-1 rounded-full" style={{ background: 'var(--t-travertine)' }} />
        </div>

        <div className="px-5 pb-20">

          {/* ========== STEP 1: INPUT ========== */}
          {step === 'input' && (
            <>
              <div className="flex items-center justify-between mb-1 mt-1">
                <h2 className="text-[20px] italic" style={{ fontFamily: FONT.serif, color: 'var(--t-ink)' }}>
                  Add places
                </h2>
                <button onClick={handleClose} className="bg-transparent border-none cursor-pointer flex items-center justify-center w-6 h-6" style={{ color: INK['80'] }}>
                  <PerriandIcon name="close" size={16} color={INK['80']} />
                </button>
              </div>
              <p className="text-[11px] mb-4" style={{ color: INK['85'], lineHeight: 1.5 }}>
                Paste anything — an article, a Google Maps list, a Substack, a text from a friend. We&apos;ll figure out the rest.
              </p>

              {/* Single magic text box */}
              <div className="rounded-2xl overflow-hidden mb-3 relative"
                style={{ border: inputValue.trim() ? '2px solid var(--t-honey)' : '2px solid var(--t-linen)', background: 'white', transition: 'border-color 0.2s ease' }}>
                <textarea value={inputValue} onChange={e => { patch({ inputValue: e.target.value, mode: detectInputType(e.target.value) }); }}
                  placeholder={`Paste a link, a message, or a list of places…\n\ne.g. a Condé Nast article, a Google Maps list,\na Substack post, or a text from a friend`}
                  className="w-full p-4 text-[12px] resize-none border-none outline-none leading-relaxed"
                  style={{ background: 'transparent', color: 'var(--t-ink)', fontFamily: FONT.sans, minHeight: 200 }} />
                {inputValue.length > 300 && (
                  <div className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none"
                    style={{ background: 'linear-gradient(transparent, white)' }} />
                )}
              </div>

              {/* Detected type indicator */}
              {inputValue.trim() && (
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="text-[10px]" style={{ color: INK['80'], fontFamily: FONT.mono }}>
                    {mode === 'url' ? '🔗 Link detected' : mode === 'google-maps' ? '📍 Google Maps link detected' : '📋 Text'}
                  </span>
                  <span style={{ color: INK['15'] }}>·</span>
                  <input
                    type="text"
                    value={sourceName}
                    onChange={e => patch({ sourceName: e.target.value })}
                    placeholder="Source name (optional)"
                    className="text-[10px] bg-transparent border-none outline-none flex-1"
                    style={{ color: 'var(--t-honey)', fontFamily: FONT.mono }}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              )}

              <button onClick={handleImport} disabled={isProcessing || !inputValue.trim()}
                className="w-full py-3.5 rounded-2xl border-none cursor-pointer text-[14px] font-semibold transition-all flex items-center justify-center gap-2"
                style={{ background: 'var(--t-ink)', color: 'white', opacity: isProcessing || !inputValue.trim() ? 0.35 : 1 }}>
                Find places
                <PerriandIcon name="terrazzo" size={16} color="white" />
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px" style={{ background: 'var(--t-linen)' }} />
                <span className="text-[10px]" style={{ color: INK['40'], fontFamily: FONT.mono }}>or</span>
                <div className="flex-1 h-px" style={{ background: 'var(--t-linen)' }} />
              </div>

              {/* Google Maps import */}
              {!showMapsInput ? (
                <button onClick={() => setShowMapsInput(true)}
                  className="w-full py-3 rounded-2xl border-none cursor-pointer text-[13px] font-semibold transition-all flex items-center justify-center gap-2"
                  style={{ background: 'white', color: 'var(--t-ink)', border: '1.5px solid var(--t-linen)' }}>
                  <span style={{ fontSize: 16 }}>📍</span>
                  Import from Google Maps
                </button>
              ) : (
                <div className="rounded-2xl overflow-hidden" style={{ border: '2px solid var(--t-honey)', background: 'white' }}>
                  <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                    <span style={{ fontSize: 14 }}>📍</span>
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--t-ink)' }}>Google Maps saved list</span>
                  </div>
                  <input
                    type="url"
                    value={mapsUrl}
                    onChange={e => setMapsUrl(e.target.value)}
                    placeholder="Paste your maps.app.goo.gl link…"
                    className="w-full px-3 py-2 text-[12px] border-none outline-none"
                    style={{ background: 'transparent', color: 'var(--t-ink)', fontFamily: FONT.sans }}
                    autoFocus
                  />
                  <div className="flex gap-2 px-3 pb-3">
                    <button onClick={() => { setShowMapsInput(false); setMapsUrl(''); }}
                      className="flex-1 py-2 rounded-xl border-none cursor-pointer text-[11px]"
                      style={{ background: 'var(--t-linen)', color: 'var(--t-ink)' }}>
                      Cancel
                    </button>
                    <button onClick={handleMapsImport} disabled={isProcessing || !mapsUrl.trim()}
                      className="flex-1 py-2 rounded-xl border-none cursor-pointer text-[11px] font-semibold"
                      style={{ background: 'var(--t-ink)', color: 'white', opacity: isProcessing || !mapsUrl.trim() ? 0.35 : 1 }}>
                      Import list
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-3 p-3 rounded-xl text-center" style={{ background: 'rgba(214,48,32,0.08)' }}>
                  <span className="text-[12px]" style={{ color: 'var(--t-signal-red)' }}>{error}</span>
                </div>
              )}
            </>
          )}

          {/* ========== STEP 2: PROCESSING (fallback — usually minimized) ========== */}
          {step === 'processing' && (
            <div className="flex flex-col items-center py-10">
              <div className="mb-4 ghost-shimmer flex justify-center">
                <PerriandIcon name="terrazzo" size={48} color="var(--t-honey)" />
              </div>
              <h3 className="text-xl italic mb-2" style={{ fontFamily: FONT.serif, color: 'var(--t-ink)' }}>
                {progressPercent < 35 ? 'Reading your paste…' : progressPercent < 75 ? 'Looking up places…' : 'Almost there…'}
              </h3>

              {/* Live progress bar */}
              <div className="w-full max-w-[280px] mb-4">
                <div className="w-full h-[6px] rounded-full overflow-hidden" style={{ background: 'var(--t-linen)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${progressPercent}%`,
                      background: 'linear-gradient(90deg, var(--t-honey), var(--t-verde))',
                      transition: 'width 0.5s ease-out',
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px]" style={{ color: INK['70'], fontFamily: FONT.sans }}>
                    {progressLabel}
                  </span>
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--t-honey)', fontFamily: FONT.mono }}>
                    {progressPercent}%
                  </span>
                </div>
              </div>

              {/* Place names discovered so far */}
              {discoveredNames.length > 0 && (
                <div className="w-full max-w-[280px] mt-2 rounded-xl p-3" style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
                  <div className="text-[9px] uppercase font-bold tracking-wider mb-2"
                    style={{ color: 'var(--t-honey)', fontFamily: FONT.mono, letterSpacing: '0.8px' }}>
                    Places found
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {discoveredNames.map((name, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-md"
                        style={{ background: 'var(--t-linen)', color: 'var(--t-ink)' }}>
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Minimize button */}
              <button
                onClick={() => { patch({ isMinimized: true }); onClose(); }}
                className="mt-6 px-4 py-2 rounded-xl border-none cursor-pointer text-[11px] font-semibold"
                style={{ background: 'var(--t-linen)', color: 'var(--t-ink)' }}>
                Continue in background
              </button>
            </div>
          )}

          {/* ========== STEP 3: RESULTS ========== */}
          {step === 'results' && (
            <>
              <div className="mt-1 mb-1">
                <h2 className="text-xl italic" style={{ fontFamily: FONT.serif, color: 'var(--t-ink)' }}>
                  Found {importResults.length} places
                </h2>
                <p className="text-[10px] mt-0.5" style={{ color: INK['95'] }}>
                  {sourceName ? `From "${sourceName}"` : 'From pasted content'}
                  {detectedDestination ? ` · ${detectedDestination}` : ''}
                </p>
              </div>

              {sourceName && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg mb-4 mt-2"
                  style={{ background: 'rgba(199,82,51,0.06)' }}>
                  <PerriandIcon name="article" size={12} color="#c75233" />
                  <span className="text-[10px] font-semibold" style={{ color: '#c75233' }}>{sourceName}</span>
                </div>
              )}

              {/* Bulk select controls */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px]" style={{ color: INK['95'] }}>
                  {selectedIds.size} of {importResults.length} selected
                </span>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-[10px] font-semibold bg-transparent border-none cursor-pointer" style={{ color: 'var(--t-verde)' }}>Select all</button>
                  <button onClick={deselectAll} className="text-[10px] font-semibold bg-transparent border-none cursor-pointer" style={{ color: INK['90'] }}>Clear</button>
                </div>
              </div>

              {/* Category groups */}
              <div className="flex flex-col gap-3 mt-1">
                {groupedResults.map(([type, items]) => {
                  const config = CATEGORY_CONFIG[type] || { icon: 'activity' as PerriandIconName, label: type };
                  const isExpanded = expandedCategory === type;
                  const selectedInGroup = items.filter(i => selectedIds.has(i.id)).length;
                  const MAX_VISIBLE = 4;

                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <PerriandIcon name={config.icon} size={18} color="var(--t-ink)" />
                          <span className="text-[13px] font-semibold" style={{ color: 'var(--t-ink)' }}>{config.label}</span>
                          <span className="text-[10px]" style={{ color: INK['90'] }}>{items.length}</span>
                        </div>
                        <span className="text-[10px] font-semibold" style={{ color: 'var(--t-verde)' }}>
                          {selectedInGroup === items.length ? 'All selected' : `${selectedInGroup}/${items.length}`}
                        </span>
                      </div>

                      <div className="rounded-xl overflow-hidden" style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
                        {items.slice(0, isExpanded ? items.length : MAX_VISIBLE).map((item, idx) => {
                          const isSelected = selectedIds.has(item.id);
                          return (
                            <div key={item.id} onClick={() => toggleSelect(item.id)}
                              className="flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-all"
                              style={{ borderBottom: idx < (isExpanded ? items.length : Math.min(items.length, MAX_VISIBLE)) - 1 ? '1px solid var(--t-linen)' : 'none' }}>
                              <div className="w-[18px] h-[18px] rounded flex items-center justify-center flex-shrink-0"
                                style={{ background: isSelected ? 'var(--t-verde)' : 'white', border: isSelected ? 'none' : '1.5px solid var(--t-linen)' }}>
                                {isSelected && <PerriandIcon name="check" size={12} color="white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[12px] font-semibold" style={{ color: 'var(--t-ink)' }}>{item.name}</div>
                                {item.tasteNote && (
                                  <div className="text-[10px] truncate" style={{ color: INK['95'] }}>&ldquo;{item.tasteNote}&rdquo;</div>
                                )}
                              </div>
                              {item.matchScore > 0 && (
                                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md flex-shrink-0"
                                  style={{ background: 'rgba(200,146,58,0.1)', color: 'var(--t-honey)', fontFamily: FONT.mono }}>
                                  {item.matchScore}%
                                </span>
                              )}
                            </div>
                          );
                        })}

                        {items.length > MAX_VISIBLE && !isExpanded && (
                          <button onClick={() => setExpandedCategory(type)}
                            className="w-full py-2 text-center text-[10px] font-semibold cursor-pointer bg-transparent border-none"
                            style={{ color: 'var(--t-honey)' }}>
                            + {items.length - MAX_VISIBLE} more {config.label.toLowerCase()}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Confirm button */}
              <button onClick={handleConfirmImport} disabled={selectedIds.size === 0}
                className="w-full mt-6 py-3.5 rounded-2xl border-none cursor-pointer text-[14px] font-semibold transition-all flex items-center justify-center gap-2"
                style={{ background: selectedIds.size > 0 ? 'var(--t-ink)' : INK['10'], color: selectedIds.size > 0 ? 'white' : INK['90'] }}>
                Save {selectedIds.size} places
                <PerriandIcon name="terrazzo" size={16} color={selectedIds.size > 0 ? 'white' : INK['90']} />
              </button>
              <p className="text-center text-[10px] mt-1.5 mb-2" style={{ color: INK['90'] }}>
                Deselect any you don&apos;t want
                {detectedDestination ? ` · All go to ${detectedDestination}` : ''}
              </p>

              <button onClick={() => { setStep('input'); resetBackgroundTask(); }}
                className="w-full mt-1 py-2 bg-transparent border-none cursor-pointer text-[11px]" style={{ color: INK['95'] }}>
                ← Import more
              </button>
            </>
          )}

          {/* ========== STEP 4: SUCCESS ========== */}
          {step === 'success' && (
            <>
              {/* Success banner */}
              <div className="flex items-center gap-3 rounded-2xl p-4 mt-1 mb-4"
                style={{ background: 'rgba(42,122,86,0.06)' }}>
                <div className="text-2xl">
                  <PerriandIcon name="check" size={28} color="var(--t-verde)" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold" style={{ color: 'var(--t-verde)' }}>
                    {savedPlaces.length} places saved
                  </div>
                  <div className="text-[10px]" style={{ color: INK['95'] }}>
                    {sourceName ? `From "${sourceName}"` : 'From pasted content'}
                    {detectedDestination ? ` · ${detectedDestination}` : ''}
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="flex gap-2 mb-4">
                <button onClick={handleClose}
                  className="flex-1 py-2.5 rounded-xl text-center border-none cursor-pointer flex flex-col items-center"
                  style={{ background: 'var(--t-linen)' }}>
                  <div className="mb-0.5">
                    <PerriandIcon name="trips" size={18} color="var(--t-ink)" />
                  </div>
                  <div className="text-[10px] font-semibold" style={{ color: 'var(--t-ink)' }}>View collection</div>
                </button>
                <button onClick={handleClose}
                  className="flex-1 py-2.5 rounded-xl text-center border-none cursor-pointer flex flex-col items-center"
                  style={{ background: 'var(--t-linen)' }}>
                  <div className="mb-0.5">
                    <PerriandIcon name="discover" size={18} color="var(--t-ink)" />
                  </div>
                  <div className="text-[10px] font-semibold" style={{ color: 'var(--t-ink)' }}>Start a trip</div>
                </button>
                <button onClick={handleClose}
                  className="flex-1 py-2.5 rounded-xl text-center border-none cursor-pointer flex flex-col items-center"
                  style={{ background: 'var(--t-linen)' }}>
                  <div className="mb-0.5">
                    <PerriandIcon name="pin" size={18} color="var(--t-ink)" />
                  </div>
                  <div className="text-[10px] font-semibold" style={{ color: 'var(--t-ink)' }}>View on map</div>
                </button>
              </div>

              {/* Auto-created collection card */}
              <div className="rounded-2xl overflow-hidden mb-4" style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
                <div className="relative" style={{ height: 100, background: 'linear-gradient(135deg, #d8c8a8, #c0b090, #b8a888)' }}>
                  {[30, 50, 35, 60, 40].map((top, i) => (
                    <div key={i} className="absolute rounded-full"
                      style={{ top, left: 60 + i * 50, width: 10, height: 10, background: 'var(--t-honey)', opacity: 0.8 }} />
                  ))}
                  <div className="absolute bottom-2 left-3 px-2 py-0.5 rounded-md text-[9px] text-white"
                    style={{ background: 'rgba(0,0,0,0.4)' }}>
                    {detectedDestination || 'Import'}
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[13px] font-semibold" style={{ color: 'var(--t-ink)' }}>{createdCollectionName}</div>
                      <div className="text-[10px]" style={{ color: INK['95'] }}>
                        {savedPlaces.length} places · auto-created collection
                      </div>
                    </div>
                    <div className="text-[12px]" style={{ color: 'var(--t-honey)' }}>→</div>
                  </div>
                </div>
              </div>

              {/* Top matches for you */}
              {topMatches.length > 0 && (
                <>
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1"
                    style={{ color: 'var(--t-honey)', fontFamily: FONT.mono, letterSpacing: '1px' }}>
                    <PerriandIcon name="terrazzo" size={12} color="var(--t-honey)" />
                    Top matches for you
                  </div>

                  {topMatches.map(place => {
                    const sourceStyle = place.ghostSource ? SOURCE_STYLES[place.ghostSource as GhostSourceType] : null;
                    return (
                      <div key={place.id} className="flex gap-2.5 rounded-xl p-3 mb-2"
                        style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                          style={{ background: `linear-gradient(135deg, ${sourceStyle?.color || '#c8923a'}30, ${sourceStyle?.color || '#c8923a'}15)`, color: sourceStyle?.color || 'var(--t-honey)', fontFamily: FONT.mono }}>
                          {place.matchScore}%
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-semibold" style={{ color: 'var(--t-ink)' }}>{place.name}</div>
                          <div className="text-[10px]" style={{ color: INK['95'] }}>
                            {place.type.charAt(0).toUpperCase() + place.type.slice(1)} · {place.location}
                          </div>
                          {place.tasteNote && (
                            <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--t-ghost)', fontStyle: 'italic' }}>
                              &ldquo;{place.tasteNote}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* Done button */}
              <button onClick={handleClose}
                className="w-full mt-4 py-3 rounded-2xl border-none cursor-pointer text-[13px] font-semibold"
                style={{ background: 'var(--t-ink)', color: 'white' }}>
                Done
              </button>

              <button onClick={() => { setStep('input'); resetBackgroundTask(); setSavedPlaces([]); }}
                className="w-full mt-2 py-2 bg-transparent border-none cursor-pointer text-[11px]"
                style={{ color: INK['95'] }}>
                Import more places
              </button>
            </>
          )}

        </div>
      </div>
    </>
  );
}

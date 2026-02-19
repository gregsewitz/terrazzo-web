'use client';

import { useState, useMemo } from 'react';
import { useImportStore, ImportMode } from '@/stores/importStore';
import { useSavedStore } from '@/stores/savedStore';
import { ImportedPlace, SOURCE_STYLES, GhostSourceType, PerriandIconName } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';

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
    mode, setMode, inputValue, setInputValue,
    isProcessing, setProcessing, error, setError, emailConnected, setEmailConnected,
  } = useImportStore();
  const addPlace = useSavedStore(s => s.addPlace);
  const addCollection = useSavedStore(s => s.addCollection);
  const addHistoryItems = useSavedStore(s => s.addHistoryItems);

  // Gmail is connected during onboarding and runs in background — no manual connect needed

  const [step, setStep] = useState<ImportStep>('input');
  const [importResults, setImportResults] = useState<ImportedPlace[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState('');
  const [savedPlaces, setSavedPlaces] = useState<ImportedPlace[]>([]);
  const [createdCollectionName, setCreatedCollectionName] = useState('');
  const [showMapsInput, setShowMapsInput] = useState(false);
  const [mapsUrl, setMapsUrl] = useState('');

  // Live progress from SSE stream
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [discoveredNames, setDiscoveredNames] = useState<string[]>([]);

  // Group results by category
  const groupedResults = useMemo(() => {
    const groups: Record<string, ImportedPlace[]> = {};
    importResults.forEach(item => {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
    });
    return Object.entries(groups).sort(([, a], [, b]) => b.length - a.length);
  }, [importResults]);

  // Top matches for success screen — sorted by matchScore desc
  const topMatches = useMemo(() => {
    return [...savedPlaces].sort((a, b) => b.matchScore - a.matchScore).slice(0, 4);
  }, [savedPlaces]);

  // Detect destination(s) from results — handles multi-city lists intelligently
  const detectedDestination = useMemo(() => {
    if (importResults.length === 0) return '';
    const locations = importResults.map(r => r.location).filter(Boolean);
    if (locations.length === 0) return '';

    // Extract country/region (last meaningful part of address) for grouping
    const regions: Record<string, number> = {};
    locations.forEach(loc => {
      const parts = loc.split(',').map(p => p.trim()).filter(p => p.length > 1);
      // Use last 1-2 parts as region key (country, or state+country)
      const region = parts.length >= 2 ? parts.slice(-2).join(', ') : parts[parts.length - 1];
      if (region) regions[region] = (regions[region] || 0) + 1;
    });

    const sorted = Object.entries(regions).sort(([, a], [, b]) => b - a);
    if (sorted.length === 0) return '';

    // If one region dominates (>60% of places), show it
    const topCount = sorted[0][1];
    if (topCount > locations.length * 0.6) return sorted[0][0];

    // Otherwise show top 2-3 regions
    const topRegions = sorted.slice(0, 3).map(([name]) => name);
    if (sorted.length > 3) return `${topRegions.join(', ')} + ${sorted.length - 3} more`;
    return topRegions.join(', ');
  }, [importResults]);
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(importResults.map(r => r.id)));
  const deselectAll = () => setSelectedIds(new Set());

  async function handleImport() {
    if (!inputValue.trim()) return;
    const detectedMode = detectInputType(inputValue);
    setMode(detectedMode);
    setProcessing(true);
    setError(null);
    setStep('processing');
    setProgressPercent(0);
    setProgressLabel('Starting…');
    setDiscoveredNames([]);

    // Helper to show demo results as fallback
    const showDemoFallback = () => {
      setProgressLabel('Loading preview…');
      setProgressPercent(90);
      setTimeout(() => {
        setImportResults(DEMO_IMPORT_RESULTS);
        setSelectedIds(new Set(DEMO_IMPORT_RESULTS.map(r => r.id)));
        setStep('results');
        setProcessing(false);
      }, 1200);
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: inputValue }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok || !res.body) throw new Error('Import failed');

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'progress') {
              setProgressPercent(event.percent || 0);
              setProgressLabel(event.label || '');
              if (event.placeNames) setDiscoveredNames(event.placeNames);
            } else if (event.type === 'result') {
              setProgressPercent(100);
              setProgressLabel('Done!');
              if (event.places?.length) {
                setImportResults(event.places);
                setSelectedIds(new Set(event.places.map((p: ImportedPlace) => p.id)));
                // Short pause at 100% so the user sees completion
                await new Promise(r => setTimeout(r, 600));
                setStep('results');
              } else {
                setError('No places found');
                setStep('input');
              }
            } else if (event.type === 'error') {
              throw new Error(event.error || 'Import failed');
            }
          } catch (parseErr) {
            // Skip malformed SSE lines
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }
    } catch {
      showDemoFallback();
      return;
    } finally {
      setProcessing(false);
    }
  }


  async function handleMapsImport() {
    if (!mapsUrl.trim()) return;
    setProcessing(true);
    setError(null);
    setStep('processing');
    setProgressPercent(0);
    setProgressLabel('Starting…');
    setDiscoveredNames([]);
    setSourceName('Google Maps');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000); // 2 min (much faster now)

      const res = await fetch('/api/import/maps-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: mapsUrl }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok || !res.body) throw new Error('Maps import failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'progress') {
              setProgressPercent(event.percent || 0);
              setProgressLabel(event.label || '');
              if (event.placeNames) setDiscoveredNames(event.placeNames);
            } else if (event.type === 'preview') {
              // Lazy enrichment: show basic results immediately while enrichment continues
              if (event.places?.length) {
                setImportResults(event.places);
                setSelectedIds(new Set(event.places.map((p: ImportedPlace) => p.id)));
                setStep('results');
              }
            } else if (event.type === 'result') {
              // Final enriched results replace the preview with full data
              setProgressPercent(100);
              setProgressLabel('Done!');
              if (event.places?.length) {
                setImportResults(event.places);
                setSelectedIds(new Set(event.places.map((p: ImportedPlace) => p.id)));
                setStep('results');
              } else {
                setError('No places found in the list');
                setStep('input');
              }
            } else if (event.type === 'error') {
              throw new Error(event.error || 'Maps import failed');
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to import Google Maps list');
      setStep('input');
    } finally {
      setProcessing(false);
    }
  }

  function handleConfirmImport() {
    const selected = importResults.filter(r => selectedIds.has(r.id));
    if (selected.length === 0) return;

    // Save each place to My Places (savedStore)
    selected.forEach(place => addPlace(place));
    setSavedPlaces(selected);

    // Auto-create a collection
    const dest = detectedDestination || 'Import';
    const collectionName = sourceName
      ? `${sourceName}: ${dest}`
      : `Imported: ${dest}`;
    setCreatedCollectionName(collectionName);
    addCollection({
      name: collectionName,
      count: selected.length,
      emoji: 'discover',
      isSmartCollection: true,
      query: collectionName,
      filterTags: [`source: ${sourceName || 'import'}`, `location: ${dest}`],
    });

    // Move to success screen
    setStep('success');
  }
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
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
                <h2 className="text-[20px] italic" style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}>
                  Add places
                </h2>
                <button onClick={onClose} className="bg-transparent border-none cursor-pointer flex items-center justify-center w-6 h-6" style={{ color: 'rgba(28,26,23,0.8)' }}>
                  <PerriandIcon name="close" size={16} color="rgba(28,26,23,0.8)" />
                </button>
              </div>
              <p className="text-[11px] mb-4" style={{ color: 'rgba(28,26,23,0.85)', lineHeight: 1.5 }}>
                Paste anything — an article, a Google Maps list, a Substack, a text from a friend. We&apos;ll figure out the rest.
              </p>

              {/* Single magic text box */}
              <div className="rounded-2xl overflow-hidden mb-3 relative"
                style={{ border: inputValue.trim() ? '2px solid var(--t-honey)' : '2px solid var(--t-linen)', background: 'white', transition: 'border-color 0.2s ease' }}>
                <textarea value={inputValue} onChange={e => { setInputValue(e.target.value); setMode(detectInputType(e.target.value)); }}
                  placeholder={`Paste a link, a message, or a list of places…\n\ne.g. a Condé Nast article, a Google Maps list,\na Substack post, or a text from a friend`}
                  className="w-full p-4 text-[12px] resize-none border-none outline-none leading-relaxed"
                  style={{ background: 'transparent', color: 'var(--t-ink)', fontFamily: "'DM Sans', sans-serif", minHeight: 200 }} />
                {inputValue.length > 300 && (
                  <div className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none"
                    style={{ background: 'linear-gradient(transparent, white)' }} />
                )}
              </div>

              {/* Detected type indicator — subtle, appears when typing */}
              {inputValue.trim() && (
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="text-[10px]" style={{ color: 'rgba(28,26,23,0.8)', fontFamily: "'Space Mono', monospace" }}>
                    {mode === 'url' ? '🔗 Link detected' : mode === 'google-maps' ? '📍 Google Maps link detected' : '📋 Text'}
                  </span>
                  {/* Optional source label */}
                  <span style={{ color: 'rgba(28,26,23,0.15)' }}>·</span>
                  <input
                    type="text"
                    value={sourceName}
                    onChange={e => setSourceName(e.target.value)}
                    placeholder="Source name (optional)"
                    className="text-[10px] bg-transparent border-none outline-none flex-1"
                    style={{ color: 'var(--t-honey)', fontFamily: "'Space Mono', monospace" }}
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
                <span className="text-[10px]" style={{ color: 'rgba(28,26,23,0.4)', fontFamily: "'Space Mono', monospace" }}>or</span>
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
                    style={{ background: 'transparent', color: 'var(--t-ink)', fontFamily: "'DM Sans', sans-serif" }}
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
          {/* ========== STEP 2: PROCESSING ========== */}
          {step === 'processing' && (
            <div className="flex flex-col items-center py-10">
              <div className="mb-4 ghost-shimmer flex justify-center">
                <PerriandIcon name="terrazzo" size={48} color="var(--t-honey)" />
              </div>
              <h3 className="text-xl italic mb-2" style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}>
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
                  <span className="text-[11px]" style={{ color: 'rgba(28,26,23,0.7)', fontFamily: "'DM Sans', sans-serif" }}>
                    {progressLabel}
                  </span>
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--t-honey)', fontFamily: "'Space Mono', monospace" }}>
                    {progressPercent}%
                  </span>
                </div>
              </div>

              {/* Place names that have been discovered so far */}
              {discoveredNames.length > 0 && (
                <div className="w-full max-w-[280px] mt-2 rounded-xl p-3" style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
                  <div className="text-[9px] uppercase font-bold tracking-wider mb-2"
                    style={{ color: 'var(--t-honey)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.8px' }}>
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
            </div>
          )}
          {/* ========== STEP 3: RESULTS ========== */}
          {step === 'results' && (
            <>
              <div className="mt-1 mb-1">
                <h2 className="text-xl italic" style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}>
                  Found {importResults.length} places
                </h2>
                <p className="text-[10px] mt-0.5" style={{ color: 'rgba(28,26,23,0.95)' }}>
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
                <span className="text-[10px]" style={{ color: 'rgba(28,26,23,0.95)' }}>
                  {selectedIds.size} of {importResults.length} selected
                </span>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-[10px] font-semibold bg-transparent border-none cursor-pointer" style={{ color: 'var(--t-verde)' }}>Select all</button>
                  <button onClick={deselectAll} className="text-[10px] font-semibold bg-transparent border-none cursor-pointer" style={{ color: 'rgba(28,26,23,0.9)' }}>Clear</button>
                </div>
              </div>
              {/* Category groups */}
              <div className="flex flex-col gap-3 mt-1">
                {groupedResults.map(([type, items]) => {
                  const config = CATEGORY_CONFIG[type] || { icon: '📍', label: type };
                  const isExpanded = expandedCategory === type;
                  const selectedInGroup = items.filter(i => selectedIds.has(i.id)).length;
                  const MAX_VISIBLE = 4;

                  return (
                    <div key={type}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <PerriandIcon name={config.icon} size={18} color="var(--t-ink)" />
                          <span className="text-[13px] font-semibold" style={{ color: 'var(--t-ink)' }}>{config.label}</span>
                          <span className="text-[10px]" style={{ color: 'rgba(28,26,23,0.9)' }}>{items.length}</span>
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
                                  <div className="text-[10px] truncate" style={{ color: 'rgba(28,26,23,0.95)' }}>&ldquo;{item.tasteNote}&rdquo;</div>
                                )}
                              </div>
                              {item.matchScore > 0 && (
                                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md flex-shrink-0"
                                  style={{ background: 'rgba(200,146,58,0.1)', color: 'var(--t-honey)', fontFamily: "'Space Mono', monospace" }}>
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
                style={{ background: selectedIds.size > 0 ? 'var(--t-ink)' : 'rgba(28,26,23,0.1)', color: selectedIds.size > 0 ? 'white' : 'rgba(28,26,23,0.9)' }}>
                Save {selectedIds.size} places
                <PerriandIcon name="terrazzo" size={16} color={selectedIds.size > 0 ? 'white' : 'rgba(28,26,23,0.9)'} />
              </button>
              <p className="text-center text-[10px] mt-1.5 mb-2" style={{ color: 'rgba(28,26,23,0.9)' }}>
                Deselect any you don&apos;t want
                {detectedDestination ? ` · All go to ${detectedDestination}` : ''}
              </p>

              <button onClick={() => { setStep('input'); setImportResults([]); }}
                className="w-full mt-1 py-2 bg-transparent border-none cursor-pointer text-[11px]" style={{ color: 'rgba(28,26,23,0.95)' }}>
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
                  <div className="text-[10px]" style={{ color: 'rgba(28,26,23,0.95)' }}>
                    {sourceName ? `From "${sourceName}"` : 'From pasted content'}
                    {detectedDestination ? ` · ${detectedDestination}` : ''}
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="flex gap-2 mb-4">
                <button onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-center border-none cursor-pointer flex flex-col items-center"
                  style={{ background: 'var(--t-linen)' }}>
                  <div className="mb-0.5">
                    <PerriandIcon name="trips" size={18} color="var(--t-ink)" />
                  </div>
                  <div className="text-[10px] font-semibold" style={{ color: 'var(--t-ink)' }}>View collection</div>
                </button>
                <button onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl text-center border-none cursor-pointer flex flex-col items-center"
                  style={{ background: 'var(--t-linen)' }}>
                  <div className="mb-0.5">
                    <PerriandIcon name="discover" size={18} color="var(--t-ink)" />
                  </div>
                  <div className="text-[10px] font-semibold" style={{ color: 'var(--t-ink)' }}>Start a trip</div>
                </button>
                <button onClick={onClose}
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
                  {/* Mini map dots */}
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
                      <div className="text-[10px]" style={{ color: 'rgba(28,26,23,0.95)' }}>
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
                    style={{ color: 'var(--t-honey)', fontFamily: "'Space Mono', monospace", letterSpacing: '1px' }}>
                    <PerriandIcon name="terrazzo" size={12} color="var(--t-honey)" />
                    Top matches for you
                  </div>

                  {topMatches.map(place => {
                    const sourceStyle = place.ghostSource ? SOURCE_STYLES[place.ghostSource as GhostSourceType] : null;
                    return (
                      <div key={place.id} className="flex gap-2.5 rounded-xl p-3 mb-2"
                        style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                          style={{ background: `linear-gradient(135deg, ${sourceStyle?.color || '#c8923a'}30, ${sourceStyle?.color || '#c8923a'}15)`, color: sourceStyle?.color || 'var(--t-honey)', fontFamily: "'Space Mono', monospace" }}>
                          {place.matchScore}%
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-semibold" style={{ color: 'var(--t-ink)' }}>{place.name}</div>
                          <div className="text-[10px]" style={{ color: 'rgba(28,26,23,0.95)' }}>
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
              <button onClick={onClose}
                className="w-full mt-4 py-3 rounded-2xl border-none cursor-pointer text-[13px] font-semibold"
                style={{ background: 'var(--t-ink)', color: 'white' }}>
                Done
              </button>

              <button onClick={() => { setStep('input'); setImportResults([]); setSavedPlaces([]); }}
                className="w-full mt-2 py-2 bg-transparent border-none cursor-pointer text-[11px]"
                style={{ color: 'rgba(28,26,23,0.95)' }}>
                Import more places
              </button>
            </>
          )}

        </div>
      </div>
    </>
  );
}
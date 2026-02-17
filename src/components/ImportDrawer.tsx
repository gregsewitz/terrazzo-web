'use client';

import { useState, useMemo, useEffect } from 'react';
import { useImportStore, ImportMode } from '@/stores/importStore';
import { useTripStore } from '@/stores/tripStore';
import { useSavedStore } from '@/stores/savedStore';
import { ImportedPlace } from '@/types';

const IMPORT_MODES: { value: ImportMode; label: string; icon: string }[] = [
  { value: 'text', label: 'Paste text', icon: '📋' },
  { value: 'url', label: 'Paste link', icon: '🔗' },
  { value: 'google-maps', label: 'Maps', icon: '📍' },
  { value: 'email', label: 'Gmail', icon: '✉' },
];

// Category config for grouping imported results
const CATEGORY_CONFIG: Record<string, { icon: string; label: string }> = {
  restaurant: { icon: '🍽', label: 'Restaurants & bars' },
  hotel: { icon: '🏨', label: 'Hotels' },
  bar: { icon: '🍸', label: 'Bars' },
  cafe: { icon: '☕', label: 'Coffee & sweet' },
  museum: { icon: '🏛', label: 'Sights & museums' },
  activity: { icon: '⚡', label: 'Activities' },
  neighborhood: { icon: '🏘', label: 'Neighborhoods' },
  shop: { icon: '🛍', label: 'Shops' },
};

// Demo imported results for prototype
const DEMO_IMPORT_RESULTS: ImportedPlace[] = [
  {
    id: 'imp-1', name: 'Casa Caldera', type: 'restaurant', location: 'Yaiza, Lanzarote',
    source: { type: 'url', name: 'CN Traveller' }, matchScore: 91,
    matchBreakdown: { Design: 0.95, Character: 0.9, Service: 0.85, Food: 0.92, Location: 0.8, Wellness: 0.4 },
    tasteNote: 'Volcanic stone dining room — the grilled octopus at sunset is unforgettable',
    status: 'available', ghostSource: 'article',
  },
  {
    id: 'imp-2', name: 'Finca de Arrieta', type: 'hotel', location: 'Arrieta, Lanzarote',
    source: { type: 'url', name: 'CN Traveller' }, matchScore: 88,
    matchBreakdown: { Design: 0.92, Character: 0.88, Service: 0.8, Food: 0.5, Location: 0.85, Wellness: 0.9 },
    tasteNote: 'Eco-chic finca with volcanic views — the silence here is the luxury',
    status: 'available', ghostSource: 'article',
  },
  {
    id: 'imp-3', name: 'El Lago', type: 'restaurant', location: 'Teguise, Lanzarote',
    source: { type: 'url', name: 'CN Traveller' }, matchScore: 85,
    matchBreakdown: { Design: 0.88, Character: 0.82, Service: 0.9, Food: 0.88, Location: 0.7, Wellness: 0.3 },
    tasteNote: 'Michelin-starred in a former granary — tasting menu tells the island\'s story',
    status: 'available', ghostSource: 'article',
  },
  {
    id: 'imp-4', name: 'Jameos del Agua', type: 'museum', location: 'Haría, Lanzarote',
    source: { type: 'url', name: 'CN Traveller' }, matchScore: 93,
    matchBreakdown: { Design: 0.99, Character: 0.95, Service: 0.6, Food: 0.1, Location: 0.9, Wellness: 0.7 },
    tasteNote: 'César Manrique\'s masterwork — a concert hall inside a lava tube',
    status: 'available', ghostSource: 'article',
  },
  {
    id: 'imp-5', name: 'Bodega La Geria', type: 'activity', location: 'La Geria, Lanzarote',
    source: { type: 'url', name: 'CN Traveller' }, matchScore: 82,
    matchBreakdown: { Design: 0.85, Character: 0.9, Service: 0.7, Food: 0.75, Location: 0.95, Wellness: 0.6 },
    tasteNote: 'Volcanic wine tasting — vines growing in craters, Malvasía that tastes like the island',
    status: 'available', ghostSource: 'article',
  },
  {
    id: 'imp-6', name: 'La Tegala', type: 'bar', location: 'Puerto del Carmen, Lanzarote',
    source: { type: 'url', name: 'CN Traveller' }, matchScore: 79,
    matchBreakdown: { Design: 0.7, Character: 0.85, Service: 0.8, Food: 0.6, Location: 0.65, Wellness: 0.4 },
    tasteNote: 'Local favorite — Canarian wines and volcanic cheese on a terrace with no tourists',
    status: 'available', ghostSource: 'article',
  },
];

type ImportStep = 'input' | 'processing' | 'results';

// Progress items for the processing animation
interface ProgressItem {
  label: string;
  status: 'done' | 'active' | 'pending';
}

interface ImportDrawerProps {
  onClose: () => void;
}

export default function ImportDrawer({ onClose }: ImportDrawerProps) {
  const {
    mode, setMode, inputValue, setInputValue,
    isProcessing, setProcessing, error, setError, emailConnected, setEmailConnected,
  } = useImportStore();
  const addToPool = useTripStore(s => s.addToPool);
  const addHistoryItems = useSavedStore(s => s.addHistoryItems);

  // Check Gmail connection status on mount
  useEffect(() => {
    fetch('/api/email/status')
      .then(r => r.json())
      .then(data => { if (data.connected) setEmailConnected(true); })
      .catch(() => {});
  }, [setEmailConnected]);

  const [step, setStep] = useState<ImportStep>('input');
  const [importResults, setImportResults] = useState<ImportedPlace[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);
  const [sourceName, setSourceName] = useState('');

  // Group results by category
  const groupedResults = useMemo(() => {
    const groups: Record<string, ImportedPlace[]> = {};
    importResults.forEach(item => {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
    });
    return Object.entries(groups).sort(([, a], [, b]) => b.length - a.length);
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

  // Animated progress during processing step
  useEffect(() => {
    if (step !== 'processing') return;
    const steps: ProgressItem[] = [
      { label: `Found ${DEMO_IMPORT_RESULTS.length} places`, status: 'pending' },
      { label: `Detected ${groupedResults.length || 4} categories`, status: 'pending' },
      { label: 'Extracted notes for places', status: 'pending' },
      { label: 'Geocoding locations…', status: 'pending' },
      { label: 'Matching to your taste profile', status: 'pending' },
    ];
    setProgressItems(steps);

    const timers: NodeJS.Timeout[] = [];
    steps.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setProgressItems(prev => prev.map((p, j) => ({
          ...p,
          status: j < i ? 'done' : j === i ? 'active' : 'pending',
        })));
      }, 300 + i * 400));
    });
    // Mark last as done
    timers.push(setTimeout(() => {
      setProgressItems(prev => prev.map(p => ({ ...p, status: 'done' })));
    }, 300 + steps.length * 400));

    return () => timers.forEach(clearTimeout);
  }, [step, groupedResults.length]);

  async function handleImport() {
    if (!inputValue.trim() && mode !== 'email') return;
    setProcessing(true);
    setError(null);
    setStep('processing');

    try {
      const endpoint = mode === 'url' ? '/api/import/url'
        : mode === 'text' ? '/api/import/text'
        : mode === 'google-maps' ? '/api/import/maps'
        : '/api/email/scan';
      const body = mode === 'email' ? {} : { content: inputValue };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Import failed');
      const data = await res.json();
      if (data.places?.length) {
        setImportResults(data.places);
        setSelectedIds(new Set(data.places.map((p: ImportedPlace) => p.id)));
        // If email scan returned history items, add them to the history store
        if (data.historyItems?.length && mode === 'email') {
          addHistoryItems(data.historyItems);
        }
        setStep('results');
      } else {
        setError('No places found in the content');
        setStep('input');
      }
    } catch {
      // For prototype: use demo results after animated delay
      setTimeout(() => {
        setImportResults(DEMO_IMPORT_RESULTS);
        setSelectedIds(new Set(DEMO_IMPORT_RESULTS.map(r => r.id)));
        setStep('results');
        setProcessing(false);
      }, 2200);
      return;
    } finally {
      setProcessing(false);
    }
  }

  async function handleConnectEmail() {
    try {
      const res = await fetch('/api/auth/nylas/connect');
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setError('Failed to connect email');
    }
  }

  function handleConfirmImport() {
    const selected = importResults.filter(r => selectedIds.has(r.id));
    if (selected.length > 0) addToPool(selected);
    onClose();
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

        <div className="px-5 pb-8">

          {/* ========== STEP 1: INPUT ========== */}
          {step === 'input' && (
            <>
              <div className="flex items-center gap-2.5 mb-4 mt-1">
                <button
                  onClick={onClose}
                  className="text-base bg-transparent border-none cursor-pointer"
                  style={{ color: 'rgba(28,26,23,0.5)' }}
                >
                  ←
                </button>
                <h2
                  className="text-xl italic"
                  style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}
                >
                  Add places
                </h2>
              </div>

              {/* Input method pills — horizontal row like wireframe */}
              <div className="flex gap-2 mb-4">
                {IMPORT_MODES.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setMode(m.value)}
                    className="flex-1 py-2.5 rounded-xl text-center text-[12px] font-semibold cursor-pointer transition-all border-none"
                    style={{
                      background: mode === m.value ? 'var(--t-ink)' : 'var(--t-linen)',
                      color: mode === m.value ? 'white' : 'var(--t-ink)',
                    }}
                  >
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>

              {/* Input area */}
              {mode === 'email' ? (
                <div className="text-center py-4">
                  {emailConnected ? (
                    <button
                      onClick={handleImport}
                      disabled={isProcessing}
                      className="px-6 py-2.5 rounded-full border-none cursor-pointer text-[12px] font-semibold"
                      style={{ background: 'var(--t-verde)', color: 'white', opacity: isProcessing ? 0.6 : 1 }}
                    >
                      {isProcessing ? 'Scanning...' : '✉️ Scan Gmail for Bookings'}
                    </button>
                  ) : (
                    <button
                      onClick={handleConnectEmail}
                      className="px-6 py-2.5 rounded-full border-none cursor-pointer text-[12px] font-semibold"
                      style={{ background: 'var(--t-panton-orange)', color: 'white' }}
                    >
                      Connect Gmail
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Text area — honey border like wireframe */}
                  <div
                    className="rounded-2xl overflow-hidden mb-3 relative"
                    style={{
                      border: inputValue.trim() ? '2px solid var(--t-honey)' : '2px solid var(--t-linen)',
                      background: 'white',
                    }}
                  >
                    <textarea
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      placeholder={
                        mode === 'url'
                          ? 'Paste article URL (e.g. cntraveller.com/gallery/best-restaurants-lanzarote)'
                          : mode === 'google-maps'
                          ? 'Paste a Google Maps list URL, or type place names (one per line)'
                          : "Paste your friend's recommendations, a newsletter, article text, notes..."
                      }
                      className="w-full p-3.5 text-[11px] resize-none border-none outline-none leading-relaxed"
                      style={{
                        background: 'transparent',
                        color: 'var(--t-ink)',
                        fontFamily: "'DM Sans', sans-serif",
                        minHeight: 180,
                      }}
                    />
                    {/* Fade overlay at bottom */}
                    {inputValue.length > 200 && (
                      <div
                        className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none"
                        style={{ background: 'linear-gradient(transparent, white)' }}
                      />
                    )}
                  </div>

                  {/* Source attribution — optional */}
                  <div
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl mb-4"
                    style={{ background: 'var(--t-linen)' }}
                  >
                    <span className="text-sm">📰</span>
                    <div className="flex-1">
                      <div className="text-[11px] font-medium" style={{ color: 'var(--t-ink)' }}>Source (optional)</div>
                      <input
                        type="text"
                        value={sourceName}
                        onChange={e => setSourceName(e.target.value)}
                        placeholder="e.g. Shortlisted newsletter"
                        className="text-[12px] bg-transparent border-none outline-none w-full mt-0.5"
                        style={{ color: 'var(--t-honey)', fontFamily: "'DM Sans', sans-serif" }}
                      />
                    </div>
                    {sourceName && (
                      <button
                        onClick={() => setSourceName('')}
                        className="text-[10px] bg-transparent border-none cursor-pointer"
                        style={{ color: 'rgba(28,26,23,0.4)' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Process button — dark bg like wireframe */}
                  <button
                    onClick={handleImport}
                    disabled={isProcessing || !inputValue.trim()}
                    className="w-full py-3.5 rounded-2xl border-none cursor-pointer text-[14px] font-semibold transition-opacity"
                    style={{
                      background: 'var(--t-ink)',
                      color: 'white',
                      opacity: isProcessing || !inputValue.trim() ? 0.4 : 1,
                    }}
                  >
                    Find places ✦
                  </button>
                  <p className="text-center text-[10px] mt-2" style={{ color: 'rgba(28,26,23,0.4)' }}>
                    AI will identify places, notes & categories
                  </p>
                </>
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
              {/* Spinning sparkle */}
              <div className="text-5xl mb-4 ghost-shimmer">✦</div>
              <h3
                className="text-xl italic mb-2"
                style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}
              >
                Reading your paste…
              </h3>
              <p className="text-[12px] mb-6" style={{ color: 'rgba(28,26,23,0.5)' }}>
                Finding places, extracting notes, categorizing
              </p>

              {/* Progress checklist — like wireframe */}
              <div className="w-full max-w-[260px]">
                {progressItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2.5">
                    <div
                      className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] flex-shrink-0"
                      style={{
                        background: item.status === 'done' ? 'var(--t-verde)'
                          : item.status === 'active' ? 'var(--t-honey)'
                          : 'var(--t-linen)',
                        color: item.status === 'done' || item.status === 'active' ? 'white' : 'rgba(28,26,23,0.4)',
                        fontWeight: 700,
                      }}
                    >
                      {item.status === 'done' ? '✓' : item.status === 'active' ? '…' : '○'}
                    </div>
                    <span
                      className="text-[12px]"
                      style={{ color: item.status === 'pending' ? 'rgba(28,26,23,0.4)' : 'var(--t-ink)' }}
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Detected destination badge */}
              <div
                className="mt-6 px-4 py-2.5 rounded-xl inline-flex items-center gap-2"
                style={{ background: 'var(--t-linen)' }}
              >
                <span className="text-base">🌍</span>
                <div>
                  <div className="text-[12px] font-semibold" style={{ color: 'var(--t-ink)' }}>
                    Detected destination
                  </div>
                  <div className="text-[10px]" style={{ color: 'rgba(28,26,23,0.5)' }}>
                    Analyzing content…
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========== STEP 3: RESULTS ========== */}
          {step === 'results' && (
            <>
              {/* Header */}
              <div className="mt-1 mb-1">
                <h2
                  className="text-xl italic"
                  style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}
                >
                  Found {importResults.length} places
                </h2>
                <p className="text-[10px] mt-0.5" style={{ color: 'rgba(28,26,23,0.5)' }}>
                  {sourceName ? `From "${sourceName}"` : 'From pasted content'}
                </p>
              </div>

              {/* Source badge */}
              {sourceName && (
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg mb-4 mt-2"
                  style={{ background: 'rgba(199,82,51,0.06)' }}
                >
                  <span className="text-[10px]">📰</span>
                  <span className="text-[10px] font-semibold" style={{ color: '#c75233' }}>{sourceName}</span>
                </div>
              )}

              {/* Category groups — wireframe style */}
              <div className="flex flex-col gap-3 mt-3">
                {groupedResults.map(([type, items]) => {
                  const config = CATEGORY_CONFIG[type] || { icon: '📍', label: type };
                  const isExpanded = expandedCategory === type;
                  const selectedInGroup = items.filter(i => selectedIds.has(i.id)).length;
                  const MAX_VISIBLE = 4;

                  return (
                    <div key={type}>
                      {/* Category header row */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{config.icon}</span>
                          <span className="text-[13px] font-semibold" style={{ color: 'var(--t-ink)' }}>{config.label}</span>
                          <span className="text-[10px]" style={{ color: 'rgba(28,26,23,0.4)' }}>{items.length}</span>
                        </div>
                        <span className="text-[10px] font-semibold" style={{ color: 'var(--t-verde)' }}>
                          {selectedInGroup === items.length ? 'All selected' : `${selectedInGroup}/${items.length}`}
                        </span>
                      </div>

                      {/* Compact card list — white container like wireframe */}
                      <div
                        className="rounded-xl overflow-hidden"
                        style={{ background: 'white', border: '1px solid var(--t-linen)' }}
                      >
                        {items.slice(0, isExpanded ? items.length : MAX_VISIBLE).map((item, idx) => {
                          const isSelected = selectedIds.has(item.id);
                          return (
                            <div
                              key={item.id}
                              onClick={() => toggleSelect(item.id)}
                              className="flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-all"
                              style={{
                                borderBottom: idx < (isExpanded ? items.length : Math.min(items.length, MAX_VISIBLE)) - 1
                                  ? '1px solid var(--t-linen)' : 'none',
                              }}
                            >
                              {/* Checkbox */}
                              <div
                                className="w-[18px] h-[18px] rounded flex items-center justify-center flex-shrink-0"
                                style={{
                                  background: isSelected ? 'var(--t-verde)' : 'white',
                                  border: isSelected ? 'none' : '1.5px solid var(--t-linen)',
                                }}
                              >
                                {isSelected && <span className="text-white text-[10px]">✓</span>}
                              </div>

                              {/* Name + note */}
                              <div className="flex-1 min-w-0">
                                <div className="text-[12px] font-semibold" style={{ color: 'var(--t-ink)' }}>
                                  {item.name}
                                </div>
                                {item.tasteNote && (
                                  <div
                                    className="text-[10px] truncate"
                                    style={{ color: 'rgba(28,26,23,0.5)' }}
                                  >
                                    &ldquo;{item.tasteNote}&rdquo;
                                  </div>
                                )}
                              </div>

                              {/* Match score */}
                              <span
                                className="text-[9px] font-semibold px-2 py-0.5 rounded-md flex-shrink-0"
                                style={{
                                  background: 'rgba(200,146,58,0.1)',
                                  color: 'var(--t-honey)',
                                  fontFamily: "'Space Mono', monospace",
                                }}
                              >
                                {item.matchScore}%
                              </span>
                            </div>
                          );
                        })}

                        {/* "Show more" row */}
                        {items.length > MAX_VISIBLE && !isExpanded && (
                          <button
                            onClick={() => setExpandedCategory(type)}
                            className="w-full py-2 text-center text-[10px] font-semibold cursor-pointer bg-transparent border-none"
                            style={{ color: 'var(--t-honey)' }}
                          >
                            + {items.length - MAX_VISIBLE} more {config.label.toLowerCase()}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Confirm button — dark bg, wireframe style */}
              <button
                onClick={handleConfirmImport}
                disabled={selectedIds.size === 0}
                className="w-full mt-6 py-3.5 rounded-2xl border-none cursor-pointer text-[14px] font-semibold transition-all"
                style={{
                  background: selectedIds.size > 0 ? 'var(--t-ink)' : 'rgba(28,26,23,0.1)',
                  color: selectedIds.size > 0 ? 'white' : 'rgba(28,26,23,0.3)',
                }}
              >
                Save {selectedIds.size} places to My Places
              </button>
              <p className="text-center text-[10px] mt-1.5 mb-2" style={{ color: 'rgba(28,26,23,0.4)' }}>
                Deselect any you don&apos;t want
              </p>

              {/* Back to import more */}
              <button
                onClick={() => { setStep('input'); setImportResults([]); }}
                className="w-full mt-1 py-2 bg-transparent border-none cursor-pointer text-[11px]"
                style={{ color: 'rgba(28,26,23,0.5)' }}
              >
                ← Import more
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

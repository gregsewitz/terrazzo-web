'use client';

import { useState, useMemo } from 'react';
import { useImportStore, ImportMode } from '@/stores/importStore';
import { useTripStore } from '@/stores/tripStore';
import { ImportedPlace, SOURCE_STYLES, GhostSourceType } from '@/types';

const IMPORT_MODES: { value: ImportMode; label: string; icon: string; description: string }[] = [
  { value: 'text', label: 'Paste Text', icon: '📝', description: "Paste a friend's list or notes" },
  { value: 'url', label: 'Paste URL', icon: '🔗', description: 'CN Traveller, YOLO Journal, etc.' },
  { value: 'google-maps', label: 'Google Maps', icon: '📍', description: 'Import from saved lists' },
  { value: 'email', label: 'Email Scan', icon: '✉️', description: 'Find booking confirmations' },
];

// Category config for grouping imported results
const CATEGORY_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  restaurant: { icon: '🍽', label: 'Restaurants', color: '#e87080' },
  hotel: { icon: '🏨', label: 'Hotels', color: '#6844a0' },
  bar: { icon: '🍸', label: 'Bars', color: '#c8923a' },
  cafe: { icon: '☕', label: 'Cafes', color: '#a06c28' },
  museum: { icon: '🏛', label: 'Museums', color: '#d63020' },
  activity: { icon: '⚡', label: 'Activities', color: '#2a7a56' },
  neighborhood: { icon: '🏘', label: 'Neighborhoods', color: '#5a9a6a' },
  shop: { icon: '🛍', label: 'Shops', color: '#e86830' },
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

interface ImportDrawerProps {
  onClose: () => void;
}

export default function ImportDrawer({ onClose }: ImportDrawerProps) {
  const {
    mode, setMode, inputValue, setInputValue,
    isProcessing, setProcessing, error, setError, emailConnected,
  } = useImportStore();
  const addToPool = useTripStore(s => s.addToPool);

  const [step, setStep] = useState<ImportStep>('input');
  const [importResults, setImportResults] = useState<ImportedPlace[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

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

  const selectAll = () => {
    setSelectedIds(new Set(importResults.map(r => r.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  async function handleImport() {
    if (!inputValue.trim() && mode !== 'email') return;
    setProcessing(true);
    setError(null);
    setStep('processing');

    try {
      const endpoint = mode === 'url' ? '/api/import/url' : mode === 'text' ? '/api/import/text' : '/api/email/scan';
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
        setStep('results');
      } else {
        setError('No places found in the content');
        setStep('input');
      }
    } catch {
      // For prototype: use demo results after a delay
      setTimeout(() => {
        setImportResults(DEMO_IMPORT_RESULTS);
        setSelectedIds(new Set(DEMO_IMPORT_RESULTS.map(r => r.id)));
        setStep('results');
        setProcessing(false);
      }, 1500);
      return;
    } finally {
      setProcessing(false);
    }
  }

  async function handleConnectEmail() {
    try {
      const res = await fetch('/api/auth/nylas/connect');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError('Failed to connect email');
    }
  }

  function handleConfirmImport() {
    const selected = importResults.filter(r => selectedIds.has(r.id));
    if (selected.length > 0) {
      addToPool(selected);
    }
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />

      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl overflow-y-auto"
        style={{ maxWidth: 480, margin: '0 auto', background: 'var(--t-cream)', maxHeight: '90vh' }}
      >
        <div className="flex justify-center pt-3 pb-1 sticky top-0" style={{ background: 'var(--t-cream)' }}>
          <div className="w-8 h-1 rounded-full" style={{ background: 'var(--t-travertine)' }} />
        </div>

        <div className="px-4 pb-8">
          {/* Step 1: Input */}
          {step === 'input' && (
            <>
              <h2
                className="text-lg mb-1 italic"
                style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}
              >
                Import Places
              </h2>
              <p className="text-[11px] mb-4" style={{ color: 'rgba(28,26,23,0.5)' }}>
                Bring in recommendations from anywhere
              </p>

              {/* Mode selector */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {IMPORT_MODES.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setMode(m.value)}
                    className="flex items-start gap-2 p-3 rounded-xl cursor-pointer text-left transition-all"
                    style={{
                      background: mode === m.value ? 'rgba(200,146,58,0.1)' : 'white',
                      border: mode === m.value ? '1.5px solid var(--t-honey)' : '1.5px solid var(--t-linen)',
                    }}
                  >
                    <span className="text-lg">{m.icon}</span>
                    <div>
                      <div className="text-[11px] font-semibold" style={{ color: 'var(--t-ink)' }}>{m.label}</div>
                      <div className="text-[9px] mt-0.5" style={{ color: 'rgba(28,26,23,0.5)' }}>{m.description}</div>
                    </div>
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
                  <textarea
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    placeholder={
                      mode === 'url'
                        ? 'Paste article URL (e.g. cntraveller.com/gallery/best-restaurants-lanzarote)'
                        : mode === 'google-maps'
                        ? 'Paste Google Maps list URL'
                        : "Paste your friend's recommendations...\n\ne.g. 'You have to go to Casa Caldera in Yaiza — the grilled octopus at sunset is unreal. And don't miss Jameos del Agua...'"
                    }
                    className="w-full h-32 p-3 rounded-xl text-[12px] resize-none border outline-none leading-relaxed"
                    style={{
                      background: 'white',
                      color: 'var(--t-ink)',
                      borderColor: 'var(--t-linen)',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  />
                  <button
                    onClick={handleImport}
                    disabled={isProcessing || !inputValue.trim()}
                    className="w-full mt-3 py-3 rounded-xl border-none cursor-pointer text-[13px] font-semibold transition-opacity"
                    style={{
                      background: 'var(--t-ink)',
                      color: 'var(--t-cream)',
                      opacity: isProcessing || !inputValue.trim() ? 0.4 : 1,
                    }}
                  >
                    {isProcessing ? 'Parsing...' : 'Extract Places'}
                  </button>
                </>
              )}

              {error && (
                <div className="mt-3 p-3 rounded-xl text-center" style={{ background: 'rgba(214,48,32,0.08)' }}>
                  <span className="text-[12px]" style={{ color: 'var(--t-signal-red)' }}>{error}</span>
                </div>
              )}
            </>
          )}

          {/* Step 2: Processing animation */}
          {step === 'processing' && (
            <div className="flex flex-col items-center py-12 gap-4">
              <div className="text-4xl ghost-shimmer">✦</div>
              <h3
                className="text-sm italic"
                style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}
              >
                Reading between the lines...
              </h3>
              <p className="text-[11px] text-center" style={{ color: 'rgba(28,26,23,0.5)' }}>
                Extracting places, matching to your taste profile,<br />
                and pulling in Google Places data
              </p>
              {/* Shimmer placeholder cards */}
              <div className="w-full space-y-2 mt-4">
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    className="h-14 rounded-xl ghost-shimmer"
                    style={{
                      background: 'rgba(28,26,23,0.04)',
                      animationDelay: `${i * 0.3}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Results with category grouping */}
          {step === 'results' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2
                    className="text-lg italic"
                    style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}
                  >
                    Found {importResults.length} places
                  </h2>
                  <p className="text-[11px]" style={{ color: 'rgba(28,26,23,0.5)' }}>
                    {selectedIds.size} selected to import
                  </p>
                </div>
                <button
                  onClick={selectedIds.size === importResults.length ? deselectAll : selectAll}
                  className="text-[11px] font-medium px-3 py-1 rounded-full border cursor-pointer"
                  style={{
                    borderColor: 'var(--t-linen)',
                    color: 'var(--t-ink)',
                    background: 'white',
                    fontFamily: "'Space Mono', monospace",
                  }}
                >
                  {selectedIds.size === importResults.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              {/* Category groups */}
              <div className="space-y-3">
                {groupedResults.map(([type, items]) => {
                  const config = CATEGORY_CONFIG[type] || { icon: '📍', label: type, color: '#6b8b9a' };
                  const isExpanded = expandedCategory === type || expandedCategory === null;
                  const selectedInGroup = items.filter(i => selectedIds.has(i.id)).length;

                  return (
                    <div key={type}>
                      {/* Category header */}
                      <button
                        onClick={() => setExpandedCategory(expandedCategory === type ? null : type)}
                        className="w-full flex items-center gap-2 py-2 bg-transparent border-none cursor-pointer"
                      >
                        <span>{config.icon}</span>
                        <span
                          className="text-[11px] font-bold uppercase tracking-wider"
                          style={{ color: config.color, fontFamily: "'Space Mono', monospace" }}
                        >
                          {config.label}
                        </span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ background: `${config.color}15`, color: config.color, fontFamily: "'Space Mono', monospace" }}
                        >
                          {selectedInGroup}/{items.length}
                        </span>
                        <span className="ml-auto text-[10px]" style={{ color: 'rgba(28,26,23,0.3)' }}>
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      </button>

                      {/* Items in category */}
                      {isExpanded && (
                        <div className="space-y-2 ml-1">
                          {items.map(item => {
                            const isSelected = selectedIds.has(item.id);
                            const srcStyle = item.ghostSource ? SOURCE_STYLES[item.ghostSource as GhostSourceType] : null;

                            return (
                              <div
                                key={item.id}
                                onClick={() => toggleSelect(item.id)}
                                className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all"
                                style={{
                                  background: isSelected ? 'white' : 'rgba(28,26,23,0.02)',
                                  border: isSelected ? '1.5px solid var(--t-verde)' : '1.5px solid var(--t-linen)',
                                  opacity: isSelected ? 1 : 0.6,
                                }}
                              >
                                {/* Checkbox */}
                                <div
                                  className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                                  style={{
                                    background: isSelected ? 'var(--t-verde)' : 'white',
                                    border: isSelected ? 'none' : '1.5px solid var(--t-linen)',
                                  }}
                                >
                                  {isSelected && <span className="text-white text-[10px]">✓</span>}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="text-[13px] font-semibold" style={{ color: 'var(--t-ink)' }}>
                                      {item.name}
                                    </h4>
                                    <span
                                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                      style={{
                                        background: 'rgba(200,146,58,0.12)',
                                        color: 'var(--t-honey)',
                                        fontFamily: "'Space Mono', monospace",
                                      }}
                                    >
                                      {item.matchScore}%
                                    </span>
                                  </div>
                                  <p className="text-[10px] mb-1" style={{ color: 'rgba(28,26,23,0.5)' }}>
                                    {item.location}
                                  </p>
                                  {item.tasteNote && (
                                    <p className="text-[11px] italic leading-snug" style={{ color: 'rgba(28,26,23,0.6)' }}>
                                      &ldquo;{item.tasteNote}&rdquo;
                                    </p>
                                  )}
                                  {srcStyle && (
                                    <div
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] mt-1.5"
                                      style={{ background: srcStyle.bg, color: srcStyle.color }}
                                    >
                                      {srcStyle.icon} {srcStyle.label}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Confirm import button */}
              <button
                onClick={handleConfirmImport}
                disabled={selectedIds.size === 0}
                className="w-full mt-6 py-3.5 rounded-xl border-none cursor-pointer text-[13px] font-semibold transition-all sticky bottom-4"
                style={{
                  background: selectedIds.size > 0 ? 'var(--t-verde)' : 'rgba(28,26,23,0.1)',
                  color: selectedIds.size > 0 ? 'white' : 'rgba(28,26,23,0.3)',
                }}
              >
                Import {selectedIds.size} {selectedIds.size === 1 ? 'place' : 'places'}
              </button>

              {/* Back to edit */}
              <button
                onClick={() => { setStep('input'); setImportResults([]); }}
                className="w-full mt-2 py-2 bg-transparent border-none cursor-pointer text-[11px]"
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

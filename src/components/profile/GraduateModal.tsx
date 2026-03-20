'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTripStore } from '@/stores/tripStore';
import DestinationAllocator from '@/components/trip/DestinationAllocator';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT } from '@/constants/theme';
import {
  analyzeDreamBoard,
  getActionableEntries,
  type AnalysisResult,
  type AnalyzedEntry,
} from '@/lib/dream-board-analysis';

interface GraduateModalProps {
  onClose: () => void;
}

// ─── Category display config ─────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  google_maps_place: { icon: 'location', label: 'Google Maps place', color: 'var(--t-dark-teal)' },
  google_maps_list:  { icon: 'location', label: 'Google Maps list', color: 'var(--t-dark-teal)' },
  article_link:      { icon: 'discover', label: 'Article', color: 'var(--t-coral)' },
  booking_link:      { icon: 'hotel', label: 'Booking', color: '#8a6a2a' },
  place_reference:   { icon: 'restaurant', label: 'Places', color: 'var(--t-dark-teal)' },
  confirmation:      { icon: 'check', label: 'Confirmation', color: '#2a8a4a' },
};

export default function GraduateModal({ onClose }: GraduateModalProps) {
  // Use stable selectors
  const trips = useTripStore(s => s.trips);
  const currentTripId = useTripStore(s => s.currentTripId);
  const trip = useMemo(() => trips.find(t => t.id === currentTripId), [trips, currentTripId]);
  const graduateToPlanning = useTripStore(s => s.graduateToPlanning);
  const getDreamBoardEntries = useTripStore(s => s.getDreamBoardEntries);

  const [flexibleDates, setFlexibleDates] = useState(false);
  const [numDays, setNumDays] = useState('5');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [step, setStep] = useState<'dates' | 'allocate' | 'review'>('dates');

  // Dream board analysis state
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResults, setAiResults] = useState<{
    extractedPlaces?: Array<{ entryIndex: number; names: string[]; type: string; confidence: number; context: string }>;
    bookings?: Array<{ entryIndex: number; placeName: string; confirmationCode?: string; date?: string; time?: string; type: string }>;
  } | null>(null);

  const destinations = trip?.destinations || [];
  const isMultiCity = destinations.length > 1;

  // Calculate total nights
  const totalNights = useMemo(() => {
    if (flexibleDates) return Math.max(1, parseInt(numDays) || 5);
    if (!startDate || !endDate) return 0;
    const s = new Date(startDate + 'T00:00:00');
    const e = new Date(endDate + 'T00:00:00');
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
  }, [flexibleDates, numDays, startDate, endDate]);

  // Multi-city allocation
  const [allocation, setAllocation] = useState<Record<string, number>>({});

  const initAllocation = () => {
    if (totalNights <= 0 || destinations.length === 0) return;
    const perDest = Math.floor(totalNights / destinations.length);
    const remainder = totalNights - perDest * destinations.length;
    const alloc: Record<string, number> = {};
    destinations.forEach((dest, i) => {
      alloc[dest] = perDest + (i < remainder ? 1 : 0);
    });
    setAllocation(alloc);
  };

  const canProceed = flexibleDates ? totalNights > 0 : (startDate && endDate && totalNights > 0);
  const flexOpts = flexibleDates ? { flexibleDates: true, numDays: totalNights } : undefined;

  // ─── Analyze dream board when entering review step ──────────────────────

  const runAnalysis = useCallback(() => {
    const entries = getDreamBoardEntries();
    if (!entries.length) return null;

    const result = analyzeDreamBoard(entries);
    setAnalysis(result);

    // Pre-select all actionable entries
    const actionable = getActionableEntries(result);
    setSelectedEntries(new Set(actionable.map(e => e.entry.id)));

    // Fire off AI analysis in background for deeper extraction
    if (currentTripId && entries.length > 0) {
      setAiAnalyzing(true);
      fetch(`/api/trips/${currentTripId}/analyze-dream-board`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries,
          destination: trip?.location || destinations[0] || 'unknown',
        }),
      })
        .then(r => r.json())
        .then(data => {
          setAiResults(data);
          // Auto-select any newly discovered place entries from AI
          if (data.extractedPlaces?.length) {
            setSelectedEntries(prev => {
              const next = new Set(prev);
              data.extractedPlaces.forEach((ep: { entryIndex: number }) => {
                const entry = entries[ep.entryIndex];
                if (entry) next.add(entry.id);
              });
              return next;
            });
          }
        })
        .catch(() => {})
        .finally(() => setAiAnalyzing(false));
    }

    return result;
  }, [getDreamBoardEntries, currentTripId, trip?.location, destinations]);

  // ─── Step transitions ──────────────────────────────────────────────────

  const dreamBoardEntries = useMemo(() => getDreamBoardEntries(), [getDreamBoardEntries]);
  const hasDreamBoardContent = dreamBoardEntries.length > 0;

  const handleDatesNext = () => {
    if (!canProceed) return;
    if (isMultiCity) {
      initAllocation();
      setStep('allocate');
    } else if (hasDreamBoardContent) {
      runAnalysis();
      setStep('review');
    } else {
      graduateToPlanning(startDate, endDate, undefined, flexOpts);
      onClose();
    }
  };

  const handleAllocateNext = () => {
    if (hasDreamBoardContent) {
      runAnalysis();
      setStep('review');
    } else {
      graduateToPlanning(startDate, endDate, allocation, flexOpts);
      onClose();
    }
  };

  const handleBuildItinerary = () => {
    graduateToPlanning(
      startDate,
      endDate,
      isMultiCity ? allocation : undefined,
      flexOpts,
    );
    onClose();

    // TODO: After graduation, trigger import for selected entries
    // This will be handled by a follow-up that watches for graduation
    // and processes selected entries through the import pipeline
  };

  const toggleEntry = (entryId: string) => {
    setSelectedEntries(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  // ─── Header title ─────────────────────────────────────────────────────

  const headerTitle = step === 'dates'
    ? 'Set Your Dates'
    : step === 'allocate'
    ? 'Allocate Nights'
    : 'Review Your Notes';

  const headerIcon = step === 'review' ? 'star' : 'pin';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,42,85,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-4 rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--t-cream)', maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--t-linen)' }}
        >
          <div className="flex items-center gap-2">
            <PerriandIcon name={headerIcon as 'pin' | 'star'} size={18} color="var(--t-dark-teal)" />
            <h2
              className="text-lg"
              style={{ fontFamily: FONT.serif, fontStyle: 'italic', color: TEXT.primary, margin: 0 }}
            >
              {headerTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center border-none cursor-pointer nav-hover"
            style={{ background: INK['06'], color: TEXT.secondary }}
            aria-label="Close"
          >
            <PerriandIcon name="close" size={14} color={TEXT.secondary} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-5 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 130px)' }}>
          {step === 'dates' ? (
            <>
              <p className="text-[13px] leading-relaxed mb-5" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>
                Your dreaming trip is ready to become real.
                Pick your travel dates and we&apos;ll build your itinerary.
              </p>

              {/* Date inputs */}
              <div className="mb-6">
                <label
                  className="block text-[9px] font-bold uppercase tracking-[2.5px] mb-2"
                  style={{ fontFamily: FONT.mono, color: TEXT.primary }}
                >
                  WHEN ARE YOU GOING?
                </label>

                {/* Flexible toggle */}
                <div className="flex gap-2 mb-3">
                  {([
                    { key: false, label: 'Specific dates' },
                    { key: true, label: 'Flexible / undecided' },
                  ] as const).map(opt => (
                    <button
                      key={String(opt.key)}
                      onClick={() => setFlexibleDates(opt.key)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-full border cursor-pointer transition-all text-[11px]"
                      style={{
                        background: flexibleDates === opt.key ? TEXT.primary : 'white',
                        color: flexibleDates === opt.key ? TEXT.inverse : TEXT.primary,
                        borderColor: flexibleDates === opt.key ? TEXT.primary : 'var(--t-linen)',
                        fontFamily: FONT.sans,
                        fontWeight: 500,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {flexibleDates ? (
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={numDays}
                      onChange={e => setNumDays(e.target.value)}
                      className="w-20 text-center text-sm pb-2.5 bg-transparent border-0 border-b outline-none"
                      style={{
                        fontFamily: FONT.sans,
                        color: TEXT.primary,
                        borderColor: 'var(--t-linen)',
                      }}
                    />
                    <span className="text-[12px]" style={{ color: TEXT.primary, fontFamily: FONT.sans }}>
                      nights
                    </span>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <input
                        type="date"
                        value={startDate}
                        onChange={e => {
                          const newStart = e.target.value;
                          setStartDate(newStart);
                          if (newStart && (!endDate || endDate <= newStart)) {
                            const next = new Date(newStart + 'T00:00:00');
                            next.setDate(next.getDate() + 1);
                            setEndDate(next.toISOString().split('T')[0]);
                          }
                        }}
                        className="w-full text-sm pb-2.5 bg-transparent border-0 border-b outline-none"
                        style={{
                          fontFamily: FONT.sans,
                          color: TEXT.primary,
                          borderColor: 'var(--t-linen)',
                        }}
                      />
                      <span className="text-[9px] mt-1 block" style={{ color: TEXT.primary }}>Start</span>
                    </div>
                    <div className="flex items-center text-xs" style={{ color: TEXT.primary }}>→</div>
                    <div className="flex-1">
                      <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        min={startDate || undefined}
                        className="w-full text-sm pb-2.5 bg-transparent border-0 border-b outline-none"
                        style={{
                          fontFamily: FONT.sans,
                          color: TEXT.primary,
                          borderColor: 'var(--t-linen)',
                        }}
                      />
                      <span className="text-[9px] mt-1 block" style={{ color: TEXT.secondary }}>End</span>
                    </div>
                  </div>
                )}

                {totalNights > 0 && (
                  <div
                    className="mt-3 text-[12px] font-medium"
                    style={{ color: 'var(--t-dark-teal)', fontFamily: FONT.sans }}
                  >
                    {totalNights} night{totalNights !== 1 ? 's' : ''}
                    {isMultiCity && ` across ${destinations.length} destinations`}
                  </div>
                )}
              </div>
            </>
          ) : step === 'allocate' ? (
            <>
              <p className="text-[13px] leading-relaxed mb-4" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>
                Distribute your {totalNights} nights across destinations. You can always adjust later.
              </p>

              <DestinationAllocator
                destinations={destinations}
                totalNights={totalNights}
                allocation={allocation}
                onChange={setAllocation}
              />
            </>
          ) : (
            /* ── Review step: show extracted dream board content ── */
            <>
              <p className="text-[13px] leading-relaxed mb-4" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>
                We found some things in your dream board that might be useful for planning. Select what you&apos;d like to bring into your itinerary.
              </p>

              {/* Summary badges */}
              {analysis && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {analysis.summary.placeLinks > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ background: 'rgba(58,128,136,0.1)', color: 'var(--t-dark-teal)', fontFamily: FONT.mono }}>
                      {analysis.summary.placeLinks} map link{analysis.summary.placeLinks !== 1 ? 's' : ''}
                    </span>
                  )}
                  {analysis.summary.articleLinks > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ background: 'rgba(238,113,109,0.1)', color: 'var(--t-coral)', fontFamily: FONT.mono }}>
                      {analysis.summary.articleLinks} article{analysis.summary.articleLinks !== 1 ? 's' : ''}
                    </span>
                  )}
                  {analysis.summary.confirmations > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ background: 'rgba(42,138,74,0.1)', color: '#2a8a4a', fontFamily: FONT.mono }}>
                      {analysis.summary.confirmations} confirmation{analysis.summary.confirmations !== 1 ? 's' : ''}
                    </span>
                  )}
                  {analysis.summary.placeReferences > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ background: 'rgba(58,128,136,0.1)', color: 'var(--t-dark-teal)', fontFamily: FONT.mono }}>
                      {analysis.summary.placeReferences} place list{analysis.summary.placeReferences !== 1 ? 's' : ''}
                    </span>
                  )}
                  {aiAnalyzing && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium animate-pulse"
                      style={{ background: INK['06'], color: TEXT.secondary, fontFamily: FONT.mono }}>
                      analyzing...
                    </span>
                  )}
                </div>
              )}

              {/* Actionable entries list */}
              <div className="flex flex-col gap-2 mb-3">
                {analysis?.entries
                  .filter(e => e.meta.actionable)
                  .map(analyzed => {
                    const config = CATEGORY_CONFIG[analyzed.category];
                    const isSelected = selectedEntries.has(analyzed.entry.id);
                    const displayContent = analyzed.entry.title || analyzed.entry.content;
                    const truncated = displayContent.length > 80
                      ? displayContent.slice(0, 80) + '...'
                      : displayContent;

                    return (
                      <button
                        key={analyzed.entry.id}
                        onClick={() => toggleEntry(analyzed.entry.id)}
                        className="flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all text-left w-full"
                        style={{
                          background: isSelected ? 'white' : INK['02'],
                          borderColor: isSelected ? (config?.color || 'var(--t-dark-teal)') : 'transparent',
                          opacity: isSelected ? 1 : 0.6,
                        }}
                      >
                        {/* Checkbox */}
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{
                            background: isSelected ? (config?.color || 'var(--t-dark-teal)') : 'transparent',
                            border: `1.5px solid ${isSelected ? (config?.color || 'var(--t-dark-teal)') : INK['30']}`,
                          }}
                        >
                          {isSelected && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {config && (
                              <PerriandIcon name={config.icon as 'location'} size={12} color={config.color} />
                            )}
                            <span className="text-[10px] font-bold uppercase tracking-[1px]"
                              style={{ color: config?.color || TEXT.secondary, fontFamily: FONT.mono }}>
                              {config?.label || analyzed.category}
                            </span>
                          </div>
                          <div className="text-[12px] leading-snug" style={{ color: TEXT.primary, fontFamily: FONT.sans }}>
                            {truncated}
                          </div>
                          {analyzed.meta.suggestedAction && (
                            <div className="text-[10px] mt-1" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>
                              {analyzed.meta.suggestedAction}
                            </div>
                          )}
                          {/* Show AI-discovered places for this entry */}
                          {aiResults?.extractedPlaces
                            ?.filter(ep => {
                              const entries = getDreamBoardEntries();
                              return entries[ep.entryIndex]?.id === analyzed.entry.id;
                            })
                            .map((ep, i) => (
                              <div key={i} className="flex flex-wrap gap-1 mt-1.5">
                                {ep.names.map((name, j) => (
                                  <span key={j} className="px-1.5 py-0.5 rounded text-[9px]"
                                    style={{ background: 'rgba(58,128,136,0.08)', color: 'var(--t-dark-teal)', fontFamily: FONT.mono }}>
                                    {name}
                                  </span>
                                ))}
                              </div>
                            ))
                          }
                          {/* Show AI-discovered bookings for this entry */}
                          {aiResults?.bookings
                            ?.filter(b => {
                              const entries = getDreamBoardEntries();
                              return entries[b.entryIndex]?.id === analyzed.entry.id;
                            })
                            .map((b, i) => (
                              <div key={i} className="flex items-center gap-1.5 mt-1.5">
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium"
                                  style={{ background: 'rgba(42,138,74,0.08)', color: '#2a8a4a', fontFamily: FONT.mono }}>
                                  {b.placeName}
                                  {b.confirmationCode && ` · ${b.confirmationCode}`}
                                  {b.date && ` · ${b.date}`}
                                  {b.time && ` @ ${b.time}`}
                                </span>
                              </div>
                            ))
                          }
                        </div>
                      </button>
                    );
                  })
                }
              </div>

              {/* Non-actionable entries summary */}
              {analysis && analysis.summary.generalNotes > 0 && (
                <div className="text-[11px] py-2 px-3 rounded-lg" style={{ background: INK['04'], color: TEXT.secondary, fontFamily: FONT.sans }}>
                  {analysis.summary.generalNotes} note{analysis.summary.generalNotes !== 1 ? 's' : ''} will be kept in your Dream Board for reference during planning.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-4 flex gap-2"
          style={{ borderTop: '1px solid var(--t-linen)' }}
        >
          {(step === 'allocate' || step === 'review') && (
            <button
              onClick={() => {
                if (step === 'review' && isMultiCity) setStep('allocate');
                else if (step === 'review') setStep('dates');
                else setStep('dates');
              }}
              className="px-5 py-3 rounded-full border cursor-pointer text-[13px] font-medium"
              style={{
                background: 'transparent',
                borderColor: 'var(--t-linen)',
                color: TEXT.secondary,
                fontFamily: FONT.sans,
              }}
            >
              ← Back
            </button>
          )}
          <button
            onClick={
              step === 'dates'
                ? handleDatesNext
                : step === 'allocate'
                ? handleAllocateNext
                : handleBuildItinerary
            }
            disabled={step === 'dates' ? !canProceed : false}
            className="flex-1 py-3 rounded-full border-none cursor-pointer text-[14px] font-semibold disabled:opacity-30 transition-all"
            style={{
              background: TEXT.primary,
              color: TEXT.inverse,
              fontFamily: FONT.sans,
            }}
          >
            {step === 'dates'
              ? (isMultiCity ? 'Next: Allocate Nights' : (hasDreamBoardContent ? 'Next: Review Notes' : 'Build My Itinerary'))
              : step === 'allocate'
              ? (hasDreamBoardContent ? 'Next: Review Notes' : 'Build My Itinerary')
              : `Build My Itinerary${selectedEntries.size > 0 ? ` (${selectedEntries.size} items)` : ''}`
            }
          </button>
        </div>
      </div>
    </div>
  );
}

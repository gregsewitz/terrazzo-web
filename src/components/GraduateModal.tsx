'use client';

import { useState, useMemo } from 'react';
import { useTripStore } from '@/stores/tripStore';
import DestinationAllocator from '@/components/DestinationAllocator';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';

interface GraduateModalProps {
  onClose: () => void;
}

export default function GraduateModal({ onClose }: GraduateModalProps) {
  // Use stable selectors — calling store methods in selectors returns new refs every render
  const trips = useTripStore(s => s.trips);
  const currentTripId = useTripStore(s => s.currentTripId);
  const trip = useMemo(() => trips.find(t => t.id === currentTripId), [trips, currentTripId]);
  const graduateToPlanning = useTripStore(s => s.graduateToPlanning);
  const [flexibleDates, setFlexibleDates] = useState(false);
  const [numDays, setNumDays] = useState('5');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [step, setStep] = useState<'dates' | 'allocate'>('dates');

  const destinations = trip?.destinations || [];
  const isMultiCity = destinations.length > 1;

  // Calculate total days
  const totalDays = useMemo(() => {
    if (flexibleDates) return Math.max(1, parseInt(numDays) || 5);
    if (!startDate || !endDate) return 0;
    const s = new Date(startDate + 'T00:00:00');
    const e = new Date(endDate + 'T00:00:00');
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  }, [flexibleDates, numDays, startDate, endDate]);

  // Initialize allocation for multi-city
  const [allocation, setAllocation] = useState<Record<string, number>>({});

  const initAllocation = () => {
    if (totalDays <= 0 || destinations.length === 0) return;
    const perDest = Math.floor(totalDays / destinations.length);
    const remainder = totalDays - perDest * destinations.length;
    const alloc: Record<string, number> = {};
    destinations.forEach((dest, i) => {
      alloc[dest] = perDest + (i < remainder ? 1 : 0);
    });
    setAllocation(alloc);
  };

  const canProceed = flexibleDates ? totalDays > 0 : (startDate && endDate && totalDays > 0);

  const flexOpts = flexibleDates ? { flexibleDates: true, numDays: totalDays } : undefined;

  const handleDatesNext = () => {
    if (!canProceed) return;
    if (isMultiCity) {
      initAllocation();
      setStep('allocate');
    } else {
      graduateToPlanning(startDate, endDate, undefined, flexOpts);
      onClose();
    }
  };

  const handleAllocateComplete = () => {
    graduateToPlanning(startDate, endDate, allocation, flexOpts);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(28,26,23,0.5)' }}
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
            <PerriandIcon name="pin" size={18} color="var(--t-verde)" />
            <h2
              className="text-lg"
              style={{ fontFamily: FONT.serif, fontStyle: 'italic', color: 'var(--t-ink)', margin: 0 }}
            >
              {step === 'dates' ? 'Set Your Dates' : 'Allocate Days'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center border-none cursor-pointer nav-hover"
            style={{ background: INK['06'], color: INK['50'] }}
          >
            <PerriandIcon name="close" size={14} color={INK['50']} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-5 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 130px)' }}>
          {step === 'dates' ? (
            <>
              <p className="text-[13px] leading-relaxed mb-5" style={{ color: INK['60'], fontFamily: FONT.sans }}>
                Your dreaming trip is ready to become real.
                Pick your travel dates and we'll build your itinerary.
              </p>

              {/* Date inputs */}
              <div className="mb-6">
                <label
                  className="block text-[9px] font-bold uppercase tracking-[2.5px] mb-2"
                  style={{ fontFamily: FONT.mono, color: INK['90'] }}
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
                        background: flexibleDates === opt.key ? 'var(--t-ink)' : 'white',
                        color: flexibleDates === opt.key ? 'white' : 'var(--t-ink)',
                        borderColor: flexibleDates === opt.key ? 'var(--t-ink)' : 'var(--t-linen)',
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
                        color: 'var(--t-ink)',
                        borderColor: 'var(--t-linen)',
                      }}
                    />
                    <span className="text-[12px]" style={{ color: INK['90'], fontFamily: FONT.sans }}>
                      days
                    </span>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="w-full text-sm pb-2.5 bg-transparent border-0 border-b outline-none"
                        style={{
                          fontFamily: FONT.sans,
                          color: startDate ? 'var(--t-ink)' : INK['90'],
                          borderColor: 'var(--t-linen)',
                        }}
                      />
                      <span className="text-[9px] mt-1 block" style={{ color: INK['95'] }}>Start</span>
                    </div>
                    <div className="flex items-center text-xs" style={{ color: INK['95'] }}>→</div>
                    <div className="flex-1">
                      <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        min={startDate || undefined}
                        className="w-full text-sm pb-2.5 bg-transparent border-0 border-b outline-none"
                        style={{
                          fontFamily: FONT.sans,
                          color: endDate ? 'var(--t-ink)' : INK['90'],
                          borderColor: 'var(--t-linen)',
                        }}
                      />
                      <span className="text-[9px] mt-1 block" style={{ color: INK['95'] }}>End</span>
                    </div>
                  </div>
                )}

                {totalDays > 0 && (
                  <div
                    className="mt-3 text-[12px] font-medium"
                    style={{ color: 'var(--t-verde)', fontFamily: FONT.sans }}
                  >
                    {totalDays} day{totalDays !== 1 ? 's' : ''}
                    {isMultiCity && ` across ${destinations.length} destinations`}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-[13px] leading-relaxed mb-4" style={{ color: INK['60'], fontFamily: FONT.sans }}>
                Distribute your {totalDays} days across destinations. You can always adjust later.
              </p>

              <DestinationAllocator
                destinations={destinations}
                totalDays={totalDays}
                allocation={allocation}
                onChange={setAllocation}
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-4 flex gap-2"
          style={{ borderTop: '1px solid var(--t-linen)' }}
        >
          {step === 'allocate' && (
            <button
              onClick={() => setStep('dates')}
              className="px-5 py-3 rounded-full border cursor-pointer text-[13px] font-medium"
              style={{
                background: 'transparent',
                borderColor: 'var(--t-linen)',
                color: INK['60'],
                fontFamily: FONT.sans,
              }}
            >
              ← Back
            </button>
          )}
          <button
            onClick={step === 'dates' ? handleDatesNext : handleAllocateComplete}
            disabled={!canProceed}
            className="flex-1 py-3 rounded-full border-none cursor-pointer text-[14px] font-semibold disabled:opacity-30 transition-all"
            style={{
              background: 'var(--t-ink)',
              color: 'white',
              fontFamily: FONT.sans,
            }}
          >
            {step === 'dates'
              ? (isMultiCity ? 'Next: Allocate Days' : 'Build My Itinerary')
              : 'Build My Itinerary'
            }
          </button>
        </div>
      </div>
    </div>
  );
}

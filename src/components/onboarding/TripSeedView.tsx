'use client';

import { useState } from 'react';
import type { SeedTripInput, TravelContext, GeoDestination } from '@/types';
import { useOnboardingStore } from '@/stores/onboardingStore';
import DestinationInput, { type Destination } from '@/components/DestinationInput';
import { FONT, INK } from '@/constants/theme';

interface TripSeedViewProps {
  onComplete: () => void;
}

type SeedStep = 'planning' | 'dream' | 'done';

export default function TripSeedView({ onComplete }: TripSeedViewProps) {
  const [step, setStep] = useState<SeedStep>('planning');
  const [tripName, setTripName] = useState('');
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [dates, setDates] = useState('');
  const [context, setContext] = useState<TravelContext>('partner');
  const addSeedTrip = useOnboardingStore((s) => s.addSeedTrip);

  const isDreaming = step === 'dream';

  // Auto-generate a trip name from destinations if the user hasn't typed one
  const effectiveName = tripName.trim() ||
    (destinations.length > 0
      ? destinations.map(d => d.name).join(' & ')
      : '');

  const canSubmit = destinations.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;

    const geoDestinations: GeoDestination[] = destinations.map(d => ({
      name: d.name,
      placeId: d.placeId,
      lat: d.lat,
      lng: d.lng,
      formattedAddress: d.formattedAddress,
    }));

    const trip: SeedTripInput = {
      name: effectiveName,
      destinations: geoDestinations,
      dates: dates.trim() || undefined,
      travelContext: context,
      status: isDreaming ? 'dreaming' : 'planning',
      seedSource: isDreaming ? 'onboarding_dream' : 'onboarding_planning',
      rawUserInput: `${effectiveName}${dates ? `, ${dates}` : ''}`,
    };
    addSeedTrip(trip);

    // Reset for next step
    setTripName('');
    setDestinations([]);
    setDates('');

    if (isDreaming) {
      setStep('done');
      setTimeout(onComplete, 300);
    } else {
      setStep('dream');
    }
  };

  const handleSkipDream = () => {
    setStep('done');
    setTimeout(onComplete, 200);
  };

  const isPlanning = step === 'planning';

  return (
    <div className="flex flex-col h-full px-5 py-6">
      {/* Header */}
      <div className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--t-ink)]/40 mb-2">
          {isPlanning ? 'Trip you\'re planning' : 'Dream trip'}
        </p>
        <h2 className="font-serif text-[26px] text-[var(--t-ink)] leading-tight">
          {isPlanning
            ? 'Do you have a trip coming up?'
            : 'What about a trip you\'ve always dreamed of?'
          }
        </h2>
        <p className="text-[14px] text-[var(--t-ink)]/50 mt-2">
          {isPlanning
            ? 'Add one or more destinations — we\'ll build your itinerary from there.'
            : 'The one that\'s been on your list forever.'
          }
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 space-y-5">
        {/* Trip name (optional) */}
        <div>
          <label className="block text-[12px] font-mono uppercase tracking-wider text-[var(--t-ink)]/40 mb-1.5">
            Trip name (optional)
          </label>
          <input
            type="text"
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
            placeholder={destinations.length > 0
              ? destinations.map(d => d.name).join(' & ')
              : 'e.g., Family Ireland Trip'
            }
            className="w-full bg-transparent border-b-2 border-[var(--t-travertine)] focus:border-[var(--t-honey)]
              text-[17px] text-[var(--t-ink)] placeholder:text-[var(--t-ink)]/25
              outline-none py-2 transition-colors"
            style={{ fontFamily: FONT.sans }}
          />
        </div>

        {/* Destinations (Google autocomplete) */}
        <div>
          <label className="block text-[12px] font-mono uppercase tracking-wider text-[var(--t-ink)]/40 mb-1.5">
            Where?
          </label>
          <DestinationInput
            destinations={destinations}
            onChange={setDestinations}
            isDreaming={isDreaming}
          />
        </div>

        {/* When */}
        <div>
          <label className="block text-[12px] font-mono uppercase tracking-wider text-[var(--t-ink)]/40 mb-1.5">
            When? (optional)
          </label>
          <input
            type="text"
            value={dates}
            onChange={(e) => setDates(e.target.value)}
            placeholder="e.g., September 2025, or just 'fall'"
            className="w-full bg-transparent border-b-2 border-[var(--t-travertine)] focus:border-[var(--t-honey)]
              text-[15px] text-[var(--t-ink)] placeholder:text-[var(--t-ink)]/25
              outline-none py-2 transition-colors"
            style={{ fontFamily: FONT.sans }}
          />
        </div>

        {/* Who with */}
        <div>
          <label className="block text-[12px] font-mono uppercase tracking-wider text-[var(--t-ink)]/40 mb-1.5">
            Who with?
          </label>
          <div className="flex gap-2 flex-wrap">
            {(['solo', 'partner', 'friends', 'family'] as TravelContext[]).map((c) => (
              <button
                key={c}
                onClick={() => setContext(c)}
                className={`
                  px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-all
                  ${context === c
                    ? 'border-[var(--t-ink)] bg-[var(--t-ink)] text-[var(--t-cream)]'
                    : 'border-[var(--t-travertine)] text-[var(--t-ink)] hover:border-[var(--t-honey)]'
                  }
                `}
              >
                {c === 'solo' ? 'Solo' : c === 'partner' ? 'Partner' : c === 'friends' ? 'Friends' : 'Family'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 mt-4">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-3 rounded-xl text-[14px] font-medium text-white transition-all
            hover:opacity-90 active:scale-[0.98] disabled:opacity-30"
          style={{ backgroundColor: 'var(--t-ink)' }}
        >
          {isPlanning ? 'Save & add dream trip' : 'Save dream trip'}
        </button>

        {isDreaming && (
          <button
            onClick={handleSkipDream}
            className="w-full py-2 text-[13px] text-[var(--t-ink)]/40 hover:text-[var(--t-ink)]/60 transition-colors"
          >
            Skip — I don&apos;t have one right now
          </button>
        )}

        {isPlanning && (
          <button
            onClick={() => { setStep('dream'); }}
            className="w-full py-2 text-[13px] text-[var(--t-ink)]/40 hover:text-[var(--t-ink)]/60 transition-colors"
          >
            Nothing planned right now — skip to dream trip
          </button>
        )}
      </div>
    </div>
  );
}

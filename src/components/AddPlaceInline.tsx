'use client';

import React, { useState } from 'react';
import { useTripStore } from '@/stores/tripStore';
import { useSavedStore } from '@/stores/savedStore';
import { ImportedPlace } from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import PlaceSearchInput, { type PlaceSearchResult } from './PlaceSearchInput';

interface AddPlaceInlineProps {
  /** Destination hint for the search input (e.g. "Cotswolds") */
  destination?: string;
  /** Layout variant: 'rail' = vertical list button, 'strip' = compact thumbnail card */
  variant: 'rail' | 'strip';
}

/**
 * Shared "Add a place" inline component.
 * Renders a button that expands into a PlaceSearchInput.
 * Used by both PicksRail (desktop) and PicksStrip (mobile).
 */
function AddPlaceInline({ destination, variant }: AddPlaceInlineProps) {
  const [showSearch, setShowSearch] = useState(false);
  const addPlace = useSavedStore(s => s.addPlace);

  const handleSelect = (result: PlaceSearchResult) => {
    const newPlace: ImportedPlace = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: result.name,
      type: result.type,
      location: result.address || destination || '',
      source: { type: 'text', name: 'Manual' },
      matchScore: 0,
      matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0 },
      tasteNote: '',
      status: 'available',
      isFavorited: true,
      ...(result.placeId && {
        google: {
          placeId: result.placeId,
          lat: result.lat,
          lng: result.lng,
          address: result.address,
        },
      }),
    };
    addPlace(newPlace);
    setShowSearch(false);
  };

  if (variant === 'strip') {
    // ─── Mobile strip: compact vertical card ───
    if (showSearch) {
      return (
        <div
          className="flex-shrink-0 rounded-xl overflow-hidden"
          style={{
            minWidth: 220,
            background: 'white',
            border: '1.5px dashed var(--t-verde)',
            boxShadow: '0 2px 8px rgba(42,122,86,0.1)',
          }}
        >
          <PlaceSearchInput
            compact
            destination={destination}
            placeholder="Search place…"
            onSelect={handleSelect}
            onCancel={() => setShowSearch(false)}
          />
        </div>
      );
    }
    return (
      <div
        className="flex flex-col items-center flex-shrink-0 cursor-pointer select-none"
        style={{ width: 68 }}
        onClick={() => setShowSearch(true)}
      >
        {/* Spacer to align with grip dots */}
        <div style={{ height: 7 }} />
        <div
          className="rounded-xl flex items-center justify-center"
          style={{
            width: 50,
            height: 50,
            border: `1.5px dashed ${INK['20']}`,
            background: INK['04'],
            transition: 'border-color 0.15s, background 0.15s',
          }}
        >
          <PerriandIcon name="add" size={18} color={INK['35']} />
        </div>
        <span
          className="text-[9px] font-medium text-center leading-tight mt-1"
          style={{
            color: INK['35'],
            fontFamily: FONT.sans,
            maxWidth: '100%',
            lineHeight: '1.15',
          }}
        >
          Add place
        </span>
      </div>
    );
  }

  // ─── Desktop rail: horizontal list button ───
  if (showSearch) {
    return (
      <div
        className="flex-shrink-0 rounded-lg mx-1 mb-1"
        style={{ background: INK['04'], border: `1px dashed ${INK['15']}` }}
      >
        <PlaceSearchInput
          compact
          destination={destination}
          placeholder="Search for a place…"
          onSelect={handleSelect}
          onCancel={() => setShowSearch(false)}
        />
      </div>
    );
  }
  return (
    <button
      onClick={() => setShowSearch(true)}
      className="flex items-center gap-2 flex-shrink-0 mx-1 mb-1 py-2.5 px-3 rounded-lg transition-all"
      style={{
        background: 'transparent',
        border: `1px dashed ${INK['15']}`,
        cursor: 'pointer',
        width: 'calc(100% - 8px)',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = INK['04']; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--t-verde)12' }}
      >
        <PerriandIcon name="add" size={14} color="var(--t-verde)" />
      </div>
      <span style={{ fontFamily: FONT.sans, fontSize: 11, fontWeight: 600, color: INK['40'] }}>
        Add a place
      </span>
    </button>
  );
}

export default React.memo(AddPlaceInline);

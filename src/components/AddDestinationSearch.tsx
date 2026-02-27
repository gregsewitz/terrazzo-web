'use client';

import { useCallback } from 'react';
import PlaceSearchInput from './PlaceSearchInput';
import type { PlaceSearchResult } from './PlaceSearchInput';
import { useTripStore } from '@/stores/tripStore';
import { useSavedStore } from '@/stores/savedStore';
import { extractDestinationFromGooglePlace, isGeographicPlace } from '@/lib/destination-helpers';
import type { ImportedPlace } from '@/types';
import { FONT, INK } from '@/constants/theme';

interface AddDestinationSearchProps {
  onAdded?: (destination: string) => void;
  onCancel?: () => void;
}

export default function AddDestinationSearch({ onAdded, onCancel }: AddDestinationSearchProps) {
  const addDestinationToTrip = useTripStore(s => s.addDestinationToTrip);
  const addPlace = useSavedStore(s => s.addPlace);

  const handleSelect = useCallback((result: PlaceSearchResult) => {
    // 1. Extract destination city/region name
    const destination = extractDestinationFromGooglePlace(
      result.name,
      result.googleTypes,
      result.addressComponents,
    );

    // 2. If result is a specific place (not a city), save it to library
    let placeToSave: ImportedPlace | undefined;
    if (result.placeId && !isGeographicPlace(result.googleTypes)) {
      placeToSave = {
        id: `imported-${Date.now()}-${result.placeId.slice(-6)}`,
        name: result.name,
        type: result.type,
        location: result.address || destination,
        source: { type: 'google-maps' as const, name: 'Google Places' },
        matchScore: 0,
        matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0 },
        tasteNote: '',
        status: 'available' as const,
        google: {
          placeId: result.placeId,
          address: result.address,
          lat: result.lat,
          lng: result.lng,
        },
        savedAt: new Date().toISOString(),
      };

      addPlace(placeToSave);
    }

    // 3. Add destination + new day to trip
    addDestinationToTrip(destination, placeToSave);

    onAdded?.(destination);
  }, [addDestinationToTrip, addPlace, onAdded]);

  return (
    <div>
      <div style={{
        fontFamily: FONT.sans,
        fontSize: 12,
        fontWeight: 600,
        color: INK['70'],
        padding: '4px 12px 2px',
        letterSpacing: 0.2,
      }}>
        Add destination
      </div>
      <PlaceSearchInput
        onSelect={handleSelect}
        onCancel={onCancel || (() => {})}
        placeholder="City, region, or place name…"
        searchTypes={[]}
        compact
      />
    </div>
  );
}

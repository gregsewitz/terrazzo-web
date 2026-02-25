import { describe, it, expect } from 'vitest';
import { seedTripToCreationData } from '@/lib/seedTrips';
import type { SeedTripInput, GeoDestination } from '@/types';

function makeLegacySeed(destination: string): SeedTripInput {
  return {
    name: '',
    destinations: [],
    destination,
    status: 'planning',
    seedSource: 'onboarding_planning',
    rawUserInput: destination,
  };
}

function makeStructuredSeed(
  name: string,
  destinations: GeoDestination[],
  opts?: Partial<SeedTripInput>,
): SeedTripInput {
  return {
    name,
    destinations,
    status: 'planning',
    seedSource: 'onboarding_planning',
    rawUserInput: name,
    ...opts,
  };
}

describe('seedTripToCreationData — structured (new path)', () => {
  it('uses name directly as trip name', () => {
    const result = seedTripToCreationData(
      makeStructuredSeed('Family Ireland Trip', [{ name: 'Dublin' }, { name: 'Galway' }])
    );
    expect(result.name).toBe('Family Ireland Trip');
  });

  it('uses destination names from GeoDestination array', () => {
    const result = seedTripToCreationData(
      makeStructuredSeed('Italy Trip', [
        { name: 'Rome', placeId: 'abc', lat: 41.9, lng: 12.5 },
        { name: 'Florence', placeId: 'def', lat: 43.8, lng: 11.3 },
      ])
    );
    expect(result.destinations).toEqual(['Rome', 'Florence']);
  });

  it('passes through geoDestinations with coordinates', () => {
    const geos: GeoDestination[] = [
      { name: 'Tokyo', placeId: 'tok123', lat: 35.7, lng: 139.7 },
      { name: 'Kyoto', placeId: 'kyo456', lat: 35.0, lng: 135.8 },
    ];
    const result = seedTripToCreationData(makeStructuredSeed('Japan', geos));
    expect(result.geoDestinations).toEqual(geos);
  });

  it('sets travelContext from seed', () => {
    const result = seedTripToCreationData(
      makeStructuredSeed('Solo Tokyo', [{ name: 'Tokyo' }], { travelContext: 'solo' })
    );
    expect(result.travelContext).toBe('solo');
  });

  it('generates valid date strings', () => {
    const result = seedTripToCreationData(
      makeStructuredSeed('Test', [{ name: 'Somewhere' }])
    );
    expect(result.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('handles single destination', () => {
    const result = seedTripToCreationData(
      makeStructuredSeed('Paris Getaway', [{ name: 'Paris', lat: 48.9, lng: 2.3 }])
    );
    expect(result.destinations).toEqual(['Paris']);
    expect(result.name).toBe('Paris Getaway');
  });
});

describe('seedTripToCreationData — legacy fallback', () => {
  it('extracts "Ireland" from "Family Ireland Trip"', () => {
    const result = seedTripToCreationData(makeLegacySeed('Family Ireland Trip'));
    expect(result.destinations[0]).toBe('Ireland');
  });

  it('extracts "Sicily" from "Sicily in September"', () => {
    const result = seedTripToCreationData(makeLegacySeed('Sicily in September'));
    expect(result.destinations[0]).toBe('Sicily');
  });

  it('extracts "Bali" from "Honeymoon in Bali"', () => {
    const result = seedTripToCreationData(makeLegacySeed('Honeymoon in Bali'));
    expect(result.destinations[0]).toBe('Bali');
  });

  it('keeps "Tokyo" as-is for simple destination', () => {
    const result = seedTripToCreationData(makeLegacySeed('Tokyo'));
    expect(result.destinations[0]).toBe('Tokyo');
  });

  it('extracts "Tulum" from "Girls trip Tulum"', () => {
    const result = seedTripToCreationData(makeLegacySeed('Girls trip Tulum'));
    expect(result.destinations[0]).toBe('Tulum');
  });
});

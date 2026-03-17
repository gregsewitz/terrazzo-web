'use client';

import { useState, useEffect, useMemo } from 'react';
import { ImportedPlace, REACTIONS, SOURCE_STYLES, GhostSourceType, GooglePlaceData } from '@/types';
import { apiFetch } from '@/lib/api-client';
import { useSavedStore } from '@/stores/savedStore';
import { useBriefing } from '@/hooks/useBriefing';
import { useOnboardingStore } from '@/stores/onboardingStore';

export function usePlaceDetailData(item: ImportedPlace) {
  const addPlace = useSavedStore(s => s.addPlace);
  const myPlaces = useSavedStore(s => s.myPlaces);
  const generatedProfile = useOnboardingStore(s => s.generatedProfile);
  const collections = useSavedStore(s => s.collections);

  // Basic derived values
  const existingRating = item.rating;
  const ratingReaction = existingRating ? REACTIONS.find(r => r.id === existingRating.reaction) : null;
  const sourceStyle = item.ghostSource ? SOURCE_STYLES[item.ghostSource as GhostSourceType] : null;

  // Derive user's numeric taste profile for overlap mosaic
  const userTasteProfile = useMemo(() => {
    const radarData = (generatedProfile as { radarData?: { axis: string; value: number }[] } | null)?.radarData;
    if (!radarData) return null;
    const result: ImportedPlace['matchBreakdown'] = {
      Design: 0.5,
      Atmosphere: 0.5,
      Character: 0.5,
      Service: 0.5,
      FoodDrink: 0.5,
      Geography: 0.5,
      Wellness: 0.5,
      Sustainability: 0.5,
    };
    for (const r of radarData) {
      if (r.axis in result) {
        result[r.axis as keyof typeof result] = Math.max(result[r.axis as keyof typeof result], r.value);
      }
    }
    return result;
  }, [generatedProfile]);

  // Collection membership
  const memberCollections = collections.filter(sl => sl.placeIds.includes(item.id));
  const isInCollections = memberCollections.length > 0;

  // Hydrate preview places from the resolve API
  // When opened from discover feed, the item only has name/location/googlePlaceId.
  // Resolve fills in matchScore, matchBreakdown, google data, etc.
  // Also handles editorial cards that only have name/location (no googlePlaceId) —
  // the resolve endpoint supports name-based lookup as a fallback.
  const [resolvedItem, setResolvedItem] = useState<ImportedPlace>(item);

  // Briefing polling for inline progress — always fetch intelligence when we have a googlePlaceId
  // Use resolvedItem's googlePlaceId when available (editorial cards get resolved by name → googlePlaceId)
  const googlePlaceId = (item.google as Record<string, unknown> & { placeId?: string })?.placeId as string | undefined;
  const resolvedGooglePlaceId = (resolvedItem.google as Record<string, unknown> & { placeId?: string })?.placeId as string | undefined;
  const effectiveGooglePlaceId = resolvedGooglePlaceId || googlePlaceId;
  const { data: intelData } = useBriefing(effectiveGooglePlaceId);
  const isEnriching = intelData?.status === 'enriching' || intelData?.status === 'pending';

  // A place is a "private listing" (Airbnb/Vrbo) when the parser explicitly
  // classified it as a "rental" — a private vacation rental not on Google Maps.
  const isPrivateListing = item.type === 'rental';

  // Resolve effect
  useEffect(() => {
    setResolvedItem(item); // reset when item changes
    // Only resolve if the item looks under-populated (no match data, no google details)
    const needsResolve = !item.matchScore && !item.google?.rating;
    if (!needsResolve && googlePlaceId) return;
    // Need at least a name to resolve
    if (!googlePlaceId && !item.name) return;

    let cancelled = false;
    apiFetch<{
      googlePlaceId: string;
      name: string;
      location: string | null;
      type: string;
      googleData: {
        address?: string | null;
        rating?: number | null;
        reviewCount?: number | null;
        priceLevel?: string | null;
        hours?: string[] | null;
        photoUrl?: string | null;
        website?: string | null;
        phone?: string | null;
        lat?: number | null;
        lng?: number | null;
        category?: string | null;
      };
      matchScore: number | null;
      matchBreakdown: Record<string, number> | null;
      matchExplanation?: ImportedPlace['matchExplanation'] | null;
      tasteNote: string | null;
      intelligenceStatus: string;
      savedPlaceId: string | null;
      isInLibrary: boolean;
    }>('/api/places/resolve', {
      method: 'POST',
      body: JSON.stringify({
        googlePlaceId,
        name: item.name,
        location: item.location,
        lat: item.google?.lat,
        lng: item.google?.lng,
      }),
    })
      .then(data => {
        if (cancelled) return;
        const g = data.googleData;
        const priceNum = g.priceLevel ? g.priceLevel.length : undefined;
        const google: GooglePlaceData = {
          placeId: data.googlePlaceId,
          address: g.address || undefined,
          rating: g.rating || undefined,
          reviewCount: g.reviewCount || undefined,
          category: g.category || undefined,
          priceLevel: priceNum,
          hours: g.hours || undefined,
          photoUrl: g.photoUrl || undefined,
          website: g.website || undefined,
          phone: g.phone || undefined,
          lat: g.lat || undefined,
          lng: g.lng || undefined,
        };
        setResolvedItem(prev => ({
          ...prev,
          matchScore: data.matchScore || prev.matchScore || 0,
          matchBreakdown: (data.matchBreakdown || prev.matchBreakdown || {}) as ImportedPlace['matchBreakdown'],
          matchExplanation: data.matchExplanation || prev.matchExplanation,
          tasteNote: data.tasteNote || prev.tasteNote || '',
          google,
          location: data.location || prev.location,
          type: (data.type || prev.type) as ImportedPlace['type'],
        }));
      })
      .catch(err => console.error('Failed to resolve preview place:', err));
    return () => {
      cancelled = true;
    };
  }, [googlePlaceId, item.name, item.location, item]);

  // Hydrated values — prefer resolved data over the bare-bones item
  const hydratedMatchScore = resolvedItem.matchScore || item.matchScore || 0;
  const hydratedBreakdown =
    (Object.keys(resolvedItem.matchBreakdown || {}).length > 0 ? resolvedItem.matchBreakdown : item.matchBreakdown) ||
    ({} as ImportedPlace['matchBreakdown']);
  const hydratedGoogle =
    resolvedItem.google && (resolvedItem.google as Record<string, unknown>).rating ? resolvedItem.google : item.google;
  const hydratedTasteNote = resolvedItem.tasteNote || item.tasteNote;
  const hydratedLocation = resolvedItem.location || item.location;

  // Save state
  const [saved, setSaved] = useState(myPlaces.some(p => p.name === item.name));

  const handleSave = () => {
    if (!saved) {
      addPlace({ ...item, id: `saved-${Date.now()}` });
      setSaved(true);
    }
  };

  return {
    resolvedItem,
    hydratedMatchScore,
    hydratedBreakdown,
    hydratedGoogle,
    hydratedTasteNote,
    hydratedLocation,
    userTasteProfile,
    effectiveGooglePlaceId,
    intelData,
    isEnriching,
    isPrivateListing,
    saved,
    handleSave,
    memberCollections,
    isInCollections,
    collections,
    existingRating,
    ratingReaction,
    sourceStyle,
  };
}

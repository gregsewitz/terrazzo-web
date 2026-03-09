'use client';

import React, { useContext } from 'react';
import { usePlaceResolver } from '@/hooks/usePlaceResolver';
import type { ImportedPlace, PlaceType } from '@/types';
import { trackInteraction } from '@/lib/interaction-tracker';
import { useSavedStore } from '@/stores/savedStore';

// Import the context directly to avoid the "must be within Provider" throw
// from usePlaceDetail(). We want optional usage — return null when no provider.
import { PlaceDetailContext, placeLinkBridge } from '@/context/PlaceDetailContext';

interface PlaceLinkProps {
  name: string;
  location: string;
  /** Pre-resolved Google Place ID — skips the resolve step entirely */
  googlePlaceId?: string;
  /** Optional match score from the discover feed */
  matchScore?: number;
  /** Optional match breakdown from the discover feed */
  matchBreakdown?: Record<string, number>;
  /** Optional place type */
  type?: PlaceType;
  /** Explicit override — when provided, opens the detail sheet overlay */
  onOpenDetail?: (place: ImportedPlace) => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Wraps any place name / card and makes it clickable.
 *
 * Automatically detects PlaceDetailContext. When available (e.g. on profile page
 * or saved page), opens the place in a sheet overlay — same experience everywhere.
 *
 * Falls back to navigation to /places/[googlePlaceId] when no context is present
 * (e.g. direct links, standalone pages).
 */
export default function PlaceLink({
  name,
  location,
  googlePlaceId,
  matchScore,
  matchBreakdown,
  type,
  onOpenDetail,
  children,
  className = '',
  style,
}: PlaceLinkProps) {
  const { navigateToPlace } = usePlaceResolver();
  // Optional context: null when outside a PlaceDetailProvider
  const placeDetailCtx = useContext(PlaceDetailContext);
  const myPlaces = useSavedStore(s => s.myPlaces);

  // Resolve the open handler: explicit prop > context > module bridge > null
  // The bridge bypasses React context — works even when Next.js duplicates the module.
  const openHandler = onOpenDetail || placeDetailCtx?.openPreview || placeLinkBridge.openPreview || null;
  // Check if place is already saved — use openDetail (library mode) instead of openPreview
  const openDetailHandler = placeDetailCtx?.openDetail;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();

        // Track discover_tap interaction
        if (googlePlaceId) {
          trackInteraction('discover_tap', googlePlaceId, 'discover', {
            placeType: type,
          });
        }

        // If we have a sheet callback and a googlePlaceId, open in overlay
        if (openHandler && googlePlaceId) {
          // If the place is already in the user's library, open it as a
          // library item (with real ID) instead of a preview with a synthetic
          // discover-prefixed ID. This ensures rating/editing targets the
          // correct DB record.
          if (openDetailHandler) {
            const libraryPlace = myPlaces.find(p => p.google?.placeId === googlePlaceId);
            if (libraryPlace) {
              openDetailHandler(libraryPlace);
              return;
            }
          }

          const previewPlace: ImportedPlace = {
            id: `discover-${googlePlaceId}`,
            name,
            type: type || 'activity',
            location,
            source: { type: 'url', name: 'Discover' },
            matchScore: matchScore || 0,
            matchBreakdown: (matchBreakdown || {}) as ImportedPlace['matchBreakdown'],
            tasteNote: '',
            google: { placeId: googlePlaceId },
            status: 'available',
            ghostSource: 'terrazzo',
          };
          openHandler(previewPlace);
          return;
        }

        // Fallback: navigate to /places/[googlePlaceId]
        navigateToPlace(name, location, googlePlaceId);
      }}
      className={`place-link ${className}`}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'contents',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

'use client';

import React, { useContext } from 'react';
import { usePlaceResolver } from '@/hooks/usePlaceResolver';
import type { ImportedPlace, PlaceType } from '@/types';

// Import the context directly to avoid the "must be within Provider" throw
// from usePlaceDetail(). We want optional usage — return null when no provider.
import { PlaceDetailContext } from '@/context/PlaceDetailContext';

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

  // Resolve the open handler: explicit prop > context > null
  const openHandler = onOpenDetail || placeDetailCtx?.openPreview || null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();

        // If we have a sheet callback and a googlePlaceId, open in overlay
        if (openHandler && googlePlaceId) {
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

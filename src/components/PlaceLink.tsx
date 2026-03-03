'use client';

import React from 'react';
import { usePlaceResolver } from '@/hooks/usePlaceResolver';

interface PlaceLinkProps {
  name: string;
  location: string;
  /** Pre-resolved Google Place ID — skips the resolve step entirely */
  googlePlaceId?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Wraps any place name / card and makes it clickable.
 * If googlePlaceId is provided (pre-resolved at discover generation time),
 * navigates directly — no API call, no wrong-place risk.
 * Otherwise falls back to name-based navigation with background resolve.
 */
export default function PlaceLink({
  name,
  location,
  googlePlaceId,
  children,
  className = '',
  style,
}: PlaceLinkProps) {
  const { navigateToPlace } = usePlaceResolver();

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
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

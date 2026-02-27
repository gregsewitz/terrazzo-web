'use client';

import React from 'react';
import { usePlaceResolver } from '@/hooks/usePlaceResolver';
import { FONT, INK } from '@/constants/theme';

interface PlaceLinkProps {
  name: string;
  location: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Wraps any place name / card and makes it clickable.
 * On click: resolves the place via Google Places → caches → navigates to detail page.
 * Shows a subtle loading indicator while resolving.
 */
export default function PlaceLink({
  name,
  location,
  children,
  className = '',
  style,
}: PlaceLinkProps) {
  const { navigateToPlace, isResolving, resolvingName } = usePlaceResolver();
  const isThisResolving = isResolving && resolvingName === name;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigateToPlace(name, location);
      }}
      disabled={isResolving}
      className={`place-link ${className}`}
      style={{
        all: 'unset',
        cursor: isResolving ? 'wait' : 'pointer',
        display: 'contents',
        ...style,
      }}
    >
      {children}

      {/* Tiny resolving indicator overlaid on the clicked item */}
      {isThisResolving && (
        <span
          style={{
            position: 'fixed',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: 'var(--t-ink)',
            color: 'var(--t-cream)',
            padding: '6px 16px',
            borderRadius: 20,
            fontSize: 13,
            fontFamily: FONT.sans,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              border: '2px solid var(--t-honey)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          Loading {name}…
        </span>
      )}
    </button>
  );
}

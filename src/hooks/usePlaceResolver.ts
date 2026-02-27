'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Client-side hook for the discover click → navigate flow.
 *
 * Two modes:
 *   1. googlePlaceId available (pre-resolved at discover generation time):
 *      Navigate directly to /places/{googlePlaceId} — no API call needed.
 *   2. googlePlaceId missing (fallback for hardcoded data, older cached feeds):
 *      Navigate to /places/{encodedName} — detail page resolves in background.
 */
export function usePlaceResolver() {
  const router = useRouter();

  const navigateToPlace = useCallback(
    (name: string, location: string, googlePlaceId?: string) => {
      // Save scroll position so the profile page can restore it on back-nav
      sessionStorage.setItem('profile_scroll_y', String(window.scrollY));

      if (googlePlaceId) {
        // Pre-resolved: navigate directly with the canonical ID
        // Stash the full resolved data so the detail page can hydrate from sessionStorage
        sessionStorage.setItem(
          `place_resolve_${googlePlaceId}`,
          JSON.stringify({ googlePlaceId, name, location }),
        );
        router.push(`/places/${googlePlaceId}`);
      } else {
        // Fallback: navigate with the name, detail page resolves in background
        const slug = encodeURIComponent(name);
        sessionStorage.setItem(
          `place_pending_${slug}`,
          JSON.stringify({ name, location }),
        );
        router.push(`/places/${slug}`);
      }
    },
    [router],
  );

  // isResolving is always false — we never block navigation
  return { navigateToPlace, isResolving: false, resolvingName: null };
}

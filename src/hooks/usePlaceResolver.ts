'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Client-side hook for the discover click → resolve → navigate flow.
 *
 * 1. Calls POST /api/places/resolve with { name, location }
 * 2. Caches the full response in sessionStorage so the detail page loads instantly
 * 3. Navigates to /places/${googlePlaceId}
 */
export function usePlaceResolver() {
  const router = useRouter();
  const [isResolving, setIsResolving] = useState(false);
  const [resolvingName, setResolvingName] = useState<string | null>(null);

  const navigateToPlace = useCallback(
    async (name: string, location: string) => {
      if (isResolving) return;

      setIsResolving(true);
      setResolvingName(name);

      try {
        const res = await fetch('/api/places/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, location }),
        });

        if (!res.ok) {
          console.error('Failed to resolve place:', name, location);
          return;
        }

        const data = await res.json();

        // Cache in sessionStorage so the detail page can hydrate instantly
        sessionStorage.setItem(
          `place_resolve_${data.googlePlaceId}`,
          JSON.stringify(data),
        );

        router.push(`/places/${data.googlePlaceId}`);
      } catch (err) {
        console.error('Place resolution failed:', err);
      } finally {
        setIsResolving(false);
        setResolvingName(null);
      }
    },
    [isResolving, router],
  );

  return { navigateToPlace, isResolving, resolvingName };
}

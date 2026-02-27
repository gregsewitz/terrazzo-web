'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';

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
        const data = await apiFetch<{
          googlePlaceId: string;
          name: string;
          location: string;
          [key: string]: unknown;
        }>('/api/places/resolve', {
          method: 'POST',
          body: JSON.stringify({ name, location }),
        });

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

'use client';

import { apiFetch } from '@/lib/api-client';

interface SeedResult {
  savedCount: number;
  collectionId?: string;
}

/**
 * Seeds the user's library with top Discover recommendations and creates
 * a starter collection. Called once after onboarding bridge completion.
 *
 * Idempotent — checks localStorage flag before running.
 */
export async function seedLibraryFromDiscover(
  archetypeName: string,
): Promise<SeedResult> {
  // Guard: only run once
  if (typeof window !== 'undefined' && localStorage.getItem('terrazzo_library_seeded') === 'true') {
    return { savedCount: 0 };
  }

  try {
    const result = await apiFetch<SeedResult>('/api/onboarding/seed-library', {
      method: 'POST',
      body: JSON.stringify({ archetypeName }),
    });

    // Mark as done
    if (typeof window !== 'undefined') {
      localStorage.setItem('terrazzo_library_seeded', 'true');
    }

    return result;
  } catch (err) {
    console.error('[terrazzo] Library seeding failed:', err);
    return { savedCount: 0 };
  }
}

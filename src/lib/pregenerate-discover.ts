'use client';

import { apiFetch } from '@/lib/api-client';
import type { GeneratedTasteProfile, OnboardingLifeContext } from '@/types';

const DISCOVER_CACHE_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * Pre-generates and caches the Discover feed during onboarding synthesis.
 * Called from the processing page after profile synthesis completes.
 *
 * This ensures the first Discover page load is instant (cache hit)
 * instead of requiring a slow API call.
 */
export async function pregenerateDiscoverFeed(
  profile: GeneratedTasteProfile,
  lifeContext: OnboardingLifeContext | null,
): Promise<boolean> {
  if (!profile?.overallArchetype) return false;

  // Check if already cached
  const cacheKey = `terrazzo_discover_${profile.overallArchetype}`;
  try {
    const existing = localStorage.getItem(cacheKey);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (parsed._cachedAt && (Date.now() - parsed._cachedAt) < DISCOVER_CACHE_TTL_MS) {
        return true; // Already cached and fresh
      }
    }
  } catch {
    // Ignore parse errors
  }

  try {
    const data = await apiFetch('/api/profile/discover', {
      method: 'POST',
      body: JSON.stringify({
        userProfile: profile,
        lifeContext: lifeContext || undefined,
      }),
    });

    // Cache the result with timestamp (same format as useDiscoverFeed)
    try {
      const toCache = { ...(data as Record<string, unknown>), _cachedAt: Date.now() };
      localStorage.setItem(cacheKey, JSON.stringify(toCache));
    } catch {
      // quota exceeded — still succeeded, just won't be cached
    }

    return true;
  } catch (error) {
    console.warn('[terrazzo] Discover pre-generation failed:', error);
    return false;
  }
}

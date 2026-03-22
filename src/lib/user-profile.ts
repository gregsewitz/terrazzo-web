/**
 * Server-side helper: load the authenticated user's numeric taste profile.
 * Falls back to DEFAULT_USER_PROFILE when not authenticated or no profile exists.
 */
import { NextRequest } from 'next/server';
import { getUser } from '@/lib/supabase-server';
import { DEFAULT_USER_PROFILE } from '@/lib/taste-match-v3';
import type { TasteProfile, TasteDomain } from '@/types';
import { ALL_TASTE_DOMAINS } from '@/types';

const VALID_DOMAINS = new Set<string>(ALL_TASTE_DOMAINS);

/**
 * Convert a raw tasteProfile JSON (with radarData) into a flat TasteProfile.
 * radarData axes are v2 domain names (Design, Atmosphere, etc.) directly.
 */
export function parseTasteProfile(raw: unknown): TasteProfile {
  const tp = raw as { radarData?: { axis: string; value: number }[] } | null;
  if (!tp?.radarData?.length) return DEFAULT_USER_PROFILE;

  const result: TasteProfile = { ...DEFAULT_USER_PROFILE };
  for (const r of tp.radarData) {
    if (VALID_DOMAINS.has(r.axis)) {
      result[r.axis as TasteDomain] = Math.max(result[r.axis as TasteDomain], r.value);
    }
  }
  return result;
}

/**
 * Try to load the logged-in user's taste profile from DB.
 * Returns DEFAULT_USER_PROFILE if not authenticated or no profile saved.
 */
export async function getUserTasteProfile(req: NextRequest): Promise<TasteProfile> {
  try {
    const user = await getUser(req);
    return parseTasteProfile(user?.tasteProfile);
  } catch {
    return DEFAULT_USER_PROFILE;
  }
}

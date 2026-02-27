/**
 * Server-side helper: load the authenticated user's numeric taste profile.
 * Falls back to DEFAULT_USER_PROFILE when not authenticated or no profile exists.
 */
import { NextRequest } from 'next/server';
import { getUser } from '@/lib/supabase-server';
import { DEFAULT_USER_PROFILE } from '@/lib/taste-match';
import type { TasteProfile } from '@/types';

/** Radar axis → TasteProfile domain mapping */
const RADAR_TO_DOMAIN: Record<string, keyof TasteProfile> = {
  Sensory: 'Design',
  Material: 'Design',
  Authenticity: 'Character',
  Social: 'Service',
  Cultural: 'Location',
  Spatial: 'Wellness',
};

/**
 * Convert a raw tasteProfile JSON (with radarData) into a flat TasteProfile.
 * Usable from any server context — no request/auth needed.
 */
export function parseTasteProfile(raw: unknown): TasteProfile {
  const tp = raw as { radarData?: { axis: string; value: number }[] } | null;
  if (!tp?.radarData?.length) return DEFAULT_USER_PROFILE;

  const result: TasteProfile = { ...DEFAULT_USER_PROFILE };
  for (const r of tp.radarData) {
    const domain = RADAR_TO_DOMAIN[r.axis];
    if (domain) {
      result[domain] = Math.max(result[domain], r.value);
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

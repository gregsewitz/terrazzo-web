/**
 * GET /api/intelligence/patterns?userId=xxx&favoritesOnly=true
 *
 * Behavioral pattern recognition — analyzes a user's library to detect
 * emergent taste patterns from their saved/favorited places.
 *
 * Returns clusters of recurring themes the user gravitates toward,
 * including "hidden preferences" not reflected in their onboarding profile.
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeBehavioralPatterns } from '@/lib/behavioral-patterns';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const favoritesOnly = url.searchParams.get('favoritesOnly') === 'true';

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const analysis = await analyzeBehavioralPatterns(userId, {
      favoritesOnly,
      minPlaces: 5,
    });

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('[patterns] Error:', error);
    return NextResponse.json({ error: 'Pattern analysis failed' }, { status: 500 });
  }
}

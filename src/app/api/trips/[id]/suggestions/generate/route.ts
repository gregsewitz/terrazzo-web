/**
 * POST /api/trips/[id]/suggestions/generate
 *
 * Tier 2 suggestion engine: uses Claude to rank and contextualize
 * library places for a specific trip day.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit';
import { validateBody } from '@/lib/api-validation';
import { getUserTasteProfile } from '@/lib/user-profile';
import { fetchDayWeather } from '@/lib/weather';
import {
  buildDayContext,
  buildSuggestionPrompt,
  parseSuggestionResponse,
  SUGGESTION_SYSTEM_PROMPT,
} from '@/services/suggestionEngine';

const anthropic = new Anthropic();
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

// ─── Request validation ───────────────────────────────────────────────────────

const suggestSchema = z.object({
  dayNumber: z.number().int().positive(),
  tripName: z.string().default(''),
  travelContext: z.enum(['solo', 'partner', 'friends', 'family']).optional(),
  groupSize: z.number().optional(),
  destLat: z.number().optional(),
  destLng: z.number().optional(),
  day: z.object({
    dayNumber: z.number(),
    date: z.string().optional(),
    dayOfWeek: z.string().optional(),
    destination: z.string().optional(),
    slots: z.array(z.object({
      id: z.string(),
      label: z.string(),
      time: z.string(),
      places: z.array(z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        location: z.string(),
      })),
    })),
  }),
  candidates: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    location: z.string(),
    matchScore: z.number(),
    matchBreakdown: z.record(z.string(), z.number()).optional(),
    tasteNote: z.string().optional(),
  })),
});

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limit: 5 requests per 60 seconds per user
  const clientIp = getClientIp(req.headers);
  const rl = rateLimit(clientIp, { maxRequests: 5, windowMs: 60000 });
  if (!rl.success) return rateLimitResponse();

  try {
    const { id: tripId } = await params;

    // Validate request body
    const validation = await validateBody(req, suggestSchema);
    if ('error' in validation) return validation.error;
    const body = validation.data;

    // No candidates? Return empty immediately
    if (body.candidates.length === 0) {
      return NextResponse.json({
        suggestions: [],
        cacheKey: `${tripId}:${body.dayNumber}:empty`,
        generatedAt: new Date().toISOString(),
      });
    }

    // Check if any slots are actually empty
    const emptySlots = body.day.slots.filter(s => s.places.length === 0);
    if (emptySlots.length === 0) {
      return NextResponse.json({
        suggestions: [],
        cacheKey: `${tripId}:${body.dayNumber}:full`,
        generatedAt: new Date().toISOString(),
      });
    }

    // Load user taste profile + weather in parallel (weather is non-blocking)
    const weatherPromise = (body.destLat && body.destLng && body.day.date)
      ? fetchDayWeather(body.destLat, body.destLng, body.day.date)
      : Promise.resolve(null);

    const [tasteProfile, weather] = await Promise.all([
      getUserTasteProfile(req),
      weatherPromise,
    ]);

    // Build context for Claude
    const ctx = buildDayContext({
      tripId,
      tripName: body.tripName,
      day: body.day,
      tasteProfile,
      candidates: body.candidates,
      travelParty: body.travelContext
        ? { context: body.travelContext, groupSize: body.groupSize }
        : undefined,
      weather: weather || undefined,
    });

    const userMessage = buildSuggestionPrompt(ctx);

    // Call Claude with prompt caching on system prompt
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [{
        type: 'text',
        text: SUGGESTION_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      }],
      messages: [{ role: 'user', content: userMessage }],
    });

    // Parse response
    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    const suggestions = parseSuggestionResponse(rawText);

    // Build cache key from confirmed place IDs
    const confirmedIds = body.day.slots
      .flatMap(s => s.places.map(p => p.id))
      .sort()
      .join(',');
    const cacheKey = `${tripId}:${body.dayNumber}:${simpleHash(confirmedIds)}`;

    return NextResponse.json({
      suggestions,
      cacheKey,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[suggestions/generate] Error:', err);

    // Rate limited by Anthropic
    if (err?.status === 429) {
      return NextResponse.json(
        { error: 'Suggestion engine temporarily unavailable. Try again shortly.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}

// ─── Simple hash for cache keys ───────────────────────────────────────────────

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

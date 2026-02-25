import { z } from 'zod';
import { NextResponse } from 'next/server';

/**
 * Parse request body against a Zod schema. Returns parsed data or error Response.
 * Accepts either a Request or a pre-parsed body object.
 */
export async function validateBody<T extends z.ZodType>(
  reqOrBody: Request | Record<string, unknown>,
  schema: T
): Promise<{ data: z.infer<T> } | { error: Response }> {
  try {
    let body: Record<string, unknown>;
    if (reqOrBody instanceof Request) {
      body = await reqOrBody.json();
    } else {
      body = reqOrBody;
    }
    const data = schema.parse(body);
    return { data };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        error: NextResponse.json(
          {
            error: 'Validation failed',
            issues: err.issues.map(i => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
          { status: 400 }
        ),
      };
    }
    return { error: NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) };
  }
}

// Common schemas
export const placeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1),
  location: z.string().nullable().optional(),
  googlePlaceId: z.string().optional(),
  source: z.record(z.string(), z.unknown()).nullable().optional(),
  ghostSource: z.string().optional(),
  friendAttribution: z.record(z.string(), z.unknown()).nullable().optional(),
  matchScore: z.number().nullable().optional(),
  matchBreakdown: z.record(z.string(), z.number()).nullable().optional(),
  tasteNote: z.string().nullable().optional(),
  terrazzoInsight: z.record(z.string(), z.unknown()).nullable().optional(),
  enrichment: z.record(z.string(), z.unknown()).nullable().optional(),
  googleData: z.record(z.string(), z.unknown()).nullable().optional(),
  whatToOrder: z.array(z.string()).nullable().optional(),
  tips: z.array(z.string()).nullable().optional(),
  alsoKnownAs: z.string().optional(),
  importBatchId: z.string().optional(),
  savedDate: z.string().optional(),
  travelWith: z.string().optional(),
  isFavorited: z.boolean().optional(),
  userContext: z.string().optional(),
  timing: z.string().optional(),
  intentStatus: z.string().optional(),
  rating: z.number().optional(),
});

export const collectionCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  emoji: z.string().optional(),
  description: z.string().optional(),
  isSmartCollection: z.boolean().optional(),
  query: z.string().optional(),
  filterTags: z.array(z.string()).nullable().optional(),
  placeIds: z.array(z.string()).nullable().optional(),
});

export const collectionUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  emoji: z.string().optional(),
  description: z.string().optional(),
  placeIds: z.array(z.string()).nullable().optional(),
});

export const tripCreateSchema = z.object({
  name: z.string().min(1, 'Trip name is required'),
  location: z.string().nullable().optional(),
  destinations: z.array(z.string()).nullable().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const waitlistSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

// Smart search schema
export const smartSearchSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  places: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
});

// Profile discover schema
export const profileDiscoverSchema = z.object({
  userProfile: z.record(z.string(), z.unknown()),
  lifeContext: z.record(z.string(), z.unknown()).nullable().optional(),
});

// Onboarding analyze schema
export const onboardingAnalyzeSchema = z.object({
  userText: z.string().min(1, 'User text is required'),
  conversationHistory: z.array(z.record(z.string(), z.unknown())),
  phaseId: z.string().min(1, 'Phase ID is required'),
  certainties: z.record(z.string(), z.unknown()).nullable().optional(),
  userMessageCount: z.number().optional(),
  crossPhaseContext: z.record(z.string(), z.unknown()).nullable().optional(),
});

// Onboarding synthesize schema
export const onboardingSynthesizeSchema = z.object({
  signals: z.array(z.unknown()),
  messages: z.array(z.record(z.string(), z.unknown())),
  contradictions: z.array(z.record(z.string(), z.unknown())),
  certainties: z.record(z.string(), z.unknown()),
});

// TTS schema
export const ttsSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  voice: z.string().optional(),
});

// Import maps schema
export const importMapsSchema = z.object({
  content: z.string().min(1, 'Content is required'),
});

// Import maps list schema
export const importMapsListSchema = z.object({
  url: z.string().min(1, 'URL is required').url('Must be a valid URL'),
});

// Trip chat schema
export const tripChatSchema = z.object({
  userMessage: z.string().min(1, 'Message is required'),
  conversationHistory: z.array(z.record(z.string(), z.unknown())),
  tripContext: z.record(z.string(), z.unknown()),
  userProfile: z.record(z.string(), z.unknown()),
});

// Trip conversation schema
export const tripConversationSchema = z.object({
  userMessage: z.string().min(1, 'Message is required'),
  conversationHistory: z.array(z.record(z.string(), z.unknown())),
  messageCount: z.number().optional(),
  tripContext: z.record(z.string(), z.unknown()),
  userProfile: z.record(z.string(), z.unknown()),
});

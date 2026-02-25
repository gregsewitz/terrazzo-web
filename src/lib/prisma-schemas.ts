import { z } from 'zod';

/** Taste profile — 6-dimension scoring */
export const tasteProfileSchema = z.object({
  Design: z.number().min(0).max(1),
  Character: z.number().min(0).max(1),
  Service: z.number().min(0).max(1),
  Food: z.number().min(0).max(1),
  Location: z.number().min(0).max(1),
  Wellness: z.number().min(0).max(1),
});

/** Life context signals from onboarding */
export const lifeContextSchema = z.object({
  travelStyle: z.string().optional(),
  companions: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
  budget: z.string().optional(),
  pace: z.string().optional(),
}).passthrough();

/** Place rating from user */
export const placeRatingSchema = z.object({
  reaction: z.enum(['loved', 'liked', 'fine', 'disliked']).optional(),
  personalNote: z.string().optional(),
}).passthrough();

/** Terrazzo insight attached to a place */
export const terrazzoInsightSchema = z.object({
  why: z.string().optional(),
  caveat: z.string().optional(),
}).passthrough();

/** Source attribution */
export const sourceSchema = z.object({
  type: z.string(),
  name: z.string(),
  url: z.string().optional(),
}).passthrough();

/** Match breakdown — per-domain scores */
export const matchBreakdownSchema = z.record(z.string(), z.number());

// Type exports
export type TasteProfileInput = z.infer<typeof tasteProfileSchema>;
export type LifeContextInput = z.infer<typeof lifeContextSchema>;
export type PlaceRatingInput = z.infer<typeof placeRatingSchema>;
export type TerrazzoInsightInput = z.infer<typeof terrazzoInsightSchema>;
export type SourceInput = z.infer<typeof sourceSchema>;
export type MatchBreakdownInput = z.infer<typeof matchBreakdownSchema>;

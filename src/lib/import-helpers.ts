'use client';

// Re-export detectInputType so existing client imports don't break.
// The canonical implementation lives in detect-input.ts (shared, no 'use client').
export { detectInputType, detectInput, extractPlaceIdFromMapsUrl, getPlatformLabel } from './detect-input';
export type { InputType, InputMeta, UrlPlatform } from './detect-input';

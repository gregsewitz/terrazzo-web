'use client';

// Re-export detectInputType so existing client imports don't break.
// The canonical implementation lives in detect-input.ts (shared, no 'use client').
export { detectInputType } from './detect-input';
export type { InputType } from './detect-input';

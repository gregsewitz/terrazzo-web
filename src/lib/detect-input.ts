/**
 * Input type detection — shared between client and server.
 *
 * Classifies pasted text so the UAB / ImportDrawer can route
 * to the correct import endpoint.
 *
 *   'google-maps'  → /api/import/maps-list
 *   'url'          → /api/import
 *   'text'         → /api/import (multi-line lists)
 *   'email'        → (future)
 */

export type InputType = 'url' | 'google-maps' | 'text' | 'email';

export function detectInputType(input: string): InputType {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed) || /^(www\.)/i.test(trimmed)) {
    if (/google\.com\/maps/i.test(trimmed) || /maps\.app\.goo/i.test(trimmed)) return 'google-maps';
    return 'url';
  }
  return 'text';
}

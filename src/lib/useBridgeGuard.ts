'use client';

/**
 * Bridge flow guard utilities.
 *
 * Checks if the bridge flow has been completed. New users see the bridge flow
 * (Reveal → Bridge → Discover), while returning users skip directly to the app.
 */

/**
 * Checks if the bridge flow has been completed.
 * Returns true if bridge is complete (user can proceed to app), false if they need the bridge.
 */
export function isBridgeComplete(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem('terrazzo_bridge_complete') === 'true';
}

/**
 * Marks the bridge as complete. Called when user finishes or skips the bridge.
 */
export function completeBridge(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('terrazzo_bridge_complete', 'true');
  }
}

import type { ImportedPlace, TimeSlot } from '@/types';

/** Filter ghost items whose location matches the given destination */
export function filterGhostsByDestination(
  slots: TimeSlot[],
  destination: string
): ImportedPlace[] {
  const destLower = (destination || '').toLowerCase();
  return slots.flatMap(s => s.ghostItems || []).filter(g => {
    if (!destLower) return true;
    const gLoc = (g.location || '').toLowerCase();
    return !gLoc || gLoc.includes(destLower) || destLower.includes(gLoc.split(',')[0].trim());
  });
}

/** Filter items by ghost source type */
export function filterByGhostSource<T extends { ghostSource?: string }>(
  items: T[],
  sourceFilter: string
): T[] {
  return items.filter(item => (item.ghostSource || 'manual') === sourceFilter);
}

/** Check if a slot has any ghost items */
export function hasGhostItems(slot: TimeSlot): boolean {
  return !!(slot.ghostItems && slot.ghostItems.length > 0);
}

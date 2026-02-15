import { TasteDomain, TasteProfile } from '@/types';

const DOMAINS: TasteDomain[] = ['Design', 'Character', 'Service', 'Food', 'Location', 'Wellness'];

export function computeMatchScore(userProfile: TasteProfile, placeProfile: TasteProfile): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const domain of DOMAINS) {
    const userWeight = userProfile[domain]; // How much user cares about this axis
    const placeScore = placeProfile[domain]; // How strongly this place delivers on this axis
    weightedSum += userWeight * placeScore;
    totalWeight += userWeight;
  }

  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 50;
}

export function getTopAxes(profile: TasteProfile, count: number = 3): TasteDomain[] {
  return DOMAINS
    .sort((a, b) => profile[b] - profile[a])
    .slice(0, count);
}

export function isStretchPick(userProfile: TasteProfile, placeProfile: TasteProfile): boolean {
  // A stretch pick is one where the place's top axes don't overlap much with the user's top axes
  const userTop = new Set(getTopAxes(userProfile, 2));
  const placeTop = getTopAxes(placeProfile, 2);
  return placeTop.filter(d => userTop.has(d)).length === 0;
}

export const DEFAULT_USER_PROFILE: TasteProfile = {
  Design: 0.85,
  Character: 0.8,
  Service: 0.6,
  Food: 0.75,
  Location: 0.7,
  Wellness: 0.4,
};

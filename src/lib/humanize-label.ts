/**
 * Clean a raw cluster label like "Service:familiarity-first-naming-convention"
 * into a human-readable form like "familiarity first naming convention".
 *
 * Extracted to its own module to avoid pulling server-only deps (prisma/pg)
 * into client bundles via taste-match-vectors.ts.
 */
export function humanizeClusterLabel(rawLabel: string): string {
  // Strip domain prefix (e.g. "Atmosphere:" or "Character:")
  const stripped = rawLabel.includes(':') ? rawLabel.split(':').slice(1).join(':') : rawLabel;
  // Remove the domain echo at the start (e.g. "atmosphere-communal-dining" → "communal-dining")
  const domainPrefixes = ['atmosphere-', 'character-', 'design-', 'service-', 'setting-', 'fooddrink-', 'wellness-', 'sustainability-'];
  let cleaned = stripped.toLowerCase();
  for (const prefix of domainPrefixes) {
    if (cleaned.startsWith(prefix)) {
      cleaned = cleaned.slice(prefix.length);
      break;
    }
  }
  // Convert hyphens to spaces
  return cleaned.replace(/-/g, ' ').trim();
}

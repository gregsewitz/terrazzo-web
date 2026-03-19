/**
 * Clean a raw cluster label into a human-readable form.
 *
 * If a displayLabel is available (set by relabel-clusters.py using Claude),
 * prefer that — it's a semantically meaningful 2-4 word label like
 * "Candlelit Ambiance" or "Wilderness Immersion".
 *
 * Falls back to mechanical cleanup of the raw label format
 * "Service:familiarity-first-naming-convention" → "familiarity first naming convention".
 *
 * Extracted to its own module to avoid pulling server-only deps (prisma/pg)
 * into client bundles via taste-match-vectors.ts.
 */

/**
 * Resolve a cluster's best available label.
 *
 * @param rawLabel  - The label field from signal-clusters.json (e.g. "Design:warm-minimalism")
 * @param displayLabel - Optional displayLabel from relabel-clusters.py (e.g. "Warm Minimalism")
 */
export function humanizeClusterLabel(rawLabel: string, displayLabel?: string): string {
  // Prefer the LLM-generated display label when available
  if (displayLabel && displayLabel.trim().length > 0) {
    return displayLabel.trim();
  }

  // Fallback: mechanical cleanup of the raw label
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

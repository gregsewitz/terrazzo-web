'use client';

import React, { memo, useMemo } from 'react';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { COLOR, FONT, INK, TEXT } from '@/constants/theme';
import {
  resolveAccolade,
  ACCOLADE_CATEGORY_ORDER,
  ACCOLADE_CATEGORY_LABELS,
  type AccoladeCategory,
  type AccoladeDefinition,
} from '@/constants/accolades';
import { FadeInSection, StaggerContainer, StaggerItem } from '@/components/animations/AnimatedElements';

interface Accolade {
  type: string;
  value: string;
  year?: string | null;
  category?: string;
}

interface AccoladesSectionProps {
  accolades: Accolade[];
  variant: 'desktop' | 'mobile';
}

interface ResolvedAccolade {
  original: Accolade;
  definition: AccoladeDefinition;
}

/**
 * Build a display label for a chip.
 * Uses the definition's chipLabel, but appends value detail when meaningful
 * (e.g. "MICHELIN · 1 Star" or "50 Best · #42").
 */
function chipDisplayLabel(resolved: ResolvedAccolade): string {
  const { original, definition } = resolved;
  const val = original.value?.trim();

  // If value contains useful specifics beyond just the award name, show it
  if (val) {
    const valueLower = val.toLowerCase();
    const labelLower = definition.chipLabel.toLowerCase();

    // Skip if value just restates the award name
    if (valueLower === labelLower) return definition.chipLabel;
    if (valueLower === definition.label.toLowerCase()) return definition.chipLabel;

    // For Michelin, the value is the detail (e.g. "1 Star", "2 Stars", "3 Keys")
    if (original.type.includes('michelin') || original.type === 'michelin') {
      return `${definition.chipLabel} · ${val}`;
    }

    // For ranked lists, show ranking if it contains a number
    if (/\d/.test(val) && val.length < 20) {
      return `${definition.chipLabel} · ${val}`;
    }

    // For "finalist", "winner", etc.
    if (['winner', 'finalist', 'nominee', 'semi-finalist'].some(k => valueLower.includes(k))) {
      return `${definition.chipLabel} · ${val}`;
    }
  }

  return definition.chipLabel;
}

function AccoladeChip({ resolved, isDesktop }: { resolved: ResolvedAccolade; isDesktop: boolean }) {
  const label = chipDisplayLabel(resolved);
  const year = resolved.original.year;
  const def = resolved.definition;
  const fontSize = isDesktop ? 11 : 10;

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
      style={{
        background: `${def.accent}14`,
        border: `1px solid ${def.accent}20`,
      }}
    >
      <PerriandIcon name={def.icon as any} size={fontSize} color={def.accent} />
      <span
        style={{
          fontFamily: FONT.mono,
          fontSize,
          fontWeight: 600,
          letterSpacing: '0.3px',
          color: TEXT.primary,
          lineHeight: 1.3,
        }}
      >
        {label}
      </span>
      {year && (
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: fontSize - 1,
            color: TEXT.secondary,
            lineHeight: 1.3,
          }}
        >
          {year}
        </span>
      )}
    </div>
  );
}

function AccoladesSection({ accolades, variant }: AccoladesSectionProps) {
  const isDesktop = variant === 'desktop';

  // Resolve all accolades and deduplicate by chipLabel
  const resolvedAccolades = useMemo(() => {
    const seen = new Set<string>();
    const result: ResolvedAccolade[] = [];

    for (const accolade of accolades) {
      const definition = resolveAccolade(accolade.type);
      const chipLabel = chipDisplayLabel({ original: accolade, definition });

      // Deduplicate: keep the one with a year, or the first one seen
      if (!seen.has(chipLabel)) {
        seen.add(chipLabel);
        result.push({ original: accolade, definition });
      }
    }

    return result;
  }, [accolades]);

  // Group by category only if 4+ accolades
  const grouped = useMemo(() => {
    if (resolvedAccolades.length < 4) return null;

    const groups: Partial<Record<AccoladeCategory, ResolvedAccolade[]>> = {};
    for (const ra of resolvedAccolades) {
      const cat = ra.definition.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat]!.push(ra);
    }

    // Only return groups that have items, in canonical order
    return ACCOLADE_CATEGORY_ORDER
      .filter(cat => groups[cat] && groups[cat]!.length > 0)
      .map(cat => ({ category: cat, label: ACCOLADE_CATEGORY_LABELS[cat], items: groups[cat]! }));
  }, [resolvedAccolades]);

  if (resolvedAccolades.length === 0) return null;

  return (
    <FadeInSection delay={0.1} direction="up" distance={16}>
      <div className="py-4" style={{ borderBottom: `1px solid ${INK['06']}` }}>
        {/* Section header — ochre accent to evoke "gold" / prestige */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-2 -mx-1"
          style={{
            background: `${COLOR.ochre}14`,
            color: COLOR.ochre,
            fontFamily: FONT.display,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '1px',
            textTransform: 'uppercase' as const,
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR.ochre, flexShrink: 0 }} />
          <PerriandIcon name="sparkle" size={10} color={COLOR.ochre} />
          Recognition
        </div>

        {/* Chips — flat list if < 4, grouped if >= 4 */}
        {grouped ? (
          <div className="flex flex-col gap-3">
            {grouped.map(group => (
              <div key={group.category}>
                <div
                  className="mb-1.5"
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase' as const,
                    color: TEXT.tertiary,
                  }}
                >
                  {group.label}
                </div>
                <StaggerContainer className="flex flex-wrap gap-1.5" staggerDelay={0.05}>
                  {group.items.map((ra, i) => (
                    <StaggerItem key={i}>
                      <AccoladeChip resolved={ra} isDesktop={isDesktop} />
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              </div>
            ))}
          </div>
        ) : (
          <StaggerContainer className="flex flex-wrap gap-1.5" staggerDelay={0.06}>
            {resolvedAccolades.map((ra, i) => (
              <StaggerItem key={i}>
                <AccoladeChip resolved={ra} isDesktop={isDesktop} />
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </div>
    </FadeInSection>
  );
}

export default memo(AccoladesSection);

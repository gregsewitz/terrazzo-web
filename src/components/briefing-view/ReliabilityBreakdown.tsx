'use client';

import { useMemo } from 'react';
import { FONT, INK, TEXT } from '@/constants/theme';

interface CategoryScore {
  score: number;
  failures: number;
}

interface ReliabilityData {
  overall: number;
  categories: Record<string, CategoryScore>;
  totalReviews: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  service: 'Service',
  food: 'Food & Drink',
  facilities: 'Facilities',
  management: 'Management',
  ambiance: 'Ambiance',
  value: 'Value',
  drinks: 'Drinks',
  visitor_experience: 'Experience',
  exhibitions: 'Exhibitions',
  safety: 'Safety',
  navigation: 'Navigation',
  cleanliness: 'Cleanliness',
  accessibility: 'Accessibility',
  instruction: 'Instruction',
  logistics: 'Logistics',
  physical_comfort: 'Comfort',
  curation: 'Curation',
};

function scoreColor(score: number): string {
  if (score >= 0.85) return 'var(--t-dark-teal)';
  if (score >= 0.7) return 'var(--t-dark-teal)';
  if (score >= 0.5) return 'var(--t-amber)';
  return 'var(--t-signal-red)';
}

function scoreLabel(score: number): string {
  if (score >= 0.85) return 'Strong';
  if (score >= 0.7) return 'Good';
  if (score >= 0.5) return 'Fair';
  return 'Weak';
}

export function ReliabilityBreakdown({ reliability }: { reliability: ReliabilityData | null }) {
  const categories = useMemo(() => {
    if (!reliability?.categories) return [];
    return Object.entries(reliability.categories)
      .map(([key, val]) => ({
        key,
        label: CATEGORY_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        score: (val as CategoryScore).score,
        failures: (val as CategoryScore).failures,
      }))
      .sort((a, b) => a.score - b.score);
  }, [reliability]);

  if (!reliability || categories.length === 0) return null;

  return (
    <div>
      <div className="space-y-2.5">
        {categories.map(cat => {
          const pct = Math.round(cat.score * 100);
          const color = scoreColor(cat.score);
          return (
            <div key={cat.key}>
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-[11px] font-medium"
                  style={{ color: TEXT.primary, fontFamily: FONT.sans }}
                >
                  {cat.label}
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[10px] font-semibold"
                    style={{ color, fontFamily: FONT.mono }}
                  >
                    {scoreLabel(cat.score)}
                  </span>
                  {cat.failures > 0 && (
                    <span
                      className="text-[9px] px-1.5 py-px rounded"
                      style={{
                        color: TEXT.secondary,
                        background: INK['04'],
                        fontFamily: FONT.mono,
                      }}
                    >
                      {cat.failures} {cat.failures === 1 ? 'issue' : 'issues'}
                    </span>
                  )}
                </div>
              </div>
              {/* Bar */}
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: INK['06'] }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: color,
                    transition: 'width 0.6s ease-out',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {reliability.totalReviews > 0 && (
        <div
          className="text-[9px] mt-3"
          style={{ color: TEXT.secondary, fontFamily: FONT.mono }}
        >
          Based on {reliability.totalReviews} reviews
        </div>
      )}
    </div>
  );
}

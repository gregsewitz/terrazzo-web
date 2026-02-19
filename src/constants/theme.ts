// ─── Font families ───

export const FONT = {
  serif: "var(--font-dm-serif), 'DM Serif Display', serif",
  mono: "var(--font-space-mono), 'Space Mono', monospace",
  sans: "var(--font-dm-sans), 'DM Sans', sans-serif",
} as const;

// ─── Ink color at various opacities ───
// Base: rgba(28,26,23, X) — the terrazzo ink color

export const INK = {
  '95': 'rgba(28,26,23,0.95)',
  '90': 'rgba(28,26,23,0.9)',
  '85': 'rgba(28,26,23,0.85)',
  '80': 'rgba(28,26,23,0.8)',
  '75': 'rgba(28,26,23,0.75)',
  '70': 'rgba(28,26,23,0.7)',
  '60': 'rgba(28,26,23,0.6)',
  '55': 'rgba(28,26,23,0.55)',
  '50': 'rgba(28,26,23,0.5)',
  '45': 'rgba(28,26,23,0.45)',
  '40': 'rgba(28,26,23,0.4)',
  '35': 'rgba(28,26,23,0.35)',
  '30': 'rgba(28,26,23,0.3)',
  '20': 'rgba(28,26,23,0.2)',
  '18': 'rgba(28,26,23,0.18)',
  '15': 'rgba(28,26,23,0.15)',
  '12': 'rgba(28,26,23,0.12)',
  '10': 'rgba(28,26,23,0.1)',
  '08': 'rgba(28,26,23,0.08)',
  '06': 'rgba(28,26,23,0.06)',
  '05': 'rgba(28,26,23,0.05)',
  '04': 'rgba(28,26,23,0.04)',
  '03': 'rgba(28,26,23,0.03)',
  '02': 'rgba(28,26,23,0.02)',
} as const;

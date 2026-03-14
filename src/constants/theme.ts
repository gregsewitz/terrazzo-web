// ─── Font families ───

export const FONT = {
  sans: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif",
  serif: "var(--font-fraunces), 'Fraunces', serif",
  display: "var(--font-space-grotesk), 'Space Grotesk', sans-serif",
  mono: "var(--font-space-mono), 'Space Mono', monospace",
} as const;

// ─── Brand colors ───
// Single source of truth for all brand colors used in JS/TS.
// CSS variables are the canonical source; these are for inline styles.

export const COLOR = {
  coral: '#E86F5A',
  navy: '#1A2D4A',
  teal: '#5EC4B2',
  ochre: '#E8B84B',
  olive: '#6B7C4E',
  peach: '#F4BFA0',
  cream: '#FBF5EC',
  charcoal: '#2D2D2D',
  warmGray: '#A89888',
  signalRed: '#d63020',
} as const;

// ─── Text color hierarchy ───
// ALL text renders at full opacity. Use color to create hierarchy, never opacity.
//
// Prefer Tailwind classes over these constants:
//   text-t-primary, text-t-secondary, text-t-tertiary, text-t-accent, text-t-inverse
//
// These JS constants exist for inline styles where Tailwind can't reach.
// Both resolve to the same CSS variables in globals.css, so changing one place updates everything.

export const TEXT = {
  /** Primary text — headlines, body copy, labels */
  primary: 'var(--text-primary)' as string,
  /** Secondary text — timestamps, captions, metadata */
  secondary: 'var(--text-secondary)' as string,
  /** Tertiary text — tags, categories, subtle labels */
  tertiary: 'var(--text-tertiary)' as string,
  /** Accent text — links, CTAs, emphasis */
  accent: 'var(--text-accent)' as string,
  /** Inverse text — on dark or colored backgrounds */
  inverse: 'var(--text-inverse)' as string,
} as const;

// ─── Navy at various opacities (for borders, shadows, backgrounds ONLY) ───
// Base: rgba(26,45,74, X) — the terrazzo navy color
// NEVER use these for text. Use TEXT constants above instead.

export const INK = {
  '95': 'rgba(26,45,74,0.95)',
  '90': 'rgba(26,45,74,0.9)',
  '85': 'rgba(26,45,74,0.85)',
  '80': 'rgba(26,45,74,0.8)',
  '75': 'rgba(26,45,74,0.75)',
  '70': 'rgba(26,45,74,0.7)',
  '60': 'rgba(26,45,74,0.6)',
  '55': 'rgba(26,45,74,0.55)',
  '50': 'rgba(26,45,74,0.5)',
  '45': 'rgba(26,45,74,0.45)',
  '40': 'rgba(26,45,74,0.4)',
  '35': 'rgba(26,45,74,0.35)',
  '30': 'rgba(26,45,74,0.3)',
  '20': 'rgba(26,45,74,0.2)',
  '18': 'rgba(26,45,74,0.18)',
  '15': 'rgba(26,45,74,0.15)',
  '12': 'rgba(26,45,74,0.12)',
  '10': 'rgba(26,45,74,0.1)',
  '08': 'rgba(26,45,74,0.08)',
  '06': 'rgba(26,45,74,0.06)',
  '05': 'rgba(26,45,74,0.05)',
  '04': 'rgba(26,45,74,0.04)',
  '03': 'rgba(26,45,74,0.03)',
  '02': 'rgba(26,45,74,0.02)',
} as const;

// ─── Styling guidelines ───
//
// TEXT (best): Use Tailwind classes: text-t-primary, text-t-secondary, etc.
// TEXT (inline): Use TEXT.primary, TEXT.secondary, etc. for inline styles.
// Both point to CSS vars in globals.css — change once, update everywhere.
//
// DECORATIVE: Use INK['04']–'30' for borders, dividers, subtle backgrounds.
// These are navy-based transparencies for non-text elements only.
// NEVER use INK for text color.

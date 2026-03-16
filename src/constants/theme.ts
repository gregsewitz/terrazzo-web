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
  coral: '#ee716d',
  navy: '#002a55',
  teal: '#92ced6',
  ochre: '#e0a501',
  olive: '#6B7C4E',
  peach: '#e7a8a1',
  cream: '#FBF5EC',
  charcoal: '#2D2D2D',
  warmGray: '#A89888',
  darkTeal: '#3a8088',
  periwinkle: '#3869a4',
  blush: '#f1e7e5',
  lightYellow: '#ebd896',
  darkBrown: '#413800',
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
// Base: rgba(0,42,85, X) — the terrazzo navy color
// NEVER use these for text. Use TEXT constants above instead.

export const INK = {
  '95': 'rgba(0,42,85,0.95)',
  '90': 'rgba(0,42,85,0.9)',
  '85': 'rgba(0,42,85,0.85)',
  '80': 'rgba(0,42,85,0.8)',
  '75': 'rgba(0,42,85,0.75)',
  '70': 'rgba(0,42,85,0.7)',
  '60': 'rgba(0,42,85,0.6)',
  '55': 'rgba(0,42,85,0.55)',
  '50': 'rgba(0,42,85,0.5)',
  '45': 'rgba(0,42,85,0.45)',
  '40': 'rgba(0,42,85,0.4)',
  '35': 'rgba(0,42,85,0.35)',
  '30': 'rgba(0,42,85,0.3)',
  '20': 'rgba(0,42,85,0.2)',
  '18': 'rgba(0,42,85,0.18)',
  '15': 'rgba(0,42,85,0.15)',
  '12': 'rgba(0,42,85,0.12)',
  '10': 'rgba(0,42,85,0.1)',
  '08': 'rgba(0,42,85,0.08)',
  '06': 'rgba(0,42,85,0.06)',
  '05': 'rgba(0,42,85,0.05)',
  '04': 'rgba(0,42,85,0.04)',
  '03': 'rgba(0,42,85,0.03)',
  '02': 'rgba(0,42,85,0.02)',
} as const;

// ─── Section style tokens ───
// Two canonical section styles used across the discover feed.
// Use these to keep every new section visually consistent.
//
// EDITORIAL — dark teal background with white/ochre inner cards
// PLAIN     — no section background; coral-gradient floating cards

export const SECTION = {
  /** Editorial sections: dark-teal bg, light-yellow section labels, white headlines */
  editorial: {
    /** Section wrapper background */
    bg: 'var(--t-dark-teal)',
    /** SectionLabel color prop */
    label: 'var(--t-light-yellow)',
    /** Headline / title text directly on the bg */
    headline: '#ffffff',
    /** Body text directly on the bg */
    body: 'rgba(255,255,255,0.8)',
    /** Inner card background (sits on top of dark-teal bg) */
    cardBg: '#ffffff',
    /** Primary elements inside inner cards: names, scores, chips */
    cardPrimary: COLOR.ochre,
    /** Secondary text inside inner cards: locations, descriptions, body */
    cardSecondary: COLOR.navy,
    /** Accent label color inside inner cards (e.g. "Resolves your tension") */
    cardAccent: COLOR.coral,
  },
  /** Plain sections: no bg, coral-gradient cards */
  plain: {
    /** Section wrapper background (transparent / page bg) */
    bg: 'transparent',
    /** Card gradient background */
    cardBg: 'linear-gradient(145deg, rgba(238,113,109,0.06) 0%, rgba(238,113,109,0.12) 100%)',
    /** Card border */
    cardBorder: `1px solid ${COLOR.coral}`,
    /** SectionLabel color prop */
    label: COLOR.coral,
    /** Uppercase mono labels inside cards (e.g. "TASTE TENSION") */
    accent: COLOR.coral,
    /** Headlines, titles, place names, bold inline labels */
    primary: COLOR.darkTeal,
    /** All body / secondary text: descriptions, locations, editorial copy */
    secondary: COLOR.navy,
  },
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
//
// SECTIONS: Use SECTION.editorial.* and SECTION.plain.* for discover feed
// section styling. Editorial = dark-teal bg with white/ochre inner cards.
// Plain = no bg, coral-gradient floating cards with coral/darkTeal/navy text.

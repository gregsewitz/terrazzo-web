/* ═══════════════════════════════════════════════════════════════════════════
   KINETIC DREAMER — Terrazzo Brand System
   Aesthetic: Italian Futurist poster design + mid-century travel graphics
   Style: Bold geometric abstraction, large color fields, editorial magazine
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Font families ───
// Display: Condensed bold for headlines (Italian Futurist poster feel)
// Sans: Warm geometric for UI (mid-century modern warmth)
// Serif: Editorial accent for emphasis
// Mono: Technical details & labels

export const FONT = {
  display: "var(--font-bebas), 'Bebas Neue', sans-serif",  // Headlines, hero text
  serif: "var(--font-dm-serif), 'DM Serif Display', serif", // Editorial accent
  mono: "var(--font-space-mono), 'Space Mono', monospace",  // Labels, metadata
  sans: "var(--font-dm-sans), 'DM Sans', sans-serif",       // UI text
} as const;

// ─── Kinetic Dreamer Color Palette ───
export const COLORS = {
  coral: '#E86F5A',    // Primary brand - warm, energetic
  navy: '#1A2D4A',     // Primary text & contrast
  mint: '#5EC4B2',     // Accent - fresh, travel-inspired
  peach: '#F4BFA0',    // Soft accent - warmth
  ochre: '#E8B84B',    // Highlight - golden warmth
  cream: '#FBF5EC',    // Background - editorial warmth
} as const;

// ─── Navy (ink) color at various opacities ───
// Base: rgba(26,45,74, X) — the Kinetic Dreamer navy

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
// TEXT OPACITY: Avoid using INK values below '70' for any readable text content
// (labels, badges, links, action text, time displays). Low-opacity text looks
// washed out and is harder to read. Reserve INK['04']–'30' for decorative
// elements only (borders, dividers, subtle backgrounds). For text that should
// feel secondary, use INK['70']–'80' — not '35'–'50'.

// KINETIC DREAMER PRINCIPLES:
// • Bold geometric abstraction - use large color fields, not gradients
// • Editorial magazine layout - generous spacing, asymmetrical grids
// • Avoid: tech startup minimalism, glass/gradient UI
// • Embrace: mid-century travel poster aesthetic, overlapping shapes

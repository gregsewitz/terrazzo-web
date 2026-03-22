# Terrazzo — Brand Styling Update Plan

**Source:** Final Brand Identity Guide (Canva `DAHD22J6fDA`)
**Target:** Live app at `terrazzo-web/`
**Date:** March 14, 2026

---

## Current State → New Brand Identity

This document maps every element of the finalized Terrazzo brand identity to specific code changes in the live Next.js app. The app uses Tailwind CSS v4 with a CSS-based theme configuration in `globals.css`, three Google Fonts, and a warm earthy color palette. Below is a section-by-section plan to bring the live app into alignment with the new brand.

---

## 1. Color Palette

### Current Colors (globals.css CSS variables)
| Token | Current Hex | Role |
|---|---|---|
| `--t-ink` | `#1c1a17` | Primary text |
| `--t-honey` | `#c8923a` | Primary accent |
| `--t-verde` | `#2a7a56` | Secondary accent |
| `--t-panton-violet` | `#6844a0` | Tertiary accent |
| `--t-panton-orange` | `#e86830` | Accent |
| `--t-royere-pink` | `#e87080` | Accent |
| `--t-cream` | `#fdfaf3` | Background |
| `--t-travertine` | `#e8dcc8` | Light neutral |
| `--t-warm-white` | `#f5f0e6` | Warm white |
| `--t-signal-red` | `#d63020` | Alert |
| `--t-chrome-yellow` | `#eeb420` | Warning |
| `--t-linen` | `#ede6d8` | Light neutral |

### New Brand Colors
| Token (proposed) | New Hex | Brand Name | Role |
|---|---|---|---|
| `--t-coral` | `#E86F5A` | Coral | **Primary** — action / CTA / energy |
| `--t-navy` | `#1A2D4A` | Navy | **Primary** — text / dark surfaces |
| `--t-teal` | `#5EC4B2` | Mint Teal | **Secondary** — accent / success |
| `--t-ochre` | `#E8B84B` | Ochre Gold | **Secondary** — warm accent / premium / highlights |
| `--t-olive` | `#6B7C4E` | Olive | **Secondary** — nature / sustainability / variety |
| `--t-peach` | `#F4BFA0` | Peach | Soft highlight / cards |
| `--t-cream` | `#FBF5EC` | Cream | Primary canvas (keep, slight adjust) |
| `--t-charcoal` | `#2D2D2D` | Charcoal | Heavy text / footers |
| `--t-warm-gray` | `#A89888` | Warm Gray | Muted text / borders |

### Changes to `src/app/globals.css`

**Replace** the `:root` color block. Map old tokens → new tokens:

```
OLD                    → NEW                        NOTES
--t-ink (#1c1a17)      → --t-navy (#1A2D4A)         Primary text color shifts from brown-black to navy
--t-honey (#c8923a)    → --t-coral (#E86F5A)         Primary accent shifts from gold to coral
--t-honey-text         → --t-coral-text (#C45A47)    Accessible coral for small text on cream (check WCAG AA)
--t-amber (#a06c28)    → --t-ochre (#E8B84B)         Warm accent
--t-verde (#2a7a56)    → --t-teal (#5EC4B2)          Green → teal
--t-panton-violet      → --t-olive (#6B7C4E)         Purple → olive (or remove if not needed)
--t-panton-orange      → --t-coral (#E86F5A)         Orange merges into coral
--t-royere-pink        → --t-peach (#F4BFA0)         Pink → peach
--t-warm-white         → --t-warm-gray (#A89888)     Repurpose as muted gray
--t-travertine         → --t-peach (#F4BFA0)         Beige → peach
--t-cream (#fdfaf3)    → --t-cream (#FBF5EC)         Slight warmth shift (nearly identical)
--t-signal-red         → keep (#d63020)              System error color (not brand)
--t-chrome-yellow      → --t-ochre (#E8B84B)         Merge into ochre
--t-linen              → remove or alias to cream     Redundant
```

**Add new tokens:**
```css
--t-charcoal: #2D2D2D;
--t-navy: #1A2D4A;
```

**Update `--background` and `--foreground`:**
```css
--background: var(--t-cream);     /* #FBF5EC */
--foreground: var(--t-navy);      /* #1A2D4A */
```

**Update the `@theme inline` block** to register new Tailwind color utilities:
```css
@theme inline {
  --color-coral: var(--t-coral);
  --color-navy: var(--t-navy);
  --color-teal: var(--t-teal);
  --color-peach: var(--t-peach);
  --color-ochre: var(--t-ochre);
  --color-cream: var(--t-cream);
  --color-olive: var(--t-olive);
  --color-charcoal: var(--t-charcoal);
  --color-warm-gray: var(--t-warm-gray);
  /* ... keep font vars, update below */
}
```

### Update `src/constants/theme.ts`

**DELETE the entire `INK` opacity palette.** The current system uses 19 opacity variations (e.g., `INK['70']`, `INK['30']`) to create text hierarchy via transparency. This is being removed entirely.

**New rule: All text is full opacity (1.0). No faded text anywhere.**

Information hierarchy is handled through **font color**, not opacity. The color hierarchy:

| Hierarchy Level | Color | Token | Use |
|---|---|---|---|
| Primary text | Navy `#1A2D4A` | `--t-navy` | Headlines, body copy, labels |
| Secondary text | Warm Gray `#A89888` | `--t-warm-gray` | Timestamps, captions, metadata |
| Tertiary text | Olive `#6B7C4E` | `--t-olive` | Tags, categories, subtle labels |
| Accent text | Coral `#E86F5A` | `--t-coral` | Links, CTAs, emphasis |
| Inverse text | Cream `#FBF5EC` | `--t-cream` | Text on dark/colored backgrounds |

**Migration:** Every instance of `INK['XX']` in component code must be replaced with a solid color from the table above. Search for `INK\[` across all files.

### Update domain colors

Map taste domains to new brand palette:
```
--domain-design:       #E86F5A  (Coral)
--domain-character:    #6B7C4E  (Olive)
--domain-service:      #E8B84B  (Ochre)
--domain-food:         #F4BFA0  (Peach)
--domain-location:     #5EC4B2  (Teal)
--domain-wellness:     #1A2D4A  (Navy)
```

### Color Usage Rules (from brand guide)
- Cream (`#FBF5EC`) as the **primary canvas** — warm, not clinical white
- **Bold flat color fields, not gradients**
- Use color for rhythm and emphasis, not decoration
- **No opacity-based text hierarchy** — all text at full opacity, use color to differentiate
- Ochre and Olive are true **secondary colors** alongside Teal — use freely for backgrounds, accents, and UI variety

### Validated Color Combinations (from brand screenshots)
| Background | Text/Foreground | Use Case |
|---|---|---|
| Navy `#1A2D4A` | Peach `#F4BFA0` | Hero sections, dark cards, taglines |
| Navy `#1A2D4A` | Cream `#FBF5EC` | Navigation on dark, footer |
| Coral `#E86F5A` | Cream `#FBF5EC` | Primary CTA buttons, banners |
| Coral `#E86F5A` | Navy `#1A2D4A` | Accent panels, bold sections |
| Ochre `#E8B84B` | Navy `#1A2D4A` | Premium badges, highlight cards |
| Teal `#5EC4B2` | Navy `#1A2D4A` | Success states, teal panels |
| Olive `#6B7C4E` | Cream `#FBF5EC` | Nature-themed sections, tags |
| Cream `#FBF5EC` | Navy `#1A2D4A` | Default page canvas (most surfaces) |

### Files to update
- `src/app/globals.css` — CSS variables + `@theme inline`
- `src/constants/theme.ts` — INK palette base color
- Global search for hardcoded hex values: `#1c1a17`, `#c8923a`, `#2a7a56`, `#6844a0`, `#e86830`, `#e87080`, `#fdfaf3`, `#e8dcc8`, `#f5f0e6`, `#eeb420`, `#ede6d8`
- Any component using `bg-honey`, `text-ink`, `text-verde`, etc. (Tailwind classes referencing old names)

---

## 2. Typography

### Current Fonts
| Role | Font | Source |
|---|---|---|
| Sans (body) | DM Sans 400/500/600/700 | Google Fonts |
| Serif (display) | DM Serif Display 400 | Google Fonts |
| Mono | Space Mono 400/700 | Google Fonts |

### New Type System (from brand guide)

**DISPLAY** — Hero moments, poster treatments, high-impact headers
- Pixellance → exported as SVG wordmarks (not a web font — use as image/component)
- Aperture → use **Space Grotesk** (Google Fonts) as web substitute
- League Gothic → already on Google Fonts ✓
- Zing Rust Base → no Google Fonts match; use SVG exports for any decorative usage

**HEADER** — Section headers, mid-level hierarchy
- Cy Grotesk Wide → use **Space Grotesk** or **Host Grotesk** (Google Fonts) as substitute
- Fraunces Bold & Italic → already on Google Fonts ✓ (variable font with wonk + softness axes)
- ABeeZee → already on Google Fonts ✓

**BODY / UI** — Core interface and body copy
- DM Sans → **replace with Plus Jakarta Sans** (Google Fonts)
- Emmali → covered by Plus Jakarta Sans
- Computer Says No → decorative only; not needed for body UI

### Final Web Font Stack

```
Display:     'Fraunces', serif              — Variable, expressive (replaces DM Serif Display)
Header:      'Space Grotesk', sans-serif    — Blocky grotesque (replaces Cy Grotesk Wide)
Body:        'Plus Jakarta Sans', sans-serif — Modern geometric (replaces DM Sans)
Mono:        'Space Mono', monospace        — Keep as-is (code, data)
```

**SVG-only fonts (not loaded as web fonts):**
Pixellance and Aperture are Canva-only fonts. Greg will export any titles using these fonts as SVGs. These get placed as `<img>` or inline SVG — no @font-face needed.

### Changes to `src/app/layout.tsx`

**Remove:** `DM Serif Display` (replaced by Fraunces) and `DM Sans` (replaced by Plus Jakarta Sans)

**Add:**
```typescript
import { Fraunces } from 'next/font/google'
import { Space_Grotesk } from 'next/font/google'
import { Plus_Jakarta_Sans } from 'next/font/google'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  weight: ['700'],          // Always bold
  style: ['italic'],        // Always italic
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})
```

**Update html className:**
```tsx
<html className={`${dmSans.variable} ${fraunces.variable} ${spaceGrotesk.variable} ${plusJakartaSans.variable} ${spaceMono.variable}`}>
```

### Changes to `globals.css` `@theme inline`
```css
--font-sans: 'Plus Jakarta Sans', sans-serif;
--font-serif: 'Fraunces', serif;
--font-display: 'Space Grotesk', sans-serif;
--font-mono: 'Space Mono', monospace;
```

### Changes to `src/constants/theme.ts`
```typescript
export const FONT = {
  sans: "var(--font-plus-jakarta), 'Plus Jakarta Sans', sans-serif",
  serif: "var(--font-fraunces), 'Fraunces', serif",
  display: "var(--font-space-grotesk), 'Space Grotesk', sans-serif",
  mono: "var(--font-space-mono), 'Space Mono', monospace",
}
```

### Font Role Mapping
| Brand Font | Web Font | Tailwind Class | When to Use |
|---|---|---|---|
| Pixellance | SVG export | n/a — `<img>` or inline SVG | Logo wordmark, hero title lockups |
| Aperture | SVG export | n/a — `<img>` or inline SVG | Feature titles, poster treatments |
| Cy Grotesk Wide | Space Grotesk | `font-display` | Section headers, page titles, nav |
| Fraunces | Fraunces Bold Italic | `font-serif font-bold italic` | Editorial headers, pull quotes, onboarding — **always bold + italic** |
| DM Sans / Emmali | Plus Jakarta Sans | `font-sans` | Body copy, UI elements, buttons, captions — **replaces DM Sans as primary body font** |
| Space Mono | Space Mono | `font-mono` | Code, data, timestamps |

### Type Scale + Font Decision Matrix

Each level has **one font** — no ambiguity. The rule is: the larger and more expressive the text, the more distinctive the font.

| Level | Size | Font | Tailwind | Examples |
|---|---|---|---|---|
| Hero | 32–48px | **Fraunces Bold Italic** | `font-serif font-bold italic text-3xl+` | Landing page headline, onboarding splash title |
| Section Header | 24–28px | **Space Grotesk** | `font-display text-2xl font-semibold` | "Your Trips", "Discover", page titles, nav items |
| Card Title | 18–20px | **Space Grotesk** | `font-display text-lg font-medium` | Place card names, trip names, collection titles |
| Body | 15–16px | **Plus Jakarta Sans** | `font-sans text-base` | Descriptions, paragraphs, form labels, button text |
| Caption | 12–13px | **Plus Jakarta Sans** | `font-sans text-xs` | Timestamps, metadata, helper text (use Warm Gray color) |
| Data / Code | 13–14px | **Space Mono** | `font-mono text-sm` | Match scores, coordinates, IDs, code blocks |

**Decision rule:** If the text is a **title or label** (names things, draws the eye), use Space Grotesk. If the text is **content or action** (explains, describes, or prompts action), use Plus Jakarta Sans. Fraunces is reserved for **hero/editorial moments** only — one per page max.

### Files to update
- `src/app/layout.tsx` — Font imports
- `src/app/globals.css` — `@theme inline` font variables
- `src/constants/theme.ts` — FONT object
- Global search for `font-serif` Tailwind class usage → decide case-by-case whether to use `font-serif` (Fraunces) or `font-display` (Space Grotesk)

---

## 3. Logo & Brand Assets

### SVG Assets Inventory (uploaded from Canva)

**Pixel Wordmark** (Pixellance font, "TERRAZZO"):
| File | Color | Format | Use |
|---|---|---|---|
| `Pixellance Terrazzo Logo Dark.svg` | Navy `#1A2D4A` | 3000×1000 wide | Light backgrounds |
| `Pixellance Terrazzo Logo Dark-2.svg` | Cream `#FBF5EC` | 3000×1000 wide | Dark backgrounds |

**Geometric Zigzag Wordmark** (stylized wave/zigzag):
| File | Color | Format | Use |
|---|---|---|---|
| `Pixellance Terrazzo Logo Dark-3.svg` | Navy `#1A2D4A` | 3000×1000 wide | Light backgrounds |
| `Pixellance Terrazzo Logo Dark-4.svg` | Cream `#FBF5EC` | 3000×1000 wide | Dark backgrounds |

**Vertical Icon Mark** (zigzag "T" symbol):
| File | Color | Format | Use |
|---|---|---|---|
| `(178 x 800 px).svg` | Navy `#1A2D4A` | 178×800 portrait | Favicon, app icon, small mark |
| `(178 x 800 px)-2.svg` | Cream `#FBF5EC` | 178×800 portrait | Dark bg small mark |
| Additional variants: `-3` through `-6` | Various | 178×800 portrait | TBD (may be color variants) |

### Implementation Plan

**1. Copy SVGs to `/public/brand/`:**
```
/public/brand/logo-wordmark-navy.svg       (pixel wordmark, navy)
/public/brand/logo-wordmark-cream.svg      (pixel wordmark, cream)
/public/brand/logo-zigzag-navy.svg         (geometric zigzag, navy)
/public/brand/logo-zigzag-cream.svg        (geometric zigzag, cream)
/public/brand/icon-mark-navy.svg           (vertical icon, navy)
/public/brand/icon-mark-cream.svg          (vertical icon, cream)
```

**2. Generate favicon from icon mark:**
- Convert `icon-mark-navy.svg` → `favicon.ico` (16×16, 32×32, 48×48)
- Create `apple-touch-icon.png` (180×180) with cream background + navy mark
- Create `icon-192.png` and `icon-512.png` for PWA manifest
- Update `src/app/layout.tsx` metadata to reference new favicon

**3. Create a `<Logo />` React component:**
```tsx
// src/components/brand/Logo.tsx
// Props: variant ('wordmark' | 'zigzag' | 'icon'), theme ('navy' | 'cream'), className
// Renders the appropriate SVG inline or via <Image>
```

**4. Update the navbar/header** to use the new `<Logo />` component instead of any existing text/placeholder logo.

### Files to create/update
- `/public/brand/` — New directory with all logo SVGs
- `/public/favicon.ico` — Generate from icon mark
- `src/components/brand/Logo.tsx` — New component
- `src/app/layout.tsx` — Favicon metadata
- Navigation/header component — Replace logo

---

## 4. Geometric Brand Pattern (`<BrandPattern />`)

### Pattern Geometry
The brand's geometric zigzag motif is a vertical staircase pattern built on a 2-column grid. All 6 uploaded SVG variants share identical path geometry with different fill colors (Navy, Cream, Coral, Teal, Ochre, Olive). The pattern consists of:
- A 2×9 cell grid (each cell ~66.8px square in a 133.5×600 viewBox)
- Alternating L-shaped steps creating a zigzag from top-left to bottom-right
- Single square caps at the top-left and bottom-right corners

### Implementation: Inline SVG React Component

**Best approach for cross-device fidelity: inline SVG with `currentColor`.**

The path data is baked directly into a React component — no external file loading, no image requests, pixel-perfect at any size via `viewBox` scaling. Color is controlled by `currentColor` so it inherits from the parent's `color` CSS property, or can be overridden with a `color` prop.

**File:** `src/components/brand/BrandPattern.tsx`

**Props:**
```typescript
interface BrandPatternProps {
  color?: 'navy' | 'cream' | 'coral' | 'teal' | 'ochre' | 'olive' | string;
  orientation?: 'vertical' | 'horizontal';
  mirror?: boolean;           // Flip horizontally
  flip?: boolean;             // Flip vertically
  repeat?: number;            // Number of pattern repetitions (default 1)
  className?: string;         // For sizing, positioning via Tailwind
  'aria-hidden'?: boolean;    // Default true (decorative)
}
```

**Transforms:**
- `orientation="horizontal"` → applies `rotate(90)` to the SVG
- `mirror={true}` → applies `scaleX(-1)` (for right-side strips)
- `flip={true}` → applies `scaleY(-1)` (for bottom corners)
- These compose: `mirror + flip` gives 180° rotation

### Usage Patterns (matching the poster)

**Vertical accent strip** (right edge of a card or section):
```tsx
<div className="relative overflow-hidden">
  <BrandPattern
    color="navy"
    className="absolute right-0 top-0 h-full w-8"
  />
  {/* Card content */}
</div>
```

**Corner cluster** (top-right of a hero section):
```tsx
<BrandPattern
  color="navy"
  mirror
  className="absolute top-4 right-4 h-24 w-6"
/>
```

**Bottom-left accent** (mirrored + flipped):
```tsx
<BrandPattern
  color="coral"
  flip
  className="absolute bottom-4 left-4 h-20 w-5"
/>
```

**Horizontal divider** (between sections):
```tsx
<BrandPattern
  color="teal"
  orientation="horizontal"
  className="w-full h-6"
/>
```

**Multi-color strip** (poster right edge, alternating colors):
```tsx
<div className="flex flex-col">
  <BrandPattern color="navy" className="h-16 w-8" />
  <BrandPattern color="coral" className="h-16 w-8" />
  <BrandPattern color="navy" className="h-16 w-8" />
</div>
```

### Where to Use in the App
| Location | Variant | Color |
|---|---|---|
| Hero section (landing/onboarding) | Vertical strip, right edge | Navy on coral bg |
| Place cards (hover/expanded) | Corner cluster, top-right | Teal or ochre |
| Trip planner header | Horizontal divider below title | Coral |
| Collection cards | Corner accent, bottom-left | Olive |
| Empty states | Large centered pattern, low opacity | Warm gray |
| Footer | Vertical strip, left edge | Cream on navy bg |
| Loading skeletons | Repeating horizontal strip | Peach, animated shimmer |
| Discover feed section breaks | Horizontal divider | Alternating brand colors |

---

## 5. Component-Level Changes

### Focus Ring
**Current:** `2px solid honey`
**New:** `2px solid coral` → update `.focus-ring` in globals.css

### Buttons (`.btn-hover`)
**Current:** Honey-based hover states
**New:** Coral primary, Navy secondary, Teal tertiary

### Cards (`.card-hover`)
**Current:** Shadow with warm tones
**New:** Peach-tinted shadows, cream card surfaces, coral accent borders

### Navigation (`.nav-hover`)
**Current:** Warm-white background on hover
**New:** Cream/peach background on hover

### Links (`.link-hover`)
**Current:** Honey color change
**New:** Coral color change on hover

### Slider (`.terrazzo-slider`)
**Current:** Honey thumb and track
**New:** Coral thumb, teal track (or coral track)

### Scrollbar
**Current:** Honey/travertine custom scrollbar
**New:** Warm-gray track, coral thumb

### Animations
Keep all existing animations — they align with the "Dynamic Tension" visual principle. Consider updating any color references within keyframes (e.g., `breathe` glow color → coral glow).

### Files to update
- `src/app/globals.css` — All utility classes listed above
- Individual component files using hardcoded color values (search needed)

---

## 6. Semantic Mapping — Old Classes → New Classes

Across all 122 React components, search and replace Tailwind utility classes:

```
bg-honey       → bg-coral
text-honey     → text-coral
text-honey-text → text-coral-text
border-honey   → border-coral
bg-ink         → bg-navy
text-ink       → text-navy
bg-verde       → bg-teal
text-verde     → text-teal
bg-panton-violet → bg-olive
text-panton-violet → text-olive
bg-panton-orange → bg-coral
text-panton-orange → text-coral
bg-royere-pink → bg-peach
text-royere-pink → text-peach
bg-travertine  → bg-peach (or bg-cream)
text-travertine → text-warm-gray
bg-warm-white  → bg-cream
bg-chrome-yellow → bg-ochre
text-chrome-yellow → text-ochre
bg-linen       → bg-cream
```

### Approach
1. Run `grep -r "bg-honey\|text-honey\|text-ink\|bg-ink\|bg-verde\|text-verde" src/` to get the full list
2. Replace in batches by semantic meaning (primary accent, secondary accent, etc.)
3. Test each page after replacement

---

## 7. Dark Surfaces & Contrast Pairings

The brand guide specifies these high-contrast pairings:

| Pairing | Use Case |
|---|---|
| Navy bg + Peach text | Hero sections, dark feature cards |
| Navy bg + Cream text | Navigation, footer, dark panels |
| Coral bg + Cream text | Primary buttons, banners |
| Coral bg + Navy text | Bold accent sections |
| Teal bg + Navy text | Success states, wellness domain |
| Ochre bg + Navy text | Premium surfaces, gold badges |
| Olive bg + Cream text | Nature/sustainability sections |
| Cream bg + Navy text | Default page canvas |
| Charcoal bg + Cream text | Footer, modal overlays |

### Implementation
- Add utility classes or component variants for dark/colored surfaces
- All text at **full opacity** — no `rgba()` or `opacity-XX` for text anywhere
- Use the font color hierarchy (Navy → Warm Gray → Olive → Coral) instead of fading

---

## 8. Tone & Voice (for AI-generated copy)

Update any prompt templates or copy constants to reflect the brand voice:

| Principle | Do | Don't |
|---|---|---|
| Vivid over vague | "Your next obsession starts in Trastevere." | "Check out restaurants in Rome." |
| Confident over cautious | "Skip the line. Find the alley." | "We offer curated travel experiences." |
| Warm over corporate | "A wine bar that feels like a secret." | "Highly rated establishment with 4.5 stars." |
| Short over sprawling | One punchy sentence | Long explanatory paragraphs |
| Playful over precious | Natural, friend-who-knows energy | Stiff, formal, or ironic |

### Files to review
- Any Claude prompt templates in `/src/` that generate user-facing copy
- Placeholder/empty state strings
- Onboarding copy
- Discover feed editorial templates

---

## 9. Execution Order

Recommended implementation sequence to minimize breakage:

### Phase 1 — Foundation (no visual change yet)
1. Add new CSS variables alongside old ones in `globals.css`
2. Register new Tailwind colors in `@theme inline`
3. Add new font imports in `layout.tsx`
4. Update `theme.ts` constants
5. Copy logo SVGs to `/public/brand/`
6. Create `<Logo />` component

### Phase 2 — Swap (visual changes)
7. Update `--background` and `--foreground` to new values
8. Replace old CSS variable values with new ones
9. Update `INK` opacity palette base in `theme.ts`
10. Update domain colors
11. Replace `DM Serif Display` references with `Fraunces`
12. Add `font-display` (Space Grotesk) to appropriate headers

### Phase 3 — Component Sweep
13. Search and replace Tailwind class names across all 122 components
14. Update utility classes in `globals.css` (focus ring, buttons, slider, scrollbar)
15. Update animation color references
16. Swap logo in navigation header
17. Generate and replace favicon

### Phase 4 — QA & Accessibility
18. Visual regression check on all major pages (home, onboarding, trip planner, place cards, discover feed, collections, profile)
19. WCAG AA contrast audit on all text/background combinations
20. Test reduced-motion behavior still works
21. Verify iOS input zoom prevention still works
22. Cross-browser check (Safari, Chrome, Firefox)
23. Mobile responsive check (375px, 428px, 768px, 1024px, 1440px)

---

## 10. Files Summary

| File | Action |
|---|---|
| `src/app/globals.css` | Major update — colors, fonts, utility classes |
| `src/app/layout.tsx` | Update font imports, favicon metadata |
| `src/constants/theme.ts` | Update FONT object, INK palette base |
| `postcss.config.mjs` | No change needed |
| `/public/brand/` | New — logo SVGs |
| `/public/favicon.ico` | New — generated from icon mark |
| `src/components/brand/Logo.tsx` | New — logo component |
| ~122 component files | Search/replace Tailwind color classes |
| Claude prompt templates | Review for tone alignment |

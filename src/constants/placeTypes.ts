import { type PlaceType } from '@/types';
import type { PerriandIconName } from '@/components/icons/PerriandIcons';
import { COLOR } from '@/constants/theme';

// ─── Icon mapping (unified: neighborhood → 'location') ───

export const TYPE_ICONS: Record<PlaceType, PerriandIconName> = {
  restaurant: 'restaurant',
  hotel: 'hotel',
  rental: 'hotel',
  bar: 'bar',
  cafe: 'cafe',
  museum: 'museum',
  activity: 'activity',
  neighborhood: 'location',
  shop: 'shop',
};

// ─── Brand color per place type ───
// Each type gets a unique brand color for icon tints, badges, and gradients.

export const TYPE_BRAND_COLORS: Record<PlaceType, string> = {
  restaurant: COLOR.coral,
  hotel:      COLOR.navy,
  rental:     COLOR.navy,
  bar:        COLOR.darkTeal,
  cafe:       COLOR.ochre,
  museum:     COLOR.periwinkle,
  activity:   COLOR.olive,
  neighborhood: COLOR.teal,
  shop:       COLOR.peach,
};

// ─── Thumbnail gradients (2-stop, for cards) ───
// Light brand-tinted gradients used as photo placeholders.

function thumbGrad(hex: string): string {
  return `linear-gradient(135deg, ${hex}18, ${hex}28)`;
}

export const THUMB_GRADIENTS: Record<PlaceType, string> = {
  restaurant: thumbGrad(COLOR.coral),
  hotel:      thumbGrad(COLOR.navy),
  rental:     thumbGrad(COLOR.navy),
  bar:        thumbGrad(COLOR.darkTeal),
  cafe:       thumbGrad(COLOR.ochre),
  museum:     thumbGrad(COLOR.periwinkle),
  activity:   thumbGrad(COLOR.olive),
  neighborhood: thumbGrad(COLOR.teal),
  shop:       thumbGrad(COLOR.peach),
};

// ─── Hero photo gradients (3-stop, richer for detail view) ───

function heroGrad(hex: string): string {
  return `linear-gradient(135deg, ${hex}20, ${hex}30, ${hex}40)`;
}

export const PHOTO_GRADIENTS: Record<PlaceType, string> = {
  restaurant: heroGrad(COLOR.coral),
  hotel:      heroGrad(COLOR.navy),
  rental:     heroGrad(COLOR.navy),
  bar:        heroGrad(COLOR.darkTeal),
  cafe:       heroGrad(COLOR.ochre),
  museum:     heroGrad(COLOR.periwinkle),
  activity:   heroGrad(COLOR.olive),
  neighborhood: heroGrad(COLOR.teal),
  shop:       heroGrad(COLOR.peach),
};

// ─── Type colors: muted (for subtle backgrounds) ───

export const TYPE_COLORS_MUTED: Record<PlaceType, string> = {
  restaurant: `${COLOR.coral}30`,
  hotel:      `${COLOR.navy}30`,
  rental:     `${COLOR.navy}30`,
  bar:        `${COLOR.darkTeal}30`,
  cafe:       `${COLOR.ochre}30`,
  museum:     `${COLOR.periwinkle}30`,
  activity:   `${COLOR.olive}30`,
  neighborhood: `${COLOR.teal}30`,
  shop:       `${COLOR.peach}30`,
};

// ─── Type colors: vibrant (for strong indicators) ───

export const TYPE_COLORS_VIBRANT: Record<PlaceType, string> = {
  restaurant: COLOR.coral,
  hotel:      COLOR.navy,
  rental:     COLOR.navy,
  bar:        COLOR.darkTeal,
  cafe:       COLOR.ochre,
  museum:     COLOR.periwinkle,
  activity:   COLOR.olive,
  neighborhood: COLOR.teal,
  shop:       COLOR.peach,
};

// ─── Filter chip arrays ───

export type FilterChip = { value: string; label: string; icon: PerriandIconName };

/** Short verb labels, no "All" — used in PicksStrip */
export const TYPE_CHIPS_SHORT: FilterChip[] = [
  { value: 'restaurant', label: 'Eat', icon: 'restaurant' },
  { value: 'cafe', label: 'Cafe', icon: 'cafe' },
  { value: 'bar', label: 'Drink', icon: 'bar' },
  { value: 'museum', label: 'See', icon: 'museum' },
  { value: 'activity', label: 'Do', icon: 'activity' },
  { value: 'hotel', label: 'Stay', icon: 'hotel' },
  { value: 'rental', label: 'Rental', icon: 'hotel' },
  { value: 'shop', label: 'Shop', icon: 'shop' },
  { value: 'neighborhood', label: 'Walk', icon: 'location' },
];

/** Short verb labels with "All" prepended — used in BrowseAllOverlay */
export const TYPE_CHIPS_WITH_ALL: FilterChip[] = [
  { value: 'all', label: 'All', icon: 'discover' },
  { value: 'restaurant', label: 'Eat', icon: 'restaurant' },
  { value: 'cafe', label: 'Cafe', icon: 'cafe' },
  { value: 'bar', label: 'Drink', icon: 'bar' },
  { value: 'museum', label: 'See', icon: 'museum' },
  { value: 'activity', label: 'Do', icon: 'activity' },
  { value: 'neighborhood', label: 'Walk', icon: 'location' },
  { value: 'shop', label: 'Shop', icon: 'shop' },
  { value: 'hotel', label: 'Stay', icon: 'hotel' },
  { value: 'rental', label: 'Rental', icon: 'hotel' },
];

/** Full-name labels — used in picks components */
export const TYPE_CHIPS_FULL: FilterChip[] = [
  { value: 'all', label: 'All types', icon: 'discover' },
  { value: 'restaurant', label: 'Restaurant', icon: 'restaurant' },
  { value: 'cafe', label: 'Cafe', icon: 'cafe' },
  { value: 'bar', label: 'Bar', icon: 'bar' },
  { value: 'museum', label: 'Museum', icon: 'museum' },
  { value: 'activity', label: 'Activity', icon: 'activity' },
  { value: 'hotel', label: 'Hotel', icon: 'hotel' },
  { value: 'rental', label: 'Rental', icon: 'hotel' },
  { value: 'neighborhood', label: 'Area', icon: 'location' },
  { value: 'shop', label: 'Shop', icon: 'shop' },
];

import { T, type PlaceType } from '@/types';
import type { PerriandIconName } from '@/components/icons/PerriandIcons';

// ─── Icon mapping (unified: neighborhood → 'location') ───

export const TYPE_ICONS: Record<PlaceType, PerriandIconName> = {
  restaurant: 'restaurant',
  hotel: 'hotel',
  bar: 'bar',
  cafe: 'cafe',
  museum: 'museum',
  activity: 'activity',
  neighborhood: 'location',
  shop: 'shop',
};

// ─── Thumbnail gradients (2-stop, for cards) ───

export const THUMB_GRADIENTS: Record<PlaceType, string> = {
  restaurant: 'linear-gradient(135deg, #d8c8ae, #c0ab8e)',
  hotel: 'linear-gradient(135deg, #d0c8d8, #b8b0c0)',
  bar: 'linear-gradient(135deg, #c0d0c8, #a8c0b0)',
  cafe: 'linear-gradient(135deg, #d8d0c0, #c8c0b0)',
  museum: 'linear-gradient(135deg, #c0c8d0, #a8b0b8)',
  activity: 'linear-gradient(135deg, #c0d0c8, #a8b8a8)',
  neighborhood: 'linear-gradient(135deg, #d0d8c8, #b8c0a8)',
  shop: 'linear-gradient(135deg, #d8c8b8, #c0b0a0)',
};

// ─── Hero photo gradients (3-stop, richer for detail view) ───

export const PHOTO_GRADIENTS: Record<PlaceType, string> = {
  restaurant: 'linear-gradient(135deg, #d8c0a0, #c0a880, #b89870)',
  hotel: 'linear-gradient(135deg, #c8c0d0, #b0a8b8, #a098a8)',
  bar: 'linear-gradient(135deg, #d0c0a0, #b8a888, #a89878)',
  cafe: 'linear-gradient(135deg, #d8d0c0, #c8c0b0, #b8b0a0)',
  museum: 'linear-gradient(135deg, #c0c8d0, #a8b0b8, #98a0a8)',
  activity: 'linear-gradient(135deg, #c0d0c8, #a8b8a8, #98a898)',
  neighborhood: 'linear-gradient(135deg, #d0d8c8, #b8c0a8, #a8b098)',
  shop: 'linear-gradient(135deg, #d8c8b8, #c0b0a0, #b0a090)',
};

// ─── Type colors: muted (for subtle backgrounds) ───

export const TYPE_COLORS_MUTED: Record<PlaceType, string> = {
  restaurant: '#c0ab8e',
  hotel: '#b8b0c0',
  bar: '#a8c0b0',
  cafe: '#c8c0b0',
  museum: '#a8b0b8',
  activity: '#a8b8a8',
  neighborhood: '#b8c0a8',
  shop: '#c0b0a0',
};

// ─── Type colors: vibrant (for strong indicators) ───

export const TYPE_COLORS_VIBRANT: Record<PlaceType, string> = {
  restaurant: T.royerePink,
  hotel: T.honey,
  bar: T.pantonViolet,
  museum: T.verde,
  cafe: T.chromeYellow,
  activity: T.pantonOrange,
  neighborhood: T.ghost,
  shop: T.amber,
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
];

/** Full-name labels — used in PoolTray */
export const TYPE_CHIPS_FULL: FilterChip[] = [
  { value: 'all', label: 'All types', icon: 'discover' },
  { value: 'restaurant', label: 'Restaurant', icon: 'restaurant' },
  { value: 'cafe', label: 'Cafe', icon: 'cafe' },
  { value: 'bar', label: 'Bar', icon: 'bar' },
  { value: 'museum', label: 'Museum', icon: 'museum' },
  { value: 'activity', label: 'Activity', icon: 'activity' },
  { value: 'hotel', label: 'Hotel', icon: 'hotel' },
  { value: 'neighborhood', label: 'Area', icon: 'location' },
  { value: 'shop', label: 'Shop', icon: 'shop' },
];

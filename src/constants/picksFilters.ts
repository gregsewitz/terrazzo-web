import type { PerriandIconName } from '@/components/icons/PerriandIcons';
import type { FilterType } from '@/hooks/useTypeFilter';

export const TYPE_CHIPS: { value: FilterType; label: string; icon: PerriandIconName }[] = [
  { value: 'restaurant', label: 'Eat', icon: 'restaurant' },
  { value: 'cafe', label: 'Cafe', icon: 'cafe' },
  { value: 'bar', label: 'Drink', icon: 'bar' },
  { value: 'museum', label: 'See', icon: 'museum' },
  { value: 'activity', label: 'Do', icon: 'activity' },
  { value: 'hotel', label: 'Stay', icon: 'hotel' },
  { value: 'shop', label: 'Shop', icon: 'shop' },
  { value: 'neighborhood', label: 'Walk', icon: 'location' },
];

export const SOURCE_FILTERS = [
  { value: 'all', label: 'All sources' },
  { value: 'article', label: 'Articles' },
  { value: 'friend', label: 'Friends' },
  { value: 'email', label: 'Email' },
  { value: 'maps', label: 'Maps' },
] as const;

export type SourceFilter = typeof SOURCE_FILTERS[number]['value'];

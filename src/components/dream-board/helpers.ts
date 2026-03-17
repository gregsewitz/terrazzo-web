import { INK } from '@/constants/theme';

// ─── Vibe accent colors ───
export const VIBE_COLORS = [
  { value: 'honey', label: 'Warm', bg: 'rgba(238,113,109,0.10)', border: 'rgba(238,113,109,0.25)' },
  { value: 'verde', label: 'Fresh', bg: 'rgba(58,128,136,0.08)', border: 'rgba(58,128,136,0.20)' },
  { value: 'blue', label: 'Cool', bg: 'rgba(58,140,180,0.08)', border: 'rgba(58,140,180,0.20)' },
  { value: 'rose', label: 'Rosy', bg: 'rgba(180,80,80,0.08)', border: 'rgba(180,80,80,0.20)' },
  { value: 'violet', label: 'Rich', bg: 'rgba(104,68,160,0.08)', border: 'rgba(104,68,160,0.20)' },
];

export function getVibeBg(color?: string): string {
  return VIBE_COLORS.find(c => c.value === color)?.bg || VIBE_COLORS[0].bg;
}

export function getVibeBorder(color?: string): string {
  return VIBE_COLORS.find(c => c.value === color)?.border || VIBE_COLORS[0].border;
}

// ─── Accent color options (for generic cards) ───
export const ACCENT_COLORS = [
  { value: undefined, bg: INK['06'] },
  { value: 'verde', bg: 'rgba(58,128,136,0.12)' },
  { value: 'honey', bg: 'rgba(238,113,109,0.12)' },
  { value: 'blue', bg: 'rgba(58,140,180,0.12)' },
  { value: 'rose', bg: 'rgba(180,80,80,0.12)' },
];

export function getAccentBg(color?: string): string {
  return ACCENT_COLORS.find(c => c.value === color)?.bg || 'white';
}

// ─── URL detection ───
export const URL_REGEX = /^https?:\/\/[^\s]+$/i;

export function isUrl(text: string): boolean {
  return URL_REGEX.test(text.trim());
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Terrazzo — Perriand Sketches Icon System
 *
 * Minimal single-weight line icons inspired by mid-century architectural drawings.
 * 1.5px strokes in Ink on light / Warm White on dark. Each icon carries one small
 * filled accent dot in a domain color — the icon system's version of the red chip
 * in the Table Form logo.
 *
 * ViewBox: 0 0 32 32
 * Stroke: 1.5px, round caps & joins
 * Accent dot: r=1–1.5, filled in brand color
 *
 * Categories:
 *   Place types — restaurant, bar, hotel, cafe, museum, activity, neighborhood, shop
 *   Time slots — breakfast, morning, lunch, afternoon, dinner, evening
 *   Taste domains — design, character, food, location, service, wellness
 *   Reactions — myPlace, enjoyed, mixed, notMe
 *   Sources — email, friend, terrazzo, maps, article, manual
 *   Navigation — discover, trips, saved, profile
 *   Misc — star, edit, check, close
 */
'use client';

import React from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PerriandIconName =
  // Place types
  | 'restaurant' | 'bar' | 'hotel' | 'cafe' | 'museum'
  | 'activity' | 'neighborhood' | 'shop'
  // Time slots
  | 'breakfast' | 'morning' | 'lunch' | 'afternoon' | 'dinner' | 'evening'
  // Taste domains
  | 'design' | 'character' | 'food' | 'location' | 'service' | 'wellness'
  // Reactions
  | 'myPlace' | 'enjoyed' | 'mixed' | 'notMe'
  // Sources
  | 'email' | 'friend' | 'terrazzo' | 'maps' | 'article' | 'manual'
  // Navigation
  | 'discover' | 'trips' | 'plan' | 'saved' | 'profile'
  // Misc
  | 'star' | 'edit' | 'check' | 'close' | 'heart' | 'pin'
  | 'sparkle' | 'summer' | 'lightning' | 'bookmark' | 'add'
  // Collaboration / Activity
  | 'invite' | 'wave' | 'lightbulb' | 'acceptCircle' | 'rejectCircle'
  | 'chatBubble' | 'loveReaction' | 'unsure' | 'swap';

interface PerriandIconProps {
  name: PerriandIconName;
  size?: number;
  /** Stroke color — defaults to Ink (#1c1a17) */
  color?: string;
  /** Accent dot color — overrides the default per-icon accent */
  accent?: string;
  /** Opacity for inactive states */
  opacity?: number;
  className?: string;
  style?: React.CSSProperties;
}

// ─── Default accent colors per icon ──────────────────────────────────────────

const ACCENT: Partial<Record<PerriandIconName, string>> = {
  // Place types
  restaurant: '#e87080', // Royère Pink
  bar:        '#6844a0', // Panton Violet
  hotel:      '#c8923a', // Honey
  cafe:       '#eeb420', // Chrome Yellow
  museum:     '#2a7a56', // Verde
  activity:   '#e86830', // Panton Orange
  neighborhood: '#6b8b9a', // Ghost
  shop:       '#a06c28', // Amber
  // Time slots
  breakfast:  '#c8923a',
  morning:    '#eeb420',
  lunch:      '#e87080',
  afternoon:  '#e86830',
  dinner:     '#1c1a17',
  evening:    '#6844a0',
  // Taste domains
  design:     '#d63020',
  character:  '#6844a0',
  food:       '#e87080',
  location:   '#2a7a56',
  service:    '#a06c28',
  wellness:   '#eeb420',
  // Reactions (use reaction color as accent)
  myPlace:    '#2a7a56',
  enjoyed:    '#c8923a',
  mixed:      '#eeb420',
  notMe:      '#d63020',
  // Sources
  friend:     '#2a7a56',
  terrazzo:   '#d63020',
  // Navigation
  plan:       '#d63020',
  // Misc
  star:       '#eeb420',
  pin:        '#2a7a56',
  sparkle:    '#eeb420',
  summer:     '#e86830',
  lightning:  '#e86830',
  // Collaboration / Activity
  invite:       '#6366f1',
  wave:         '#2a7a56',
  lightbulb:    '#eeb420',
  acceptCircle: '#2a7a56',
  rejectCircle: '#d63020',
  chatBubble:   '#c8923a',
  loveReaction: '#e87080',
  unsure:       '#6b8b9a',
  swap:         '#6366f1',
};

// ─── SVG Path Renderers ──────────────────────────────────────────────────────

type PathRenderer = (s: string, a: string) => React.ReactNode;

const PATHS: Record<PerriandIconName, PathRenderer> = {
  // ── Place Types ──────────────────────────────────────────────────────────

  restaurant: (s, a) => (
    <>
      <line x1="12" y1="6" x2="12" y2="26" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12,6 C12,6 9,8 9,12 C9,14 10,15 12,15" stroke={s} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <line x1="20" y1="6" x2="20" y2="26" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20,6 C20,6 23,9 20,14" stroke={s} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="12" cy="26" r="1" fill={a} />
    </>
  ),

  bar: (s, a) => (
    <>
      <path d="M9,8 L16,18 L23,8" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="16" y1="18" x2="16" y2="25" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="26" x2="21" y2="26" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="19" cy="11" r="1" fill={a} />
    </>
  ),

  hotel: (s, a) => (
    <>
      <line x1="6" y1="24" x2="26" y2="24" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8,24 L8,16 C8,16 10,12 16,12 C22,12 24,16 24,16 L24,24" stroke={s} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M9,16 C9,14 11,12 13,12 C15,12 16,14 16,14" stroke={s} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity=".5" />
      <circle cx="22" cy="14" r="1" fill={a} />
    </>
  ),

  cafe: (s, a) => (
    <>
      <path d="M8,13 L8,22 C8,25 11,26 15,26 C19,26 22,25 22,22 L22,13" stroke={s} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M22,15 C22,15 25,15 25,18 C25,21 22,21 22,21" stroke={s} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M13,10 C13,8 14,7 14,7" stroke={s} strokeWidth="1.2" strokeLinecap="round" opacity=".5" fill="none" />
      <path d="M17,9 C17,7 18,6 18,6" stroke={s} strokeWidth="1.2" strokeLinecap="round" opacity=".5" fill="none" />
      <circle cx="10" cy="13" r="1" fill={a} />
    </>
  ),

  museum: (s, a) => (
    <>
      <path d="M7,14 L16,8 L25,14" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="10" y1="14" x2="10" y2="24" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="14" x2="16" y2="24" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="22" y1="14" x2="22" y2="24" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7" y1="24" x2="25" y2="24" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="10" r="1" fill={a} />
    </>
  ),

  activity: (s, a) => (
    <>
      <circle cx="16" cy="16" r="9" stroke={s} strokeWidth="1.5" fill="none" />
      <path d="M16,7 L18,14 L16,16 L22,18" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="16" cy="16" r="1.5" fill={a} />
    </>
  ),

  neighborhood: (s, a) => (
    <>
      <path d="M6,26 L12,14 L12,8" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M12,14 L20,14 L26,26" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M20,14 L20,8" stroke={s} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <line x1="6" y1="26" x2="26" y2="26" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="20" r="1" fill={a} />
    </>
  ),

  shop: (s, a) => (
    <>
      <rect x="8" y="14" width="16" height="12" rx="2" stroke={s} strokeWidth="1.5" fill="none" />
      <path d="M12,14 C12,10 13,8 16,8 C19,8 20,10 20,14" stroke={s} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="16" cy="20" r="1" fill={a} />
    </>
  ),

  // ── Time Slots ───────────────────────────────────────────────────────────

  breakfast: (s, a) => (
    <>
      <path d="M9,12 L9,22 C9,25 12,26 16,26 C20,26 23,25 23,22 L23,12" stroke={s} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M23,14 C23,14 26,14 26,17 C26,20 23,20 23,20" stroke={s} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="14" cy="9" r="1" fill={a} />
    </>
  ),

  morning: (s, a) => (
    <>
      <circle cx="16" cy="16" r="5" stroke={s} strokeWidth="1.5" fill="none" />
      <line x1="16" y1="7" x2="16" y2="9" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="23" x2="16" y2="25" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7" y1="16" x2="9" y2="16" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="23" y1="16" x2="25" y2="16" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9.5" y1="9.5" x2="11" y2="11" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="21" y1="21" x2="22.5" y2="22.5" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="16" r="1" fill={a} />
    </>
  ),

  lunch: (s, a) => (
    <>
      <line x1="12" y1="8" x2="12" y2="24" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12,8 C12,8 9,10 9,13 C9,15 10,16 12,16" stroke={s} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <line x1="20" y1="8" x2="20" y2="24" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20,8 C20,8 23,10 20,14" stroke={s} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="12" cy="24" r="1" fill={a} />
    </>
  ),

  afternoon: (s, a) => (
    <>
      <circle cx="16" cy="16" r="7" stroke={s} strokeWidth="1.5" fill="none" />
      <path d="M16,9 A7,7 0 0 1 16,23" fill={s} opacity=".08" />
      <circle cx="16" cy="16" r="1" fill={a} />
    </>
  ),

  dinner: (s, a) => (
    <>
      <path d="M20,8 C15,8 11,12 11,17 C11,22 15,26 20,26 C17,25 14,21 14,17 C14,13 17,9 20,8Z" stroke={s} strokeWidth="1.5" fill="none" />
      <circle cx="18" cy="12" r="1" fill={a} opacity=".3" />
    </>
  ),

  evening: (s, a) => (
    <>
      <path d="M10,8 L16,18 L22,8" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="16" y1="18" x2="16" y2="24" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="25" x2="20" y2="25" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="19" cy="11" r="1" fill={a} />
    </>
  ),

  // ── Taste Domains ────────────────────────────────────────────────────────

  design: (s, a) => (
    <>
      <path d="M10,24 L10,14 L16,9 L22,14 L22,24" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="10" y1="18" x2="22" y2="18" stroke={s} strokeWidth="1.2" strokeLinecap="round" opacity=".5" />
      <circle cx="16" cy="11" r="1.5" fill={a} />
    </>
  ),

  character: (s, a) => (
    <>
      <circle cx="16" cy="12" r="4" stroke={s} strokeWidth="1.5" fill="none" />
      <path d="M9,26 C9,21 12,18 16,18 C20,18 23,21 23,26" stroke={s} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="16" cy="12" r="1.5" fill={a} />
    </>
  ),

  food: (s, a) => (
    <>
      <circle cx="16" cy="16" r="8" stroke={s} strokeWidth="1.5" fill="none" />
      <circle cx="16" cy="16" r="4" stroke={s} strokeWidth="1" opacity=".4" fill="none" />
      <circle cx="16" cy="16" r="2" fill={a} />
    </>
  ),

  location: (s, a) => (
    <>
      <path d="M16,6 C16,6 24,14 24,19 C24,24 20,26 16,26 C12,26 8,24 8,19 C8,14 16,6 16,6Z" stroke={s} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="16" cy="18" r="1.5" fill={a} />
    </>
  ),

  service: (s, a) => (
    <>
      <path d="M10,18 L14,12 L18,22 L22,14 L26,18" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="14" cy="12" r="1.5" fill={a} />
    </>
  ),

  wellness: (s, a) => (
    <>
      <path d="M16,8 C16,8 8,12 8,18 C8,23 12,26 16,26 C20,26 24,23 24,18 C24,12 16,8 16,8Z" stroke={s} strokeWidth="1.5" fill="none" />
      <path d="M12,18 C14,16 18,16 20,18" stroke={s} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity=".4" />
      <circle cx="16" cy="14" r="1.5" fill={a} />
    </>
  ),

  // ── Reactions ────────────────────────────────────────────────────────────

  myPlace: (s, _a) => (
    <path d="M16,26 C16,26 26,20 26,13 C26,10 24,8 21,8 C19,8 17,9 16,11 C15,9 13,8 11,8 C8,8 6,10 6,13 C6,20 16,26 16,26Z" stroke={s} strokeWidth="1.5" fill="none" />
  ),

  enjoyed: (s, _a) => (
    <path d="M8,16 L14,22 L24,10" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  ),

  mixed: (s, _a) => (
    <>
      <line x1="8" y1="16" x2="24" y2="16" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10,12 L8,16 L10,20" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M22,12 L24,16 L22,20" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),

  notMe: (s, _a) => (
    <>
      <line x1="10" y1="10" x2="22" y2="22" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="22" y1="10" x2="10" y2="22" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),

  // ── Sources ──────────────────────────────────────────────────────────────

  email: (s, _a) => (
    <>
      <rect x="6" y="10" width="20" height="14" rx="2" stroke={s} strokeWidth="1.5" fill="none" />
      <path d="M6,13 L16,20 L26,13" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),

  friend: (s, a) => (
    <>
      <circle cx="16" cy="12" r="4" stroke={s} strokeWidth="1.5" fill="none" />
      <path d="M9,26 C9,22 12,19 16,19 C20,19 23,22 23,26" stroke={s} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="16" cy="12" r="1" fill={a} />
    </>
  ),

  terrazzo: (s, a) => (
    <>
      {/* Simplified Table Form silhouette */}
      <path d="M6,16 C5,11 9,8 16,7 C23,8 27,11 26,16 C27,21 23,25 16,26 C9,25 5,21 6,16Z" stroke={s} strokeWidth="1.5" fill="none" />
      <circle cx="22" cy="12" r="1.5" fill={a} />
    </>
  ),

  maps: (s, a) => (
    <>
      <path d="M16,6 C16,6 24,14 24,19 C24,24 20,26 16,26 C12,26 8,24 8,19 C8,14 16,6 16,6Z" stroke={s} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="16" cy="18" r="2.5" stroke={s} strokeWidth="1.5" fill="none" />
      <circle cx="16" cy="18" r="1" fill={a || '#e86830'} />
    </>
  ),

  article: (s, a) => (
    <>
      <rect x="8" y="6" width="16" height="20" rx="2" stroke={s} strokeWidth="1.5" fill="none" />
      <line x1="11" y1="11" x2="21" y2="11" stroke={s} strokeWidth="1.2" strokeLinecap="round" opacity=".5" />
      <line x1="11" y1="15" x2="21" y2="15" stroke={s} strokeWidth="1.2" strokeLinecap="round" opacity=".5" />
      <line x1="11" y1="19" x2="17" y2="19" stroke={s} strokeWidth="1.2" strokeLinecap="round" opacity=".5" />
      <circle cx="20" cy="8" r="1" fill={a || '#c8923a'} />
    </>
  ),

  manual: (s, a) => (
    <>
      <path d="M20,7 L25,12 L13,24 L8,24 L8,19 Z" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="17" y1="10" x2="22" y2="15" stroke={s} strokeWidth="1.2" strokeLinecap="round" opacity=".4" />
      <circle cx="10" cy="22" r="1" fill={a || '#1c1a17'} />
    </>
  ),

  // ── Navigation ───────────────────────────────────────────────────────────

  discover: (s, _a) => (
    <>
      <circle cx="16" cy="16" r="9" stroke={s} strokeWidth="1.5" fill="none" />
      <circle cx="16" cy="16" r="2" fill={s} />
    </>
  ),

  trips: (s, a) => (
    <>
      <rect x="6" y="8" width="20" height="16" rx="2" stroke={s} strokeWidth="1.5" fill="none" />
      <line x1="6" y1="14" x2="26" y2="14" stroke={s} strokeWidth="1.5" />
      <circle cx="12" cy="20" r="1" fill={a || '#1c1a17'} />
    </>
  ),

  plan: (s, a) => (
    <>
      <path d="M16,6 L26,26 L6,26 Z" stroke={s} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      <line x1="16" y1="14" x2="16" y2="20" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="11" r="1" fill={a || '#d63020'} />
    </>
  ),

  saved: (s, _a) => (
    <path d="M16,26 C16,26 26,20 26,13 C26,10 24,8 21,8 C19,8 17,9 16,11 C15,9 13,8 11,8 C8,8 6,10 6,13 C6,20 16,26 16,26Z" stroke={s} strokeWidth="1.5" fill="none" />
  ),

  profile: (s, _a) => (
    <>
      <circle cx="16" cy="12" r="4" stroke={s} strokeWidth="1.5" fill="none" />
      <path d="M9,26 C9,22 12,19 16,19 C20,19 23,22 23,26" stroke={s} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </>
  ),

  // ── Misc ─────────────────────────────────────────────────────────────────

  star: (s, a) => (
    <>
      <path d="M16,6 L18.5,12.5 L25.5,13 L20,18 L21.5,25 L16,21.5 L10.5,25 L12,18 L6.5,13 L13.5,12.5 Z" stroke={s} strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <circle cx="16" cy="14" r="1" fill={a} />
    </>
  ),

  edit: (s, a) => (
    <>
      <path d="M20,7 L25,12 L13,24 L8,24 L8,19 Z" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="10" cy="22" r="1" fill={a || '#1c1a17'} />
    </>
  ),

  check: (s, _a) => (
    <path d="M8,16 L14,22 L24,10" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  ),

  close: (s, _a) => (
    <>
      <line x1="10" y1="10" x2="22" y2="22" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="22" y1="10" x2="10" y2="22" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),

  heart: (s, _a) => (
    <path d="M16,26 C16,26 26,20 26,13 C26,10 24,8 21,8 C19,8 17,9 16,11 C15,9 13,8 11,8 C8,8 6,10 6,13 C6,20 16,26 16,26Z" stroke={s} strokeWidth="1.5" fill="none" />
  ),

  pin: (s, a) => (
    <>
      <path d="M16,6 C16,6 24,14 24,19 C24,24 20,26 16,26 C12,26 8,24 8,19 C8,14 16,6 16,6Z" stroke={s} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="16" cy="18" r="1.5" fill={a} />
    </>
  ),

  sparkle: (s, a) => (
    <>
      <path d="M16,4 L18,12 L26,14 L18,16 L16,24 L14,16 L6,14 L14,12Z" stroke={s} strokeWidth="1.3" strokeLinejoin="round" fill="none" />
      <circle cx="22" cy="8" r="1.2" fill={a} />
      <circle cx="10" cy="22" r="1" fill={a} opacity="0.5" />
    </>
  ),

  summer: (s, a) => (
    <>
      <circle cx="16" cy="16" r="5" stroke={s} strokeWidth="1.5" fill="none" />
      <line x1="16" y1="5" x2="16" y2="8" stroke={s} strokeWidth="1.3" strokeLinecap="round" />
      <line x1="16" y1="24" x2="16" y2="27" stroke={s} strokeWidth="1.3" strokeLinecap="round" />
      <line x1="5" y1="16" x2="8" y2="16" stroke={s} strokeWidth="1.3" strokeLinecap="round" />
      <line x1="24" y1="16" x2="27" y2="16" stroke={s} strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="16" cy="16" r="1.5" fill={a} />
    </>
  ),

  lightning: (s, a) => (
    <>
      <path d="M18,4 L10,17 L15,17 L13,28 L23,14 L17,14Z" stroke={s} strokeWidth="1.3" strokeLinejoin="round" fill="none" />
      <circle cx="16" cy="16" r="1.2" fill={a} />
    </>
  ),

  bookmark: (s, a) => (
    <>
      <path d="M10,6 L10,26 L16,21 L22,26 L22,6 Z" stroke={s} strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <circle cx="16" cy="12" r="1.2" fill={a || 'var(--t-verde, #2a7a56)'} />
    </>
  ),

  add: (s, _a) => (
    <>
      <line x1="16" y1="8" x2="16" y2="24" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="8" y1="16" x2="24" y2="16" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),

  // ── Collaboration / Activity ───────────────────────────────────────────

  invite: (s, a) => (
    <>
      {/* Envelope */}
      <rect x="6" y="11" width="16" height="12" rx="2" stroke={s} strokeWidth="1.5" fill="none" />
      <path d="M6,14 L14,19 L22,14" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Plus badge */}
      <line x1="25" y1="8" x2="25" y2="14" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="22" y1="11" x2="28" y2="11" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="13" r="1" fill={a} />
    </>
  ),

  wave: (s, a) => (
    <>
      {/* Person silhouette */}
      <circle cx="14" cy="11" r="3.5" stroke={s} strokeWidth="1.5" fill="none" />
      <path d="M7,26 C7,22 10,19 14,19 C18,19 21,22 21,26" stroke={s} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Raised hand / greeting arc */}
      <path d="M22,14 C22,11 24,9 26,9" stroke={s} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M23,17 C24,15 26,14 27,14" stroke={s} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity=".5" />
      <circle cx="14" cy="11" r="1" fill={a} />
    </>
  ),

  lightbulb: (s, a) => (
    <>
      <path d="M16,6 C11.5,6 8,9.5 8,14 C8,17 10,19 12,20.5 L12,24 L20,24 L20,20.5 C22,19 24,17 24,14 C24,9.5 20.5,6 16,6Z" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="12" y1="27" x2="20" y2="27" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14,17 L14,20" stroke={s} strokeWidth="1" strokeLinecap="round" opacity=".4" />
      <path d="M18,17 L18,20" stroke={s} strokeWidth="1" strokeLinecap="round" opacity=".4" />
      <circle cx="16" cy="12" r="1.5" fill={a} />
    </>
  ),

  acceptCircle: (s, a) => (
    <>
      <circle cx="16" cy="16" r="9" stroke={s} strokeWidth="1.5" fill="none" />
      <path d="M11,16 L14.5,19.5 L21,12.5" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="16" cy="8" r="1" fill={a} />
    </>
  ),

  rejectCircle: (s, a) => (
    <>
      <circle cx="16" cy="16" r="9" stroke={s} strokeWidth="1.5" fill="none" />
      <line x1="12" y1="12" x2="20" y2="20" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="20" y1="12" x2="12" y2="20" stroke={s} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="8" r="1" fill={a} />
    </>
  ),

  chatBubble: (s, a) => (
    <>
      <path d="M8,8 L24,8 C25.1,8 26,8.9 26,10 L26,20 C26,21.1 25.1,22 24,22 L14,22 L10,26 L10,22 L8,22 C6.9,22 6,21.1 6,20 L6,10 C6,8.9 6.9,8 8,8Z" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="11" y1="13" x2="21" y2="13" stroke={s} strokeWidth="1.2" strokeLinecap="round" opacity=".4" />
      <line x1="11" y1="17" x2="17" y2="17" stroke={s} strokeWidth="1.2" strokeLinecap="round" opacity=".4" />
      <circle cx="22" cy="10" r="1" fill={a} />
    </>
  ),

  loveReaction: (s, a) => (
    <>
      <path d="M16,26 C16,26 26,20 26,13 C26,10 24,8 21,8 C19,8 17,9 16,11 C15,9 13,8 11,8 C8,8 6,10 6,13 C6,20 16,26 16,26Z" stroke={s} strokeWidth="1.5" fill="none" />
      <circle cx="16" cy="16" r="1.5" fill={a} />
    </>
  ),

  unsure: (s, a) => (
    <>
      <circle cx="16" cy="16" r="9" stroke={s} strokeWidth="1.5" fill="none" />
      <path d="M13,12 C13,10 14.5,9 16,9 C17.5,9 19,10 19,12 C19,14 16,14.5 16,17" stroke={s} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="16" cy="21" r="1.2" fill={a} />
    </>
  ),

  swap: (s, a) => (
    <>
      <path d="M8,12 L24,12" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M20,8 L24,12 L20,16" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M24,20 L8,20" stroke={s} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12,16 L8,20 L12,24" stroke={s} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="16" cy="16" r="1" fill={a} />
    </>
  ),
};

// ─── Component ───────────────────────────────────────────────────────────────

export function PerriandIcon({
  name,
  size = 20,
  color = '#1c1a17',
  accent,
  opacity = 1,
  className,
  style,
}: PerriandIconProps) {
  const renderer = PATHS[name];
  if (!renderer) return null;

  const accentColor = accent || ACCENT[name] || color;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      style={{ opacity, flexShrink: 0, ...style }}
      className={className}
      aria-hidden="true"
    >
      {renderer(color, accentColor)}
    </svg>
  );
}

// ─── Convenience: icon name lookups for constants ────────────────────────────

/** Place type → icon name mapping */
/** Time slot → icon name mapping */
export const SLOT_ICON_NAMES: Record<string, PerriandIconName> = {
  breakfast: 'breakfast',
  morning: 'morning',
  lunch: 'lunch',
  afternoon: 'afternoon',
  dinner: 'dinner',
  evening: 'evening',
};

/** Taste domain → icon name mapping */
export const DOMAIN_ICON_NAMES: Record<string, PerriandIconName> = {
  Design: 'design',
  Character: 'character',
  Food: 'food',
  Location: 'location',
  Service: 'service',
  Wellness: 'wellness',
};

/** Ghost source → icon name mapping */
export const SOURCE_ICON_NAMES: Record<string, PerriandIconName> = {
  email: 'email',
  friend: 'friend',
  terrazzo: 'terrazzo',
  maps: 'maps',
  article: 'article',
  manual: 'manual',
};

/** Reaction → icon name mapping */
export const REACTION_ICON_NAMES: Record<string, PerriandIconName> = {
  myPlace: 'myPlace',
  enjoyed: 'enjoyed',
  mixed: 'mixed',
  notMe: 'notMe',
};

/** Navigation → icon name mapping */
export const NAV_ICON_NAMES: Record<string, PerriandIconName> = {
  discover: 'discover',
  trips: 'trips',
  plan: 'plan',
  saved: 'saved',
  profile: 'profile',
};

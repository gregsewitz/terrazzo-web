import { INK } from '@/constants/theme';
import { DreamBoardEntryType } from '@/types';

// ─── Section presets ───
export const SECTION_PRESETS = [
  { label: 'Restaurants', icon: 'restaurant' as const },
  { label: 'Hotels', icon: 'hotel' as const },
  { label: 'Things to Do', icon: 'discover' as const },
  { label: 'Getting Around', icon: 'transport' as const },
  { label: 'Logistics', icon: 'check' as const },
  { label: 'Shopping', icon: 'shop' as const },
  { label: 'To Research', icon: 'lightbulb' as const },
];

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

// ─── Smart detection: confirmation codes ───
// Matches: CONF: ABC123, #ABC123, Booking: XY-9283, Confirmation ABC123
const CONF_PATTERNS = [
  /(?:conf(?:irmation)?|booking|reservation|ref(?:erence)?)\s*[:#]?\s*([A-Z0-9][-A-Z0-9]{4,})/gi,
  /#([A-Z0-9]{6,})/g,
];

export interface DetectedCode {
  code: string;
  start: number;
  end: number;
}

export function detectConfirmationCodes(text: string): DetectedCode[] {
  const results: DetectedCode[] = [];
  for (const pattern of CONF_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      results.push({
        code: match[1] || match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }
  return results;
}

// ─── Smart type detection from raw input ───
export function detectEntryType(text: string): DreamBoardEntryType {
  if (isUrl(text.trim())) return 'link';
  return 'text';
}

// ─── Lightweight markdown rendering ───
// Supports: **bold**, *italic*, `code`, inline URLs

export type MarkdownSegment =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'italic'; content: string }
  | { type: 'code'; content: string }
  | { type: 'link'; url: string; label: string };

export function parseInlineMarkdown(text: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];
  // Combined regex for bold, italic, inline code, and URLs
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|((https?:\/\/[^\s]+))/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    if (match[2]) {
      segments.push({ type: 'bold', content: match[2] });
    } else if (match[4]) {
      segments.push({ type: 'italic', content: match[4] });
    } else if (match[6]) {
      segments.push({ type: 'code', content: match[6] });
    } else if (match[8]) {
      segments.push({ type: 'link', url: match[8], label: extractDomain(match[8]) });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', content: text }];
}

// Parse multi-line text into block-level elements
export type MarkdownBlock =
  | { type: 'paragraph'; segments: MarkdownSegment[] }
  | { type: 'heading'; level: number; content: string }
  | { type: 'bullet'; segments: MarkdownSegment[] }
  | { type: 'empty' };

export function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = text.split('\n');
  const blocks: MarkdownBlock[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      blocks.push({ type: 'empty' });
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, content: headingMatch[2] });
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      blocks.push({ type: 'bullet', segments: parseInlineMarkdown(bulletMatch[1]) });
      continue;
    }

    blocks.push({ type: 'paragraph', segments: parseInlineMarkdown(trimmed) });
  }

  return blocks;
}

// ─── Section accent colors ───
export const SECTION_COLORS = [
  { value: 'default', bg: INK['04'], border: INK['10'] },
  { value: 'coral', bg: 'rgba(238,113,109,0.06)', border: 'rgba(238,113,109,0.18)' },
  { value: 'teal', bg: 'rgba(58,128,136,0.06)', border: 'rgba(58,128,136,0.18)' },
  { value: 'blue', bg: 'rgba(58,140,180,0.06)', border: 'rgba(58,140,180,0.18)' },
  { value: 'ochre', bg: 'rgba(224,165,1,0.06)', border: 'rgba(224,165,1,0.18)' },
];

export function getSectionColor(value?: string) {
  return SECTION_COLORS.find(c => c.value === value) || SECTION_COLORS[0];
}

// ─── Migrate old entry types ───
export function migrateEntryType(type: string): DreamBoardEntryType {
  if (type === 'note' || type === 'question' || type === 'vibe') return 'text';
  if (type === 'link') return 'link';
  if (type === 'checklist') return 'checklist';
  if (type === 'divider') return 'divider';
  return 'text';
}

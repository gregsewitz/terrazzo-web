'use client';

import { useState } from 'react';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import { useSavedStore } from '@/stores/savedStore';
import { ImportedPlace } from '@/types';

// ── Icon picker options ──────────────────────────────────────────────────────

const ICON_OPTIONS: { name: PerriandIconName; label: string }[] = [
  { name: 'pin', label: 'Pin' },
  { name: 'discover', label: 'Discover' },
  { name: 'restaurant', label: 'Restaurant' },
  { name: 'bar', label: 'Bar' },
  { name: 'hotel', label: 'Hotel' },
  { name: 'cafe', label: 'Café' },
  { name: 'museum', label: 'Museum' },
  { name: 'activity', label: 'Activity' },
  { name: 'shop', label: 'Shop' },
  { name: 'heart', label: 'Heart' },
  { name: 'star', label: 'Star' },
  { name: 'food', label: 'Food & Drink' },
  { name: 'design', label: 'Design' },
  { name: 'wellness', label: 'Wellness' },
];

const SMART_EXAMPLE_PROMPTS = [
  'Everything Lizzie recommended',
  'Best restaurants in Paris',
  'Hotels I loved',
  'Cocktail bars across cities',
  'High-match cafés',
];

// ── Types ────────────────────────────────────────────────────────────────────

export interface SmartParsedResult {
  name: string;
  emoji: PerriandIconName;
  filters: {
    types: string[] | null;
    locations: string[] | null;
    friends: string[] | null;
    sources: string[] | null;
    minMatchScore: number | null;
    reactions: string[] | null;
    keywords: string[] | null;
  };
  filterTags: string[];
  reasoning: string;
  matchCount?: number;
  matchingIds?: string[];
}

interface CreateCollectionModalProps {
  onClose: () => void;
  onCreate: (name: string, emoji: string) => void;
  onCreateSmart: (name: string, emoji: string, query: string, filterTags: string[], placeIds: string[]) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CreateCollectionModal({ onClose, onCreate, onCreateSmart }: CreateCollectionModalProps) {
  const isDesktop = useIsDesktop();
  const [name, setName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('pin');
  const [isSmartMode, setIsSmartMode] = useState(false);
  const [smartQuery, setSmartQuery] = useState('');
  const [smartStep, setSmartStep] = useState<'input' | 'thinking' | 'result'>('input');
  const [smartResult, setSmartResult] = useState<SmartParsedResult | null>(null);
  const [smartError, setSmartError] = useState<string | null>(null);
  const myPlaces = useSavedStore(s => s.myPlaces);

  // Count and collect matching place IDs from parsed filters
  const resolveMatches = (result: SmartParsedResult): { count: number; ids: string[] } => {
    const matching = myPlaces.filter((place: ImportedPlace) => {
      if (result.filters.types && !result.filters.types.includes(place.type)) return false;
      if (result.filters.locations) {
        const matchesLocation = result.filters.locations.some(loc =>
          place.location.toLowerCase().includes(loc.toLowerCase())
        );
        if (!matchesLocation) return false;
      }
      if (result.filters.friends) {
        if (!place.friendAttribution) return false;
        const matchesFriend = result.filters.friends.some(f =>
          place.friendAttribution!.name.toLowerCase().includes(f.toLowerCase())
        );
        if (!matchesFriend) return false;
      }
      if (result.filters.sources && !result.filters.sources.includes(place.ghostSource || '')) return false;
      if (result.filters.minMatchScore && (place.matchScore || 0) < result.filters.minMatchScore) return false;
      if (result.filters.reactions) {
        if (!place.rating) return false;
        if (!result.filters.reactions.includes(place.rating.reaction)) return false;
      }
      if (result.filters.keywords) {
        const placeText = `${place.name} ${place.enrichment?.description || ''} ${place.location}`.toLowerCase();
        const matchesKeyword = result.filters.keywords.some(kw => placeText.includes(kw.toLowerCase()));
        if (!matchesKeyword) return false;
      }
      return true;
    });
    return { count: matching.length, ids: matching.map(p => p.id) };
  };

  // Basic keyword fallback
  const fallbackParse = (query: string): SmartParsedResult => {
    const lq = query.toLowerCase();
    const filters: SmartParsedResult['filters'] = {
      types: null, locations: null, friends: null,
      sources: null, minMatchScore: null, reactions: null, keywords: null,
    };
    const filterTags: string[] = [];
    let emoji: PerriandIconName = 'sparkle';
    let parsedName = query;

    if (lq.includes('hotel')) { filters.types = ['hotel']; filterTags.push('type: hotel'); emoji = 'hotel'; }
    else if (lq.includes('restaurant')) { filters.types = ['restaurant']; filterTags.push('type: restaurant'); emoji = 'restaurant'; }
    else if (lq.includes('bar')) { filters.types = ['bar']; filterTags.push('type: bar'); emoji = 'bar'; }
    else if (lq.includes('museum')) { filters.types = ['museum']; filterTags.push('type: museum'); emoji = 'museum'; }
    else if (lq.includes('cafe') || lq.includes('café') || lq.includes('coffee')) { filters.types = ['cafe']; filterTags.push('type: cafe'); emoji = 'cafe'; }

    if (lq.includes('paris')) { filters.locations = ['Paris']; filterTags.push('location: Paris'); }
    if (lq.includes('stockholm') || lq.includes('scandi')) { filters.locations = ['Stockholm']; filterTags.push('location: Stockholm'); }
    if (lq.includes('mexico')) { filters.locations = ['Mexico City']; filterTags.push('location: Mexico City'); }
    if (lq.includes('sicily')) { filters.locations = ['Sicily', 'Palermo', 'Taormina', 'Catania']; filterTags.push('location: Sicily'); }
    if (lq.includes('copenhagen')) { filters.locations = ['Copenhagen']; filterTags.push('location: Copenhagen'); }

    if (lq.includes('lizzie')) { filters.friends = ['Lizzie']; filterTags.push('person: Lizzie'); emoji = 'friend'; parsedName = "Lizzie's picks"; }
    if (lq.includes('favorite') || lq.includes('loved')) { filters.reactions = ['myPlace']; filterTags.push('reaction: saved'); }
    if (lq.includes('high-match') || lq.includes('high match') || lq.includes('best')) { filters.minMatchScore = 80; filterTags.push('match: 80+'); }

    return { name: parsedName, emoji, filters, filterTags, reasoning: 'Parsed from keywords (offline)' };
  };

  const handleSmartSubmit = async () => {
    if (!smartQuery.trim()) return;
    setSmartStep('thinking');
    setSmartError(null);

    try {
      const placeSummaries = myPlaces.map(p => ({
        name: p.name, type: p.type, location: p.location,
        ghostSource: p.ghostSource, matchScore: p.matchScore,
        friendAttribution: p.friendAttribution, rating: p.rating,
      }));

      const res = await fetch('/api/smart-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: smartQuery, places: placeSummaries }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to parse query');
      }

      const result: SmartParsedResult = await res.json();
      const { count, ids } = resolveMatches(result);
      result.matchCount = count;
      result.matchingIds = ids;
      setSmartResult(result);
      setSmartStep('result');
    } catch (err: unknown) {
      console.error('Smart search failed:', err);
      setSmartError(err instanceof Error ? err.message : 'Something went wrong');
      const fallback = fallbackParse(smartQuery);
      const { count, ids } = resolveMatches(fallback);
      fallback.matchCount = count;
      fallback.matchingIds = ids;
      setSmartResult(fallback);
      setSmartStep('result');
    }
  };

  const handleSmartCreate = () => {
    if (!smartResult) return;
    onCreateSmart(
      smartResult.name,
      smartResult.emoji,
      smartQuery,
      smartResult.filterTags,
      smartResult.matchingIds || [],
    );
  };

  const resetSmart = () => {
    setSmartStep('input');
    setSmartQuery('');
    setSmartResult(null);
    setSmartError(null);
  };

  return (
    <>
      {/* Backdrop — desktop only (mobile uses full-screen takeover) */}
      {isDesktop && (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} style={{ opacity: 0, animation: 'fadeInBackdrop 200ms ease both' }} />
      )}
      {/* Centering wrapper on desktop (flex avoids transform conflict with fadeInUp) */}
      <div
        className={isDesktop ? "fixed inset-0 z-50 flex items-center justify-center pointer-events-none" : "fixed inset-0 z-50 flex flex-col"}
        style={!isDesktop ? { height: '100dvh', background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' } : undefined}
      >
      <div
        className={isDesktop ? "rounded-2xl flex flex-col pointer-events-auto" : "contents"}
        style={isDesktop ? {
          width: 520, maxHeight: '80vh',
          background: 'var(--t-cream)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.12)',
          opacity: 0, animation: 'fadeInUp 250ms ease both',
        } : undefined}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{
            height: isDesktop ? 56 : 52,
            borderBottom: '1px solid var(--t-linen)',
            paddingTop: isDesktop ? 0 : 'env(safe-area-inset-top, 0)',
            padding: isDesktop ? '0 24px' : '0 16px',
          }}
        >
          <span
            style={{ fontFamily: FONT.serif, fontSize: isDesktop ? 19 : 17, fontStyle: 'italic', color: TEXT.primary }}
          >
            New Collection
          </span>
          <button
            aria-label="Close"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center nav-hover"
            style={{ background: INK['05'], border: 'none', cursor: 'pointer' }}
          >
            <PerriandIcon name="close" size={12} color={TEXT.secondary} />
          </button>
        </div>

        {/* Scrollable content */}
        <div
          className="flex-1 overflow-y-auto"
          style={{
            padding: isDesktop ? '16px 24px 24px' : '16px 16px',
            paddingBottom: isDesktop ? 24 : 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))',
          }}
        >
        {/* Mode toggle */}
        <div className="flex gap-1.5 mb-4">
          <button
            onClick={() => { setIsSmartMode(false); resetSmart(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium cursor-pointer transition-all"
            style={{
              background: !isSmartMode ? TEXT.primary : 'white',
              color: !isSmartMode ? 'white' : TEXT.secondary,
              border: !isSmartMode ? `1px solid ${TEXT.primary}` : '1px solid var(--t-navy)',
              fontFamily: FONT.mono,
            }}
          >
            <PerriandIcon name="edit" size={10} color={!isSmartMode ? 'white' : TEXT.secondary} />
            Manual
          </button>
          <button
            onClick={() => setIsSmartMode(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium cursor-pointer transition-all"
            style={{
              background: isSmartMode ? TEXT.primary : 'white',
              color: isSmartMode ? 'white' : TEXT.secondary,
              border: isSmartMode ? `1px solid ${TEXT.primary}` : '1px solid var(--t-navy)',
              fontFamily: FONT.mono,
            }}
          >
            <PerriandIcon name="sparkle" size={10} color={isSmartMode ? 'white' : TEXT.secondary} />
            Terrazzo curate
          </button>
        </div>

        {/* ═══ Manual Mode ═══ */}
        {!isSmartMode && (
          <>
            {/* Icon picker */}
            <div className="grid grid-cols-7 gap-1.5 mb-4">
              {ICON_OPTIONS.map(icon => (
                <button
                  key={icon.name}
                  onClick={() => setSelectedEmoji(icon.name)}
                  aria-label={icon.label}
                  className="aspect-square rounded-lg flex items-center justify-center cursor-pointer transition-all"
                  style={{
                    background: selectedEmoji === icon.name ? 'var(--t-ink)' : 'white',
                    border: selectedEmoji === icon.name ? 'none' : '1px solid var(--t-navy)',
                  }}
                >
                  <PerriandIcon
                    name={icon.name}
                    size={14}
                    color={selectedEmoji === icon.name ? 'white' : TEXT.secondary}
                  />
                </button>
              ))}
            </div>

            {/* Name input — 16px font prevents iOS zoom */}
            <input
              type="text"
              placeholder="Collection name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full rounded-lg py-2.5 px-3 mb-4 focus-ring"
              style={{
                fontSize: 16,
                background: isDesktop ? 'var(--t-cream)' : 'white',
                border: '1px solid var(--t-navy)',
                color: TEXT.primary,
                fontFamily: FONT.sans,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            {/* Create button */}
            <button
              onClick={() => { if (name.trim()) onCreate(name.trim(), selectedEmoji); }}
              disabled={!name.trim()}
              className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all cursor-pointer btn-hover"
              style={{
                background: name.trim() ? 'var(--t-ink)' : INK['10'],
                color: name.trim() ? 'white' : INK['30'],
                border: 'none',
                fontFamily: FONT.sans,
                boxSizing: 'border-box',
              }}
            >
              Create Collection
            </button>
          </>
        )}

        {/* ═══ Smart / AI Mode ═══ */}
        {isSmartMode && smartStep === 'input' && (
          <div>
            {/* Description input — 16px font prevents iOS zoom */}
            <input
              type="text"
              placeholder="Describe your collection..."
              value={smartQuery}
              onChange={(e) => setSmartQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSmartSubmit(); }}
              autoFocus
              className="w-full rounded-lg py-2.5 px-3 mb-3"
              style={{
                fontSize: 16,
                background: 'white',
                border: '1px solid var(--t-linen)',
                color: TEXT.primary,
                fontFamily: FONT.sans,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            {/* Example prompts */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {SMART_EXAMPLE_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => setSmartQuery(prompt)}
                  className="px-2.5 py-1 rounded-full text-[10px] cursor-pointer transition-colors"
                  style={{
                    background: 'white',
                    border: '1px solid var(--t-linen)',
                    color: TEXT.secondary,
                    fontFamily: FONT.sans,
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Submit button */}
            <button
              onClick={handleSmartSubmit}
              disabled={!smartQuery.trim()}
              className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
              style={{
                background: smartQuery.trim() ? 'var(--t-ink)' : INK['10'],
                color: smartQuery.trim() ? 'white' : INK['30'],
                border: 'none',
                fontFamily: FONT.sans,
                boxSizing: 'border-box',
              }}
            >
              <PerriandIcon name="sparkle" size={11} color={smartQuery.trim() ? 'white' : INK['30']} />
              Find places
            </button>
          </div>
        )}

        {/* ═══ AI Thinking ═══ */}
        {isSmartMode && smartStep === 'thinking' && (
          <div className="py-4">
            <div className="p-3 rounded-xl" style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    className="rounded-lg"
                    style={{
                      height: i === 3 ? 16 : 20,
                      width: i === 2 ? '65%' : '100%',
                      background: 'linear-gradient(90deg, var(--t-linen), var(--t-cream), var(--t-linen))',
                      backgroundSize: '200% 100%',
                      animation: 'smartShimmer 2s infinite',
                      animationDelay: `${0.1 * i}s`,
                    }}
                  />
                ))}
              </div>
            </div>
            <p
              className="text-center text-[10px] mt-2"
              style={{ color: TEXT.secondary, fontFamily: FONT.mono }}
            >
              Terrazzo is curating...
            </p>
          </div>
        )}

        {/* ═══ AI Result ═══ */}
        {isSmartMode && smartStep === 'result' && smartResult && (
          <div>
            {/* AI reasoning */}
            {smartResult.reasoning && (
              <div
                className="text-[10px] leading-relaxed px-3 py-2 rounded-lg flex gap-2 items-start mb-3"
                style={{ color: TEXT.primary, background: 'rgba(238,113,109,0.06)' }}
              >
                <PerriandIcon name="sparkle" size={10} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontFamily: FONT.sans }}>{smartResult.reasoning}</span>
              </div>
            )}

            {/* Error fallback notice */}
            {smartError && (
              <div
                className="text-[9px] px-2.5 py-1.5 rounded-lg mb-2"
                style={{ color: TEXT.secondary, background: 'rgba(107,139,154,0.06)', fontFamily: FONT.mono }}
              >
                Offline mode — {smartError}
              </div>
            )}

            {/* Result preview */}
            <div className="p-3 rounded-xl mb-3" style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
              <div className="flex items-center gap-2 mb-2">
                <PerriandIcon name={smartResult.emoji} size={16} />
                <span
                  className="text-[14px] font-semibold"
                  style={{ fontFamily: FONT.serif, fontStyle: 'italic', color: TEXT.primary }}
                >
                  {smartResult.name}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[11px] font-bold"
                  style={{ fontFamily: FONT.mono, color: 'var(--t-dark-teal)' }}
                >
                  {smartResult.matchCount ?? 0} places
                </span>
              </div>
              {smartResult.filterTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {smartResult.filterTags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full text-[9px]"
                      style={{
                        background: 'rgba(58,128,136,0.08)',
                        color: 'var(--t-dark-teal)',
                        fontFamily: FONT.mono,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={resetSmart}
                className="flex-1 py-2.5 rounded-xl text-[12px] font-medium cursor-pointer"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--t-linen)',
                  color: TEXT.primary,
                  fontFamily: FONT.sans,
                }}
              >
                Try again
              </button>
              <button
                onClick={handleSmartCreate}
                className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold cursor-pointer flex items-center justify-center gap-1.5"
                style={{
                  background: 'var(--t-ink)',
                  color: 'white',
                  border: 'none',
                  fontFamily: FONT.sans,
                }}
              >
                Create
                <PerriandIcon name="sparkle" size={10} color="white" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Shimmer animation for AI thinking */}
      <style>{`
        @keyframes smartShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
    </div>
    </>
  );
}

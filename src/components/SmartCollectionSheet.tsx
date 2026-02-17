'use client';

import { useState } from 'react';
import { useSavedStore } from '@/stores/savedStore';

interface SmartCollectionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (collection: { name: string; query: string; emoji: string }) => void;
}

interface ParsedCollection {
  name: string;
  emoji: string;
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
}

export default function SmartCollectionSheet({
  isOpen,
  onClose,
  onCreate,
}: SmartCollectionSheetProps) {
  const [step, setStep] = useState<'input' | 'thinking' | 'result'>('input');
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<ParsedCollection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const myPlaces = useSavedStore(s => s.myPlaces);

  const examplePrompts = [
    'Favorite hotels in Europe',
    'Everything Sarah recommended',
    'Restaurants I loved in Tokyo',
    'High-match places I haven\'t tried',
    'Bars with great cocktails',
  ];

  // Count matching places from the user's collection
  const countMatches = (result: ParsedCollection): number => {
    return myPlaces.filter((place) => {
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
        const placeText = `${place.name} ${place.tasteNote || ''} ${place.location}`.toLowerCase();
        const matchesKeyword = result.filters.keywords.some(kw => placeText.includes(kw.toLowerCase()));
        if (!matchesKeyword) return false;
      }
      return true;
    }).length;
  };

  // Call the Claude-powered API
  const handleSubmit = async () => {
    if (!input.trim()) return;

    setStep('thinking');
    setError(null);

    try {
      // Send places context for smarter parsing
      const placeSummaries = myPlaces.map(p => ({
        name: p.name,
        type: p.type,
        location: p.location,
        ghostSource: p.ghostSource,
        matchScore: p.matchScore,
        friendAttribution: p.friendAttribution,
        rating: p.rating,
      }));

      const res = await fetch('/api/smart-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: input, places: placeSummaries }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to parse query');
      }

      const result: ParsedCollection = await res.json();
      result.matchCount = countMatches(result);
      setParsed(result);
      setStep('result');
    } catch (err: any) {
      console.error('Smart search failed:', err);
      setError(err.message || 'Something went wrong');

      // Fallback to basic keyword parsing
      const fallback = fallbackParse(input);
      fallback.matchCount = countMatches(fallback);
      setParsed(fallback);
      setStep('result');
    }
  };

  // Basic keyword fallback (no API needed)
  const fallbackParse = (query: string): ParsedCollection => {
    const lq = query.toLowerCase();
    const filters: ParsedCollection['filters'] = {
      types: null, locations: null, friends: null,
      sources: null, minMatchScore: null, reactions: null, keywords: null,
    };
    const filterTags: string[] = [];
    let emoji = '✨';
    let name = query;

    if (lq.includes('hotel')) { filters.types = ['hotel']; filterTags.push('type: hotel'); emoji = '🏨'; }
    else if (lq.includes('restaurant')) { filters.types = ['restaurant']; filterTags.push('type: restaurant'); emoji = '🍽'; }
    else if (lq.includes('bar')) { filters.types = ['bar']; filterTags.push('type: bar'); emoji = '🍷'; }
    else if (lq.includes('museum')) { filters.types = ['museum']; filterTags.push('type: museum'); emoji = '🎨'; }
    else if (lq.includes('cafe')) { filters.types = ['cafe']; filterTags.push('type: cafe'); emoji = '☕'; }

    if (lq.includes('tokyo')) { filters.locations = ['Tokyo']; filterTags.push('location: Tokyo'); }
    if (lq.includes('paris')) { filters.locations = ['Paris']; filterTags.push('location: Paris'); }
    if (lq.includes('london')) { filters.locations = ['London']; filterTags.push('location: London'); }
    if (lq.includes('europe')) { filters.locations = ['Venice', 'Paris', 'London', 'Puglia']; filterTags.push('location: Europe'); }

    if (lq.includes('sarah')) { filters.friends = ['Sarah']; filterTags.push('person: Sarah'); emoji = '👤'; name = 'Sarah\'s picks'; }
    if (lq.includes('favorite') || lq.includes('loved')) { filters.reactions = ['myPlace']; filterTags.push('reaction: ♡'); }
    if (lq.includes('high-match') || lq.includes('high match')) { filters.minMatchScore = 85; filterTags.push('match: 85+'); }

    return { name, emoji, filters, filterTags, reasoning: 'Parsed from keywords (offline fallback)' };
  };

  const handleCreate = () => {
    if (!parsed) return;
    onCreate({
      name: parsed.name,
      query: input,
      emoji: parsed.emoji,
    });
    setStep('input');
    setInput('');
    setParsed(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[60] overflow-y-auto rounded-t-2xl"
        style={{ maxWidth: 480, margin: '0 auto', maxHeight: '90vh', background: 'var(--t-cream)' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-8 h-1 rounded-full" style={{ background: 'var(--t-travertine)' }} />
        </div>

        <div className="px-4 pb-8">
          {/* Title */}
          <h2
            className="text-lg italic mb-6"
            style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}
          >
            New Smart Collection
          </h2>

          {step === 'input' && (
            <div className="space-y-6">
              <div>
                <input
                  type="text"
                  placeholder="Describe your collection..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                  className="w-full px-4 py-3 rounded-lg border text-[14px]"
                  style={{
                    backgroundColor: 'white', borderColor: 'var(--t-linen)',
                    color: 'var(--t-ink)', fontFamily: "'DM Sans', sans-serif",
                  }}
                  autoFocus
                />
              </div>

              {/* Example Prompts */}
              <div>
                <p
                  className="text-[10px] uppercase tracking-wider mb-3"
                  style={{ fontFamily: "'Space Mono', monospace", color: 'var(--t-amber)' }}
                >
                  Try these
                </p>
                <div className="flex flex-wrap gap-2">
                  {examplePrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className="px-3 py-1.5 rounded-full border text-[11px] cursor-pointer transition-colors"
                      style={{
                        backgroundColor: 'white', borderColor: 'var(--t-linen)',
                        color: 'var(--t-ink)', fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!input.trim()}
                className="w-full py-3 rounded-xl text-[14px] font-medium cursor-pointer transition-opacity disabled:opacity-50"
                style={{ backgroundColor: 'var(--t-ink)', color: 'var(--t-cream)', fontFamily: "'DM Sans', sans-serif" }}
              >
                Create with AI ✦
              </button>
            </div>
          )}

          {step === 'thinking' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border" style={{ backgroundColor: 'white', borderColor: 'var(--t-linen)' }}>
                <div className="space-y-3">
                  <div
                    className="h-6 rounded-lg"
                    style={{
                      background: 'linear-gradient(90deg, var(--t-linen), var(--t-cream), var(--t-linen))',
                      backgroundSize: '200% 100%',
                      animation: 'smartShimmer 2s infinite',
                    }}
                  />
                  <div
                    className="h-4 rounded-lg w-2/3"
                    style={{
                      background: 'linear-gradient(90deg, var(--t-linen), var(--t-cream), var(--t-linen))',
                      backgroundSize: '200% 100%',
                      animation: 'smartShimmer 2s infinite',
                      animationDelay: '0.1s',
                    }}
                  />
                  <div className="flex gap-2 mt-4">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-5 w-16 rounded-full"
                        style={{
                          background: 'linear-gradient(90deg, var(--t-linen), var(--t-cream), var(--t-linen))',
                          backgroundSize: '200% 100%',
                          animation: 'smartShimmer 2s infinite',
                          animationDelay: `${0.1 * i}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-center text-[11px]" style={{ color: 'rgba(28,26,23,0.5)' }}>
                Terrazzo is thinking...
              </p>
            </div>
          )}

          {step === 'result' && parsed && (
            <div className="space-y-6">
              {/* AI reasoning */}
              {parsed.reasoning && (
                <div
                  className="text-[11px] leading-relaxed px-3 py-2.5 rounded-[10px]"
                  style={{ color: 'rgba(28,26,23,0.5)', background: 'rgba(200,146,58,0.06)' }}
                >
                  ✦ {parsed.reasoning}
                </div>
              )}

              {/* Error notice (if fallback was used) */}
              {error && (
                <div
                  className="text-[10px] px-3 py-2 rounded-lg"
                  style={{ color: 'var(--t-ghost)', background: 'rgba(107,139,154,0.06)' }}
                >
                  Using offline mode — {error}
                </div>
              )}

              {/* Result Card */}
              <div className="p-4 rounded-xl border" style={{ backgroundColor: 'white', borderColor: 'var(--t-linen)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{parsed.emoji}</span>
                  <h3
                    className="text-[15px] italic"
                    style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}
                  >
                    {parsed.name}
                  </h3>
                </div>
                <p
                  className="text-[12px] mb-4"
                  style={{ fontFamily: "'Space Mono', monospace", color: 'rgba(28,26,23,0.6)' }}
                >
                  {parsed.matchCount ?? 0} places found
                </p>

                {parsed.filterTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {parsed.filterTags.map((tag) => (
                      <div
                        key={tag}
                        className="px-2.5 py-1 rounded-full text-[10px]"
                        style={{
                          backgroundColor: 'var(--t-verde)', color: 'white',
                          fontFamily: "'Space Mono', monospace",
                        }}
                      >
                        {tag}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setStep('input'); setInput(''); setParsed(null); setError(null); }}
                  className="flex-1 py-3 rounded-xl text-[14px] font-medium cursor-pointer border"
                  style={{
                    backgroundColor: 'transparent', borderColor: 'var(--t-linen)',
                    color: 'var(--t-ink)', fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  className="flex-1 py-3 rounded-xl text-[14px] font-medium cursor-pointer"
                  style={{
                    backgroundColor: 'var(--t-ink)', color: 'var(--t-cream)',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Create Collection
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

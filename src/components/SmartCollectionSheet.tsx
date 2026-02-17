'use client';

import { useState } from 'react';

interface SmartCollectionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (collection: { name: string; query: string; emoji: string }) => void;
}

interface ParsedCollection {
  name: string;
  matchCount: number;
  filterTags: string[];
}

export default function SmartCollectionSheet({
  isOpen,
  onClose,
  onCreate,
}: SmartCollectionSheetProps) {
  const [step, setStep] = useState<'input' | 'thinking' | 'result'>('input');
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<ParsedCollection | null>(null);

  const examplePrompts = [
    'Favorite hotels in Europe',
    'Everything Sarah recommended',
    'Restaurants I loved in Tokyo',
    'High-match places I haven\'t tried',
    'Bars with great cocktails',
  ];

  // Simulated AI parsing - hardcoded results based on keywords
  const parseQuery = (query: string): ParsedCollection => {
    const lowerQuery = query.toLowerCase();

    let emoji = '✨';
    let name = query;
    let matchCount = 8;
    let filterTags: string[] = [];

    // Detect type
    if (lowerQuery.includes('hotel')) {
      emoji = '🏨';
      filterTags.push('type: hotel');
    } else if (lowerQuery.includes('restaurant') || lowerQuery.includes('dining')) {
      emoji = '🍽';
      filterTags.push('type: restaurant');
    } else if (lowerQuery.includes('bar') || lowerQuery.includes('cocktail')) {
      emoji = '🍷';
      filterTags.push('type: bar');
    } else if (lowerQuery.includes('museum') || lowerQuery.includes('art')) {
      emoji = '🎨';
      filterTags.push('type: museum');
    } else if (lowerQuery.includes('cafe') || lowerQuery.includes('coffee')) {
      emoji = '☕';
      filterTags.push('type: cafe');
    }

    // Detect location
    if (lowerQuery.includes('europe')) {
      filterTags.push('location: Europe');
      name = 'Favorite hotels in Europe';
      matchCount = 6;
    } else if (lowerQuery.includes('tokyo')) {
      filterTags.push('location: Tokyo');
      name = 'Tokyo research';
      matchCount = 14;
    } else if (lowerQuery.includes('paris')) {
      filterTags.push('location: Paris');
      matchCount = 5;
    } else if (lowerQuery.includes('new york') || lowerQuery.includes('nyc')) {
      filterTags.push('location: New York');
      matchCount = 9;
    } else if (lowerQuery.includes('london')) {
      filterTags.push('location: London');
      matchCount = 7;
    }

    // Detect person
    if (lowerQuery.includes('sarah')) {
      filterTags.push('person: Sarah');
      filterTags.push('source: friend');
      name = 'Everything Sarah recommended';
      matchCount = 9;
      emoji = '👤';
    }

    // Detect reaction/preference
    if (lowerQuery.includes('favorite') || lowerQuery.includes('loved')) {
      filterTags.push('reaction: ♡');
      matchCount = Math.max(matchCount, 5);
    } else if (lowerQuery.includes('high-match')) {
      filterTags.push('reaction: match');
      matchCount = 12;
    } else if (lowerQuery.includes('haven\'t tried')) {
      filterTags.push('status: unwisited');
      matchCount = 8;
    }

    return { name, matchCount, filterTags };
  };

  const handleSubmit = () => {
    if (!input.trim()) return;

    setStep('thinking');

    // Simulate AI processing with delay
    setTimeout(() => {
      const result = parseQuery(input);
      setParsed(result);
      setStep('result');
    }, 1200);
  };

  const handleCreate = () => {
    if (!parsed) return;

    onCreate({
      name: parsed.name,
      query: input,
      emoji: '✨', // Default emoji - can be customized
    });

    // Reset
    setStep('input');
    setInput('');
    setParsed(null);
    onClose();
  };

  const handleExampleClick = (prompt: string) => {
    setInput(prompt);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[60] overflow-y-auto rounded-t-2xl"
        style={{
          maxWidth: 480,
          margin: '0 auto',
          maxHeight: '90vh',
          background: 'var(--t-cream)',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-8 h-1 rounded-full" style={{ background: 'var(--t-travertine)' }} />
        </div>

        <div className="px-4 pb-8">
          {/* Title */}
          <h2
            className="text-lg italic mb-6"
            style={{
              fontFamily: "'DM Serif Display', serif",
              color: 'var(--t-ink)',
            }}
          >
            New Smart Collection
          </h2>

          {step === 'input' && (
            <div className="space-y-6">
              {/* Input */}
              <div>
                <input
                  type="text"
                  placeholder="Describe your collection..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmit();
                  }}
                  className="w-full px-4 py-3 rounded-lg border text-[14px]"
                  style={{
                    backgroundColor: 'white',
                    borderColor: 'var(--t-linen)',
                    color: 'var(--t-ink)',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                  autoFocus
                />
              </div>

              {/* Example Prompts */}
              <div>
                <p
                  className="text-[10px] uppercase tracking-wider mb-3"
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    color: 'var(--t-amber)',
                  }}
                >
                  Try these
                </p>
                <div className="flex flex-wrap gap-2">
                  {examplePrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handleExampleClick(prompt)}
                      className="px-3 py-1.5 rounded-full border text-[11px] cursor-pointer transition-colors"
                      style={{
                        backgroundColor: 'white',
                        borderColor: 'var(--t-linen)',
                        color: 'var(--t-ink)',
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={!input.trim()}
                className="w-full py-3 rounded-xl text-[14px] font-medium cursor-pointer transition-opacity disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--t-ink)',
                  color: 'var(--t-cream)',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Parse Collection
              </button>
            </div>
          )}

          {step === 'thinking' && (
            <div className="space-y-4">
              {/* Shimmer placeholder */}
              <div
                className="p-4 rounded-xl border"
                style={{
                  backgroundColor: 'white',
                  borderColor: 'var(--t-linen)',
                }}
              >
                <div className="space-y-3">
                  {/* Title placeholder */}
                  <div
                    className="h-6 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200"
                    style={{
                      backgroundSize: '200% 100%',
                      animation: 'smartShimmer 2s infinite',
                    }}
                  />
                  {/* Details placeholder */}
                  <div
                    className="h-4 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 w-2/3"
                    style={{
                      backgroundSize: '200% 100%',
                      animation: 'smartShimmer 2s infinite',
                      animationDelay: '0.1s',
                    }}
                  />
                  {/* Tags placeholder */}
                  <div className="flex gap-2 mt-4">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-5 w-16 rounded-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200"
                        style={{
                          backgroundSize: '200% 100%',
                          animation: 'smartShimmer 2s infinite',
                          animationDelay: `${0.1 * i}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <p
                className="text-center text-[11px]"
                style={{ color: 'rgba(28,26,23,0.5)' }}
              >
                Analyzing your collection...
              </p>
            </div>
          )}

          {step === 'result' && parsed && (
            <div className="space-y-6">
              {/* Result Card */}
              <div
                className="p-4 rounded-xl border"
                style={{
                  backgroundColor: 'white',
                  borderColor: 'var(--t-linen)',
                }}
              >
                <h3
                  className="text-[15px] font-serif italic mb-2"
                  style={{
                    fontFamily: "'DM Serif Display', serif",
                    color: 'var(--t-ink)',
                  }}
                >
                  {parsed.name}
                </h3>
                <p
                  className="text-[12px] mb-4"
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    color: 'rgba(28,26,23,0.6)',
                  }}
                >
                  {parsed.matchCount} places found
                </p>

                {/* Filter Tags */}
                {parsed.filterTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {parsed.filterTags.map((tag) => (
                      <div
                        key={tag}
                        className="px-2.5 py-1 rounded-full text-[10px]"
                        style={{
                          backgroundColor: 'var(--t-verde)',
                          color: 'white',
                          fontFamily: "'Space Mono', monospace",
                        }}
                      >
                        {tag}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setStep('input');
                    setInput('');
                    setParsed(null);
                  }}
                  className="flex-1 py-3 rounded-xl text-[14px] font-medium cursor-pointer transition-colors border"
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: 'var(--t-linen)',
                    color: 'var(--t-ink)',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  className="flex-1 py-3 rounded-xl text-[14px] font-medium cursor-pointer transition-opacity"
                  style={{
                    backgroundColor: 'var(--t-ink)',
                    color: 'var(--t-cream)',
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

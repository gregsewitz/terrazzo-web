'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSavedStore } from '@/stores/savedStore';
import { PerriandIcon, isPerriandIconName } from '@/components/icons/PerriandIcons';
import type { ImportedPlace, PlaceType } from '@/types';
import { FONT, INK } from '@/constants/theme';

interface GoogleResult {
  id: string;
  name: string;
  address: string;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: string;
  category: string;
  placeType: string;
  types: string[];
  location: { lat: number; lng: number } | null;
  photoUrl: string | null;
}

interface PlaceSearchBarProps {
  /** Called after a place is added to the library — use to auto-add to a collection */
  onPlaceAdded?: (place: ImportedPlace) => void;
  /** If true, skip the collection picker after adding (used when inside a collection detail) */
  skipCollectionPicker?: boolean;
  /** Placeholder text override */
  placeholder?: string;
}

export default function PlaceSearchBar({ onPlaceAdded, skipCollectionPicker, placeholder }: PlaceSearchBarProps = {}) {
  const searchQuery = useSavedStore(s => s.searchQuery);
  const setSearchQuery = useSavedStore(s => s.setSearchQuery);
  const addPlace = useSavedStore(s => s.addPlace);
  const myPlaces = useSavedStore(s => s.myPlaces);
  const collections = useSavedStore(s => s.collections);
  const addPlaceToCollection = useSavedStore(s => s.addPlaceToCollection);

  const [googleResults, setGoogleResults] = useState<GoogleResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [justAddedPlace, setJustAddedPlace] = useState<ImportedPlace | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if a Google result is already in the library
  const isInLibrary = useCallback((googleId: string) => {
    return myPlaces.some(p => p.google?.placeId === googleId);
  }, [myPlaces]);

  // Debounced Google search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!searchQuery || searchQuery.trim().length < 2) {
      setGoogleResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch('/api/places/autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery.trim() }),
        });
        const data = await res.json();
        setGoogleResults(data.results || []);
        setShowDropdown(true);
      } catch {
        setGoogleResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        if (showCollectionPicker) dismissCollectionPicker();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCollectionPicker]);

  // Handle Escape
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setShowDropdown(false);
      inputRef.current?.blur();
    }
  }

  // Add place from Google result
  function handleAdd(result: GoogleResult) {
    const newPlace: ImportedPlace = {
      id: `search-${result.id}-${Date.now()}`,
      name: result.name,
      type: (result.placeType || 'activity') as PlaceType,
      location: result.address,
      source: { type: 'google-maps', name: 'Search' },
      matchScore: 0,
      matchBreakdown: { Design: 0, Character: 0, Service: 0, Food: 0, Location: 0, Wellness: 0 },
      tasteNote: '',
      status: 'available',
      ghostSource: 'manual',
      google: {
        placeId: result.id,
        rating: result.rating ?? undefined,
        reviewCount: result.reviewCount ?? undefined,
        category: result.category,
        address: result.address,
        lat: result.location?.lat,
        lng: result.location?.lng,
      },
    };
    addPlace(newPlace);
    setAddedIds(prev => new Set(prev).add(result.id));

    // Call the onPlaceAdded callback (e.g. auto-add to current collection)
    onPlaceAdded?.(newPlace);

    // Show collection picker unless told to skip
    if (!skipCollectionPicker && collections.length > 0) {
      setJustAddedPlace(newPlace);
      setShowCollectionPicker(true);
      // Close the Google dropdown
      setShowDropdown(false);
      setGoogleResults([]);
      setSearchQuery('');
    } else {
      // Brief visual feedback then clear
      setTimeout(() => {
        setSearchQuery('');
        setShowDropdown(false);
        setGoogleResults([]);
        setAddedIds(new Set());
      }, 600);
    }
  }

  function handleCollectionToggle(collectionId: string) {
    if (!justAddedPlace) return;
    addPlaceToCollection(collectionId, justAddedPlace.id);
  }

  function dismissCollectionPicker() {
    setShowCollectionPicker(false);
    setJustAddedPlace(null);
    setAddedIds(new Set());
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <PerriandIcon
          name="discover"
          size={14}
          color={INK['35']}
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
        />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder || "Search or add a place..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => { if (googleResults.length > 0) setShowDropdown(true); }}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            borderRadius: 10,
            padding: '10px 36px 10px 36px',
            fontSize: 16,
            background: 'white',
            border: '1px solid var(--t-linen)',
            color: 'var(--t-ink)',
            fontFamily: FONT.sans,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {/* Clear / spinner */}
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              setShowDropdown(false);
              setGoogleResults([]);
              inputRef.current?.focus();
            }}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              width: 20, height: 20, borderRadius: 10,
              background: INK['08'], border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {isSearching ? (
              <div style={{
                width: 10, height: 10, border: '1.5px solid var(--t-honey)',
                borderTopColor: 'transparent', borderRadius: '50%',
                animation: 'searchSpin 0.6s linear infinite',
              }} />
            ) : (
              <PerriandIcon name="close" size={8} color={INK['50']} />
            )}
          </button>
        )}
      </div>

      {/* Google results dropdown */}
      {showDropdown && googleResults.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 60,
          marginTop: 4,
          background: 'white',
          border: '1px solid var(--t-linen)',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '8px 12px 6px',
            borderBottom: '1px solid var(--t-linen)',
          }}>
            <span style={{
              fontFamily: FONT.mono,
              fontSize: 9,
              fontWeight: 600,
              color: INK['70'],
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Add from Google
            </span>
          </div>

          {/* Results */}
          {googleResults.map((result, idx) => {
            const alreadyAdded = addedIds.has(result.id);
            const alreadyInLib = isInLibrary(result.id);
            const canAdd = !alreadyInLib && !alreadyAdded;
            return (
              <div
                key={result.id}
                onClick={() => { if (canAdd) handleAdd(result); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderBottom: idx < googleResults.length - 1 ? `1px solid ${INK['06']}` : 'none',
                  transition: 'background 0.15s',
                  cursor: canAdd ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => { if (canAdd) e.currentTarget.style.background = INK['03']; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: 'var(--t-ink)',
                    fontFamily: FONT.sans,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {result.name}
                  </div>
                  <div style={{
                    fontSize: 11, color: INK['70'],
                    fontFamily: FONT.sans,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    marginTop: 1,
                  }}>
                    {result.address}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <span style={{
                      fontSize: 10, color: INK['70'],
                      fontFamily: FONT.mono,
                    }}>
                      {result.category}
                    </span>
                    {result.rating && (
                      <span style={{
                        fontSize: 10, color: INK['70'],
                        fontFamily: FONT.mono,
                        display: 'flex', alignItems: 'center', gap: 2,
                      }}>
                        ★ {result.rating}
                      </span>
                    )}
                    {result.priceLevel && (
                      <span style={{
                        fontSize: 10, color: INK['70'],
                        fontFamily: FONT.mono,
                      }}>
                        {result.priceLevel}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status indicator */}
                {alreadyInLib ? (
                  <span style={{
                    fontSize: 9, fontWeight: 600, color: 'var(--t-verde)',
                    fontFamily: FONT.mono,
                    whiteSpace: 'nowrap',
                  }}>
                    In library
                  </span>
                ) : alreadyAdded ? (
                  <div style={{
                    width: 28, height: 28, borderRadius: 14,
                    background: 'var(--t-verde)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ color: 'white', fontSize: 14, fontWeight: 700 }}>✓</span>
                  </div>
                ) : (
                  <div
                    style={{
                      width: 28, height: 28, borderRadius: 14,
                      background: 'var(--t-honey)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ color: 'white', fontSize: 16, fontWeight: 700, lineHeight: 1 }}>+</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Quick add to collection picker */}
      {showCollectionPicker && justAddedPlace && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 60,
          marginTop: 4,
          background: 'white',
          border: '1px solid var(--t-linen)',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '10px 12px 8px',
            borderBottom: '1px solid var(--t-linen)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <span style={{
                fontFamily: FONT.mono,
                fontSize: 9,
                fontWeight: 600,
                color: 'var(--t-verde)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Added to library
              </span>
              <span style={{
                fontFamily: FONT.sans,
                fontSize: 11,
                color: INK['70'],
                marginLeft: 8,
              }}>
                Add to a collection?
              </span>
            </div>
            <button
              onClick={dismissCollectionPicker}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <PerriandIcon name="close" size={12} color={INK['40']} />
            </button>
          </div>

          {/* Collection options */}
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {collections.map((sl) => {
              const isIn = sl.placeIds.includes(justAddedPlace.id);
              const isPerriandIcon = sl.emoji ? isPerriandIconName(sl.emoji) : false;
              return (
                <button
                  key={sl.id}
                  onClick={() => handleCollectionToggle(sl.id)}
                  disabled={isIn}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    width: '100%',
                    textAlign: 'left',
                    background: isIn ? 'rgba(42,122,86,0.04)' : 'transparent',
                    border: 'none',
                    borderBottom: `1px solid ${INK['04']}`,
                    cursor: isIn ? 'default' : 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!isIn) (e.currentTarget.style.background = INK['03']); }}
                  onMouseLeave={(e) => { if (!isIn) (e.currentTarget.style.background = 'transparent'); }}
                >
                  <span style={{ fontSize: isPerriandIcon ? 12 : 14, width: 18, textAlign: 'center', flexShrink: 0 }}>
                    {isPerriandIcon ? (
                      <PerriandIcon name={sl.emoji as any} size={12} color="var(--t-ink)" />
                    ) : (
                      sl.emoji
                    )}
                  </span>
                  <span style={{ flex: 1, fontSize: 12, fontFamily: FONT.sans, color: 'var(--t-ink)' }}>
                    {sl.name}
                  </span>
                  {isIn ? (
                    <span style={{ fontSize: 9, fontFamily: FONT.mono, color: 'var(--t-verde)', fontWeight: 600 }}>
                      Added
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: INK['30'] }}>+</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Done button */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--t-linen)' }}>
            <button
              onClick={dismissCollectionPicker}
              style={{
                width: '100%',
                padding: '8px 0',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: FONT.sans,
                background: 'var(--t-ink)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Spinner animation */}
      <style>{`
        @keyframes searchSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

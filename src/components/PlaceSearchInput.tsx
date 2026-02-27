'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import type { ImportedPlace, PlaceType } from '@/types';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

/** Map Google Place types → our PlaceType */
function inferPlaceType(googleTypes: string[]): PlaceType {
  const t = new Set(googleTypes);
  if (t.has('restaurant') || t.has('food')) return 'restaurant';
  if (t.has('bar') || t.has('night_club')) return 'bar';
  if (t.has('cafe')) return 'cafe';
  if (t.has('lodging')) return 'hotel';
  if (t.has('museum') || t.has('art_gallery')) return 'museum';
  if (t.has('store') || t.has('shopping_mall')) return 'shop';
  if (t.has('neighborhood') || t.has('sublocality') || t.has('locality')) return 'neighborhood';
  return 'activity';
}

export interface PlaceSearchResult {
  name: string;
  placeId?: string;
  address?: string;
  lat?: number;
  lng?: number;
  type: PlaceType;
  isCustom?: boolean;
  googleTypes?: string[];
  addressComponents?: google.maps.GeocoderAddressComponent[];
}

interface PlaceSearchInputProps {
  onSelect: (result: PlaceSearchResult) => void;
  onCancel: () => void;
  destination?: string;        // bias results toward trip destination
  suggestedType?: PlaceType;   // hint from slot affinity
  placeholder?: string;
  compact?: boolean;           // smaller variant for PicksRail
  searchTypes?: string[];      // override autocomplete types (default: ['establishment'])
}

function PlaceSearchInputInner({
  onSelect,
  onCancel,
  destination,
  suggestedType,
  placeholder = 'Search for a place…',
  compact = false,
  searchTypes,
}: PlaceSearchInputProps) {
  const places = useMapsLibrary('places');

  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const switchingMode = useRef(false);

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'search' | 'custom'>('search');
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Custom mode
  const [customName, setCustomName] = useState('');
  const [customType, setCustomType] = useState<PlaceType>(suggestedType || 'activity');

  // ─── Init ───
  useEffect(() => {
    if (!places) return;
    autocompleteService.current = new places.AutocompleteService();
    const div = document.createElement('div');
    placesService.current = new places.PlacesService(div);
  }, [places]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [mode]);

  // ─── Fetch predictions ───
  const fetchPredictions = useCallback(
    (input: string) => {
      if (!autocompleteService.current || input.trim().length < 2) {
        setPredictions([]);
        setShowDropdown(false);
        return;
      }
      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      debounceTimer.current = setTimeout(() => {
        const request: google.maps.places.AutocompletionRequest = {
          input: destination ? `${input} ${destination}` : input,
          ...(searchTypes !== undefined
            ? (searchTypes.length > 0 ? { types: searchTypes } : {})
            : { types: ['establishment'] }),
        };

        autocompleteService.current!.getPlacePredictions(request, (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results?.length) {
            setPredictions(results);
            setShowDropdown(true);
            setActiveIndex(-1);
          } else {
            setPredictions([]);
            setShowDropdown(false);
          }
        });
      }, 300);
    },
    [destination, searchTypes],
  );

  // ─── Select prediction ───
  const selectPrediction = useCallback(
    (prediction: google.maps.places.AutocompletePrediction) => {
      const name = prediction.structured_formatting?.main_text || prediction.description;
      setQuery(name);
      setShowDropdown(false);
      setPredictions([]);

      if (placesService.current) {
        placesService.current.getDetails(
          {
            placeId: prediction.place_id,
            fields: ['geometry', 'formatted_address', 'name', 'types', 'address_components'],
          },
          (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place) {
              onSelect({
                name: place.name || name,
                placeId: prediction.place_id,
                address: place.formatted_address || undefined,
                lat: place.geometry?.location?.lat(),
                lng: place.geometry?.location?.lng(),
                type: place.types ? inferPlaceType(place.types) : suggestedType || 'activity',
                googleTypes: place.types || undefined,
                addressComponents: place.address_components || undefined,
              });
            } else {
              onSelect({
                name,
                placeId: prediction.place_id,
                type: suggestedType || 'activity',
              });
            }
          },
        );
      } else {
        onSelect({ name, placeId: prediction.place_id, type: suggestedType || 'activity' });
      }
    },
    [onSelect, suggestedType],
  );

  // ─── Mode switching ───
  const switchToCustom = () => {
    switchingMode.current = true;
    setCustomName(query);
    setShowDropdown(false);
    setMode('custom');
    setTimeout(() => { switchingMode.current = false; }, 150);
  };

  const switchToSearch = () => {
    switchingMode.current = true;
    setMode('search');
    setTimeout(() => { switchingMode.current = false; }, 150);
  };

  // ─── Keyboard ───
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
      onCancel();
      return;
    }
    if (!showDropdown || predictions.length === 0) {
      if (e.key === 'Enter' && query.trim()) {
        e.preventDefault();
        // Freeform: treat as custom with just a name
        onSelect({ name: query.trim(), type: suggestedType || 'activity' });
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, predictions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < predictions.length) {
        selectPrediction(predictions[activeIndex]);
      } else if (query.trim()) {
        onSelect({ name: query.trim(), type: suggestedType || 'activity' });
      }
    }
  };

  const TYPE_OPTIONS: { value: PlaceType; label: string }[] = [
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'bar', label: 'Bar' },
    { value: 'cafe', label: 'Café' },
    { value: 'museum', label: 'Museum' },
    { value: 'activity', label: 'Activity' },
    { value: 'shop', label: 'Shop' },
    { value: 'neighborhood', label: 'Neighborhood' },
  ];

  const accentColor = 'var(--t-verde)';

  // Shared input style
  const inputStyle: React.CSSProperties = {
    fontFamily: FONT.sans,
    fontSize: compact ? 13 : 14,
    fontWeight: 500,
    color: 'var(--t-ink)',
    background: INK['04'],
    border: `1px solid var(--t-linen)`,
    borderRadius: 10,
    outline: 'none',
    padding: compact ? '8px 12px 8px 32px' : '10px 14px 10px 36px',
    width: '100%',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  };

  const inputFocusBorder = `1.5px solid ${accentColor}`;
  const inputFocusShadow = `0 0 0 3px rgba(42, 122, 86, 0.08)`;

  // ═══ CUSTOM MODE ═══
  if (mode === 'custom') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: compact ? '6px 8px' : '8px 12px',
      }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute',
            left: compact ? 10 : 12,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none',
          }}>
            <PerriandIcon name="add" size={compact ? 13 : 15} color={accentColor} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') onCancel();
              if (e.key === 'Enter' && customName.trim()) {
                onSelect({ name: customName.trim(), type: customType, isCustom: true });
              }
            }}
            placeholder="Place name…"
            onFocus={e => {
              e.currentTarget.style.border = inputFocusBorder;
              e.currentTarget.style.boxShadow = inputFocusShadow;
            }}
            onBlur={e => {
              e.currentTarget.style.border = `1px solid var(--t-linen)`;
              e.currentTarget.style.boxShadow = 'none';
            }}
            style={{
              ...inputStyle,
              fontWeight: 600,
            }}
          />
        </div>
        {/* Type picker */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          paddingLeft: 4,
        }}>
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setCustomType(opt.value)}
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                fontWeight: customType === opt.value ? 700 : 500,
                color: customType === opt.value ? 'white' : INK['50'],
                background: customType === opt.value ? accentColor : INK['06'],
                border: 'none',
                borderRadius: 12,
                padding: '4px 10px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onMouseDown={e => { e.preventDefault(); switchToSearch(); }}
          style={{
            fontFamily: FONT.sans,
            fontSize: 11,
            color: accentColor,
            background: 'none',
            border: 'none',
            padding: '2px 4px 0',
            cursor: 'pointer',
            textAlign: 'left',
            opacity: 0.8,
          }}
        >
          Search Google Places instead
        </button>
      </div>
    );
  }

  // ═══ SEARCH MODE ═══
  return (
    <div className="relative" style={{ padding: compact ? '6px 8px' : '8px 12px' }}>
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute',
          left: compact ? 10 : 12,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          alignItems: 'center',
          pointerEvents: 'none',
        }}>
          <PerriandIcon name="add" size={compact ? 13 : 15} color={accentColor} />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            fetchPredictions(e.target.value);
          }}
          onBlur={() => {
            setTimeout(() => {
              if (!switchingMode.current) {
                setShowDropdown(false);
              }
            }, 250);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          onFocus={e => {
            e.currentTarget.style.border = inputFocusBorder;
            e.currentTarget.style.boxShadow = inputFocusShadow;
          }}
          style={inputStyle}
        />
      </div>

      {/* Autocomplete dropdown */}
      {showDropdown && predictions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: compact ? 8 : 12,
            right: compact ? 8 : 12,
            top: '100%',
            marginTop: 6,
            background: 'white',
            border: '1px solid var(--t-linen)',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
            maxHeight: 260,
            overflowY: 'auto',
            zIndex: 50,
          }}
        >
          {predictions.map((p, i) => (
            <button
              key={p.place_id}
              onMouseDown={e => {
                e.preventDefault();
                selectPrediction(p);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                width: '100%',
                padding: '10px 14px',
                cursor: 'pointer',
                textAlign: 'left',
                background: i === activeIndex ? INK['04'] : 'transparent',
                border: 'none',
                transition: 'background 0.1s ease',
              }}
            >
              <span
                style={{ fontFamily: FONT.sans, fontSize: 13, fontWeight: 500, color: 'var(--t-ink)' }}
              >
                {p.structured_formatting?.main_text || p.description}
              </span>
              {p.structured_formatting?.secondary_text && (
                <span
                  style={{
                    fontFamily: FONT.sans,
                    fontSize: 11,
                    color: INK['50'],
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%',
                  }}
                >
                  {p.structured_formatting.secondary_text}
                </span>
              )}
            </button>
          ))}

          {/* Custom place option at bottom */}
          <button
            onMouseDown={e => {
              e.preventDefault();
              switchToCustom();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 14px',
              cursor: 'pointer',
              textAlign: 'left',
              background: 'transparent',
              border: 'none',
              borderTop: `1px solid var(--t-linen)`,
            }}
          >
            <PerriandIcon name="edit" size={12} color={INK['40']} />
            <span style={{ fontFamily: FONT.sans, fontSize: 12, color: INK['50'] }}>
              Add custom place
            </span>
          </button>
        </div>
      )}

      {/* Inline hint when empty */}
      {!showDropdown && query.length === 0 && (
        <button
          onMouseDown={e => { e.preventDefault(); switchToCustom(); }}
          style={{
            fontFamily: FONT.sans,
            fontSize: 11,
            color: INK['40'],
            background: 'none',
            border: 'none',
            padding: '6px 0 0',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          or type a custom place
        </button>
      )}
    </div>
  );
}

// ─── Exported component — uses shared MapsProvider from layout ───
export default function PlaceSearchInput(props: PlaceSearchInputProps) {
  return <PlaceSearchInputInner {...props} />;
}

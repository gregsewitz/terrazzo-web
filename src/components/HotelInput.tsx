'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import type { HotelInfo } from '@/types';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

interface HotelInputProps {
  value?: HotelInfo;
  legacyValue?: string;           // backwards compat with plain string
  onSave: (hotel: HotelInfo | null) => void;
  onCancel: () => void;
  accentColor?: string;
  textColor?: string;
  destination?: string;           // bias results toward trip destination
}

// ─── Inner component (must be inside APIProvider) ───
function HotelInputInner({
  value,
  legacyValue,
  onSave,
  onCancel,
  accentColor = 'var(--t-verde)',
  textColor = 'var(--t-ink)',
  destination,
}: HotelInputProps) {
  const places = useMapsLibrary('places');

  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Track whether we're switching modes — prevents blur from saving/closing
  const switchingMode = useRef(false);

  // ─── State ───
  const initialName = value?.name || legacyValue || '';
  const [query, setQuery] = useState(initialName);
  const [mode, setMode] = useState<'search' | 'custom'>(value?.isCustom ? 'custom' : 'search');
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Custom mode fields
  const [customName, setCustomName] = useState(value?.isCustom ? value.name : '');
  const [customAddress, setCustomAddress] = useState(value?.isCustom ? value.address || '' : '');

  // ─── Init Google Places services ───
  useEffect(() => {
    if (!places) return;
    autocompleteService.current = new places.AutocompleteService();
    const div = document.createElement('div');
    placesService.current = new places.PlacesService(div);
  }, [places]);

  // Auto-focus on mount and mode switch
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [mode]);

  // ─── Fetch autocomplete predictions ───
  const fetchPredictions = useCallback(
    (input: string) => {
      if (!autocompleteService.current || input.trim().length < 2) {
        setPredictions([]);
        setShowDropdown(false);
        return;
      }

      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      debounceTimer.current = setTimeout(() => {
        // Use 'establishment' type — 'lodging' is not valid for Autocomplete API
        const request: google.maps.places.AutocompletionRequest = {
          input: destination ? `${input} hotel ${destination}` : input,
          types: ['establishment'],
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
    [destination],
  );

  // ─── Select a prediction ───
  const selectPrediction = useCallback(
    (prediction: google.maps.places.AutocompletePrediction) => {
      const name =
        prediction.structured_formatting?.main_text || prediction.description;
      setQuery(name);
      setShowDropdown(false);
      setPredictions([]);

      // Get full place details
      if (placesService.current) {
        placesService.current.getDetails(
          {
            placeId: prediction.place_id,
            fields: ['geometry', 'formatted_address', 'name'],
          },
          (place, status) => {
            if (
              status === google.maps.places.PlacesServiceStatus.OK &&
              place?.geometry?.location
            ) {
              onSave({
                name: place.name || name,
                placeId: prediction.place_id,
                address: place.formatted_address || undefined,
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
              });
            } else {
              onSave({
                name,
                placeId: prediction.place_id,
              });
            }
          },
        );
      } else {
        onSave({ name, placeId: prediction.place_id });
      }
    },
    [onSave],
  );

  // ─── Save custom accommodation ───
  const handleCustomSave = () => {
    if (switchingMode.current) return;
    if (!customName.trim()) {
      onCancel();
      return;
    }
    onSave({
      name: customName.trim(),
      address: customAddress.trim() || undefined,
      isCustom: true,
    });
  };

  // ─── Save freeform text (no autocomplete selection) ───
  const handleFreeformSave = () => {
    if (switchingMode.current) return;
    if (!query.trim()) {
      onCancel();
      return;
    }
    // If they typed but didn't select, save as plain name
    onSave({ name: query.trim() });
  };

  // ─── Switch mode helper (prevents blur race) ───
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

  // ─── Keyboard handling ───
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
      onCancel();
      return;
    }

    if (!showDropdown || predictions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleFreeformSave();
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
      } else {
        handleFreeformSave();
      }
    }
  };

  // Shared input style
  const inputStyle: React.CSSProperties = {
    fontFamily: FONT.sans,
    fontSize: 13,
    fontWeight: 500,
    color: textColor,
    background: INK['04'],
    border: `1px solid var(--t-linen)`,
    borderRadius: 10,
    outline: 'none',
    padding: '8px 12px',
    width: '100%',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  };

  const inputFocusStyle = `1.5px solid ${accentColor}`;
  const inputFocusShadow = `0 0 0 3px ${accentColor}18`;

  // ═══ CUSTOM MODE (Airbnb/Villa) ═══
  if (mode === 'custom') {
    return (
      <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none',
          }}>
            <PerriandIcon name="hotel" size={14} color={accentColor} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') onCancel();
              if (e.key === 'Enter') handleCustomSave();
            }}
            placeholder="e.g. Airbnb in Shibuya…"
            onFocus={e => {
              e.currentTarget.style.border = inputFocusStyle;
              e.currentTarget.style.boxShadow = inputFocusShadow;
            }}
            onBlur={e => {
              e.currentTarget.style.border = `1px solid var(--t-linen)`;
              e.currentTarget.style.boxShadow = 'none';
            }}
            style={{
              ...inputStyle,
              fontWeight: 600,
              paddingLeft: 32,
            }}
          />
        </div>
        <input
          type="text"
          value={customAddress}
          onChange={e => setCustomAddress(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') onCancel();
            if (e.key === 'Enter') handleCustomSave();
          }}
          onBlur={handleCustomSave}
          placeholder="Address (optional)"
          onFocus={e => {
            e.currentTarget.style.border = inputFocusStyle;
            e.currentTarget.style.boxShadow = inputFocusShadow;
          }}
          style={{
            ...inputStyle,
            fontSize: 12,
            color: INK['60'],
            padding: '6px 12px',
          }}
        />
        <button
          onMouseDown={e => { e.preventDefault(); switchToSearch(); }}
          style={{
            fontFamily: FONT.sans,
            fontSize: 11,
            color: accentColor,
            background: 'none',
            border: 'none',
            padding: '2px 0',
            cursor: 'pointer',
            textAlign: 'left',
            opacity: 0.8,
          }}
        >
          Search hotels instead
        </button>
      </div>
    );
  }

  // ═══ SEARCH MODE (Google Places Autocomplete) ═══
  return (
    <div ref={containerRef} className="relative" style={{ minWidth: 200 }}>
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute',
          left: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          alignItems: 'center',
          pointerEvents: 'none',
        }}>
          <PerriandIcon name="hotel" size={14} color={accentColor} />
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
            // Delay to allow click on dropdown or mode switch
            setTimeout(() => {
              if (!switchingMode.current) handleFreeformSave();
            }, 250);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search hotel…"
          onFocus={e => {
            e.currentTarget.style.border = inputFocusStyle;
            e.currentTarget.style.boxShadow = inputFocusShadow;
          }}
          style={{
            ...inputStyle,
            fontWeight: 600,
            paddingLeft: 32,
          }}
        />
      </div>

      {/* Autocomplete dropdown */}
      {showDropdown && predictions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
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
                e.preventDefault(); // prevent blur
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

          {/* Custom accommodation option */}
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
            <PerriandIcon name="add" size={12} color={INK['40']} />
            <span style={{ fontFamily: FONT.sans, fontSize: 12, color: INK['50'] }}>
              Airbnb / Villa / Other
            </span>
          </button>
        </div>
      )}

      {/* Quick toggle to custom mode */}
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
          or add Airbnb / Villa
        </button>
      )}
    </div>
  );
}

// ─── Exported component — uses shared MapsProvider from layout ───
export default function HotelInput(props: HotelInputProps) {
  return <HotelInputInner {...props} />;
}

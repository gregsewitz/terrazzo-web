'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useOnboardingStore } from '@/stores/onboardingStore';
import type { TravelContext } from '@/types';
import { T } from '@/types';
import { FONT, INK } from '@/constants/theme';

// ─── Companion chip options ───

const COMPANION_OPTIONS: { id: TravelContext; label: string }[] = [
  { id: 'solo', label: 'Solo' },
  { id: 'partner', label: 'Partner' },
  { id: 'friends', label: 'Friends' },
  { id: 'family', label: 'Family' },
];

interface QuickBioFormViewProps {
  onComplete: () => void;
}

export default function QuickBioFormView({ onComplete }: QuickBioFormViewProps) {
  const setLifeContext = useOnboardingStore((s) => s.setLifeContext);
  const setCurrentPhaseProgress = useOnboardingStore((s) => s.setCurrentPhaseProgress);
  const places = useMapsLibrary('places');

  const [firstName, setFirstName] = useState('');
  const [homeCity, setHomeCity] = useState('');
  const [homeCityGeo, setHomeCityGeo] = useState<{ lat: number; lng: number; placeId?: string } | undefined>();
  const [companions, setCompanions] = useState<TravelContext[]>([]);
  const [partnerName, setPartnerName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Google Places autocomplete state
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceDiv = useRef<HTMLDivElement | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cityPredictions, setCityPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [activeCityIndex, setActiveCityIndex] = useState(-1);

  // Init Google Places services
  useEffect(() => {
    if (!places) return;
    autocompleteService.current = new places.AutocompleteService();
    if (!placesServiceDiv.current) {
      placesServiceDiv.current = document.createElement('div');
    }
    placesService.current = new places.PlacesService(placesServiceDiv.current);
  }, [places]);

  const showPartnerField = companions.includes('partner');
  const isValid = firstName.trim().length > 0;

  // Track form progress
  const updateProgress = useCallback((fn: string, hc: string, comp: TravelContext[]) => {
    let filled = 0;
    if (fn.trim()) filled++;
    if (hc.trim()) filled++;
    if (comp.length > 0) filled++;
    setCurrentPhaseProgress(filled / 3);
  }, [setCurrentPhaseProgress]);

  // Fetch city predictions from Google Places
  const fetchCityPredictions = useCallback((input: string) => {
    if (!autocompleteService.current || input.trim().length < 2) {
      setCityPredictions([]);
      setShowCityDropdown(false);
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      autocompleteService.current!.getPlacePredictions(
        { input, types: ['(regions)'] },
        (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results?.length) {
            setCityPredictions(results);
            setShowCityDropdown(true);
            setActiveCityIndex(-1);
          } else {
            setCityPredictions([]);
            setShowCityDropdown(false);
          }
        },
      );
    }, 250);
  }, []);

  // Select a city prediction
  const selectCityPrediction = useCallback(
    (prediction: google.maps.places.AutocompletePrediction) => {
      const displayName = prediction.structured_formatting?.main_text || prediction.description;
      setHomeCity(displayName);
      setShowCityDropdown(false);
      setCityPredictions([]);

      // Fetch place details for lat/lng
      if (placesService.current) {
        placesService.current.getDetails(
          { placeId: prediction.place_id, fields: ['geometry', 'formatted_address'] },
          (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place) {
              setHomeCityGeo({
                lat: place.geometry?.location?.lat() ?? 0,
                lng: place.geometry?.location?.lng() ?? 0,
                placeId: prediction.place_id,
              });
            } else {
              setHomeCityGeo({ lat: 0, lng: 0, placeId: prediction.place_id });
            }
          },
        );
      }
      updateProgress(firstName, displayName, companions);
    },
    [firstName, companions, updateProgress],
  );

  const handleCityKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showCityDropdown || cityPredictions.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveCityIndex((prev) => Math.min(prev + 1, cityPredictions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveCityIndex((prev) => Math.max(prev - 1, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeCityIndex >= 0 && activeCityIndex < cityPredictions.length) {
          selectCityPrediction(cityPredictions[activeCityIndex]);
        }
      }
    },
    [showCityDropdown, cityPredictions, activeCityIndex, selectCityPrediction],
  );

  const toggleCompanion = useCallback((id: TravelContext) => {
    setCompanions((prev) => {
      const next = prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id];
      updateProgress(firstName, homeCity, next);
      return next;
    });
  }, [firstName, homeCity, updateProgress]);

  const handleSubmit = useCallback(() => {
    if (submitted || !isValid) return;
    setSubmitted(true);

    setLifeContext({
      firstName: firstName.trim(),
      homeCity: homeCity.trim() || undefined,
      homeCityGeo,
      primaryCompanions: companions,
      partnerName: showPartnerField && partnerName.trim() ? partnerName.trim() : undefined,
    });

    setCurrentPhaseProgress(1);
    setTimeout(onComplete, 350);
  }, [submitted, isValid, firstName, homeCity, companions, partnerName, showPartnerField, setLifeContext, setCurrentPhaseProgress, onComplete]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 20px 40px',
        flex: 1,
        overflow: 'auto',
      }}
    >
      <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* First Name */}
        <div style={{ animation: 'fadeInUp 0.4s ease 0s both' }}>
          <label style={labelStyle}>First name</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              updateProgress(e.target.value, homeCity, companions);
            }}
            placeholder="What should we call you?"
            disabled={submitted}
            autoFocus
            style={inputStyle(submitted)}
          />
        </div>

        {/* Home City — Google Places Autocomplete */}
        <div style={{ animation: 'fadeInUp 0.4s ease 0.06s both', position: 'relative', zIndex: 10 }}>
          <label style={labelStyle}>Home base</label>
          <input
            type="text"
            value={homeCity}
            onChange={(e) => {
              setHomeCity(e.target.value);
              setHomeCityGeo(undefined); // clear geo when user edits
              updateProgress(firstName, e.target.value, companions);
              fetchCityPredictions(e.target.value);
            }}
            onKeyDown={handleCityKeyDown}
            onBlur={() => {
              setTimeout(() => setShowCityDropdown(false), 200);
            }}
            placeholder="City you live in"
            disabled={submitted}
            autoComplete="off"
            style={inputStyle(submitted)}
          />
          {/* Autocomplete dropdown */}
          {showCityDropdown && cityPredictions.length > 0 && !submitted && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '100%',
                marginTop: 4,
                background: 'white',
                border: '1px solid rgba(28,26,23,0.08)',
                borderRadius: 12,
                overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                maxHeight: 220,
                overflowY: 'auto',
                zIndex: 50,
              }}
            >
              {cityPredictions.map((p, i) => (
                <button
                  key={p.place_id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectCityPrediction(p);
                  }}
                  onMouseEnter={() => setActiveCityIndex(i)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    width: '100%',
                    padding: '10px 16px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    background: i === activeCityIndex ? 'rgba(28,26,23,0.03)' : 'transparent',
                    border: 'none',
                    transition: 'background 0.1s ease',
                  }}
                >
                  <span style={{ fontFamily: FONT.sans, fontSize: 14, fontWeight: 500, color: T.ink }}>
                    {p.structured_formatting?.main_text || p.description}
                  </span>
                  {p.structured_formatting?.secondary_text && (
                    <span style={{ fontFamily: FONT.sans, fontSize: 11, color: INK['40'], marginTop: 1 }}>
                      {p.structured_formatting.secondary_text}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Companions */}
        <div style={{ animation: 'fadeInUp 0.4s ease 0.12s both' }}>
          <label style={labelStyle}>Who do you usually travel with?</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {COMPANION_OPTIONS.map((opt) => {
              const active = companions.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleCompanion(opt.id)}
                  disabled={submitted}
                  className="btn-hover"
                  style={{
                    padding: '10px 18px',
                    borderRadius: 100,
                    border: `1.5px solid ${active ? T.ink : 'rgba(28,26,23,0.1)'}`,
                    background: active ? T.ink : 'transparent',
                    color: active ? T.cream : T.ink,
                    fontSize: 14,
                    fontWeight: 500,
                    fontFamily: FONT.sans,
                    cursor: submitted ? 'default' : 'pointer',
                    transition: 'all 0.2s ease',
                    letterSpacing: '0.01em',
                    opacity: submitted ? 0.6 : 1,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Partner Name (conditional) */}
        {showPartnerField && (
          <div style={{ animation: 'fadeInUp 0.3s ease 0s both' }}>
            <label style={labelStyle}>Partner&apos;s name</label>
            <input
              type="text"
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              placeholder="So we can keep things personal"
              disabled={submitted}
              style={inputStyle(submitted)}
            />
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitted || !isValid}
          className="btn-hover"
          style={{
            marginTop: 8,
            padding: '15px 40px',
            background: submitted ? T.travertine : isValid ? T.ink : 'rgba(28,26,23,0.15)',
            color: submitted ? INK['50'] : isValid ? T.cream : INK['40'],
            border: 'none',
            borderRadius: 100,
            fontSize: 15,
            fontWeight: 500,
            fontFamily: FONT.sans,
            cursor: submitted || !isValid ? 'default' : 'pointer',
            transition: 'all 0.25s ease',
            opacity: submitted ? 0.6 : 1,
            alignSelf: 'center',
            letterSpacing: '0.02em',
            animation: 'fadeInUp 0.4s ease 0.18s both',
          }}
        >
          {submitted ? 'Got it' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

// ─── Shared styles ───

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: INK['45'],
  fontFamily: FONT.mono,
  marginBottom: 8,
};

const inputStyle = (disabled: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '14px 18px',
  fontSize: 16,
  fontFamily: FONT.sans,
  color: T.ink,
  background: 'rgba(28,26,23,0.02)',
  border: '1px solid rgba(28,26,23,0.08)',
  borderRadius: 12,
  outline: 'none',
  transition: 'border-color 0.2s ease',
  opacity: disabled ? 0.6 : 1,
  letterSpacing: '0.01em',
  boxSizing: 'border-box',
});

'use client';

/**
 * useTripWeather — fetches weather forecast (or historical proxy) for each
 * destination across a trip's date range.
 *
 * Uses Open-Meteo (free, no API key required).
 * - Forecast API for dates ≤16 days out
 * - Archive API for past dates
 * - Previous-year same dates as a historical proxy for far-future trips
 *
 * Returns per-destination daily weather with a "isHistorical" flag when
 * using last year's data.
 */

import { useState, useEffect, useMemo } from 'react';
import type { Trip, GeoDestination } from '@/types';

export interface DailyWeather {
  date: string;
  tempHighC: number;
  tempLowC: number;
  precipMm: number;
  weatherCode: number;
  description: string;
}

export interface DestinationWeather {
  destination: string;
  lat: number;
  lng: number;
  days: DailyWeather[];
  isHistorical: boolean; // true = based on last year's data
  avgHighC: number;
  avgLowC: number;
  avgPrecipMm: number;
  dominantCondition: string;
}

// WMO Weather interpretation codes
const WMO_CODES: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle',
  56: 'Freezing drizzle', 57: 'Dense freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Heavy freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Light showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Severe thunderstorm',
};

// Simplified condition buckets for dominant condition
function simplifyCondition(code: number): string {
  if (code <= 1) return 'Clear';
  if (code <= 3) return 'Cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rainy';
  if (code <= 77) return 'Snowy';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snowy';
  return 'Stormy';
}

function getDominantCondition(codes: number[]): string {
  const counts: Record<string, number> = {};
  codes.forEach(c => {
    const bucket = simplifyCondition(c);
    counts[bucket] = (counts[bucket] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
}

// Weather condition emoji for display
export function weatherEmoji(code: number): string {
  if (code <= 1) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 57 || (code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return '🌧️';
  if (code <= 77 || (code >= 85 && code <= 86)) return '🌨️';
  return '⛈️';
}

interface OpenMeteoDailyResponse {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    weathercode: number[];
  };
}

async function fetchWeatherRange(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string,
  useArchive: boolean
): Promise<DailyWeather[]> {
  const baseUrl = useArchive
    ? 'https://archive-api.open-meteo.com/v1/archive'
    : 'https://api.open-meteo.com/v1/forecast';

  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode',
    start_date: startDate,
    end_date: endDate,
    timezone: 'auto',
  });

  const res = await fetch(`${baseUrl}?${params}`, {
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) return [];

  const data: OpenMeteoDailyResponse = await res.json();
  const d = data.daily;
  if (!d?.time?.length) return [];

  return d.time.map((date, i) => ({
    date,
    tempHighC: Math.round(d.temperature_2m_max[i]),
    tempLowC: Math.round(d.temperature_2m_min[i]),
    precipMm: Math.round(d.precipitation_sum[i] * 10) / 10,
    weatherCode: d.weathercode[i],
    description: WMO_CODES[d.weathercode[i]] || 'Unknown',
  }));
}

// Geocode a city name using Open-Meteo's free geocoding API (no key needed)
async function geocodeCity(name: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const result = data.results?.[0];
    if (!result?.latitude || !result?.longitude) return null;
    return { lat: result.latitude, lng: result.longitude };
  } catch {
    return null;
  }
}

interface DestRange {
  destName: string;
  lat: number;
  lng: number;
  startDate: string;
  endDate: string;
}

export function useTripWeather(trip: Trip | null | undefined) {
  const [results, setResults] = useState<DestinationWeather[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute unique destination names + date ranges from trip days
  // Note: day.date is human-readable ("Jun 12"), so we compute ISO dates
  // from trip.startDate (which IS ISO, e.g. "2026-06-11") + dayNumber offset
  const destDateGroups = useMemo(() => {
    if (trip?.flexibleDates || !trip?.startDate || !trip?.days?.length) return [];

    const tripStart = new Date(trip.startDate + 'T12:00:00');
    function dayToISO(dayNumber: number): string {
      const d = new Date(tripStart);
      d.setDate(d.getDate() + (dayNumber - 1));
      return d.toISOString().split('T')[0];
    }

    const groups: Array<{
      destName: string;
      startDate: string;
      endDate: string;
    }> = [];

    let currentDest: string | null = null;
    let rangeStart: string | null = null;
    let rangeEnd: string | null = null;

    for (const day of trip.days) {
      const dest = day.destination || trip.location;
      const isoDate = dayToISO(day.dayNumber);

      if (dest !== currentDest) {
        if (currentDest && rangeStart && rangeEnd) {
          groups.push({ destName: currentDest, startDate: rangeStart, endDate: rangeEnd });
        }
        currentDest = dest;
        rangeStart = isoDate;
        rangeEnd = isoDate;
      } else {
        rangeEnd = isoDate;
      }
    }
    if (currentDest && rangeStart && rangeEnd) {
      groups.push({ destName: currentDest, startDate: rangeStart, endDate: rangeEnd });
    }

    return groups;
  }, [trip]);

  useEffect(() => {
    if (destDateGroups.length === 0) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        // Step 1: Resolve lat/lng for each destination
        // Try geoDestinations first, fall back to Open-Meteo geocoding
        const geos = trip?.geoDestinations?.filter(g => g.lat && g.lng) || [];
        const resolvedRanges: DestRange[] = [];

        for (const group of destDateGroups) {
          // Try to find in existing geoDestinations
          const existingGeo = geos.find(g =>
            g.name.toLowerCase().includes(group.destName.toLowerCase()) ||
            group.destName.toLowerCase().includes(g.name.toLowerCase())
          );

          if (existingGeo?.lat && existingGeo?.lng) {
            resolvedRanges.push({
              destName: group.destName,
              lat: existingGeo.lat,
              lng: existingGeo.lng,
              startDate: group.startDate,
              endDate: group.endDate,
            });
          } else {
            // Geocode the city name via Open-Meteo (free, no key)
            const coords = await geocodeCity(group.destName);
            if (coords && !cancelled) {
              resolvedRanges.push({
                destName: group.destName,
                lat: coords.lat,
                lng: coords.lng,
                startDate: group.startDate,
                endDate: group.endDate,
              });
            }
          }
        }

        if (cancelled || resolvedRanges.length === 0) {
          if (!cancelled) setIsLoading(false);
          return;
        }

        // Step 2: Fetch weather for each resolved destination
        const now = new Date();
        const allResults: DestinationWeather[] = [];

        for (const range of resolvedRanges) {
          const start = new Date(range.startDate);
          const daysDiff = Math.floor((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          let queryStart = range.startDate;
          let queryEnd = range.endDate;
          let isHistorical = false;

          if (daysDiff > 16) {
            // Far future — use last year's same dates as proxy
            const proxyStart = new Date(range.startDate);
            proxyStart.setFullYear(proxyStart.getFullYear() - 1);
            const proxyEnd = new Date(range.endDate);
            proxyEnd.setFullYear(proxyEnd.getFullYear() - 1);
            queryStart = proxyStart.toISOString().split('T')[0];
            queryEnd = proxyEnd.toISOString().split('T')[0];
            isHistorical = true;
          }

          const useArchive = daysDiff < 0 || isHistorical;
          const days = await fetchWeatherRange(
            range.lat, range.lng,
            queryStart, queryEnd, useArchive
          );

          if (days.length > 0 && !cancelled) {
            const avgHighC = Math.round(days.reduce((s, d) => s + d.tempHighC, 0) / days.length);
            const avgLowC = Math.round(days.reduce((s, d) => s + d.tempLowC, 0) / days.length);
            const avgPrecipMm = Math.round(days.reduce((s, d) => s + d.precipMm, 0) / days.length * 10) / 10;

            allResults.push({
              destination: range.destName,
              lat: range.lat,
              lng: range.lng,
              days,
              isHistorical,
              avgHighC,
              avgLowC,
              avgPrecipMm,
              dominantCondition: getDominantCondition(days.map(d => d.weatherCode)),
            });
          }
        }

        if (!cancelled) {
          setResults(allResults);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.warn('[useTripWeather] Error:', err);
          setError(err?.message || 'Failed to load weather');
          setIsLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [destDateGroups, trip?.geoDestinations]);

  return { weather: results, isLoading, error };
}

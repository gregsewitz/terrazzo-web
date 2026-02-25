/**
 * Weather context for suggestion engine — powered by Open-Meteo (free, no API key).
 *
 * Uses the forecast API for future dates (up to 16 days out) and the
 * historical archive API for past dates. Returns daily high/low temp,
 * precipitation, and a human-readable description.
 */

import type { DayWeather } from '@/types';

// WMO Weather interpretation codes → human descriptions
const WMO_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snowfall',
  73: 'Moderate snowfall',
  75: 'Heavy snowfall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

interface OpenMeteoDaily {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  weathercode: number[];
}

/**
 * Fetch weather for a specific date and location.
 * Uses forecast API for near-future dates, archive API for past dates.
 * Returns null on any failure (non-blocking — suggestions still work without weather).
 */
export async function fetchDayWeather(
  lat: number,
  lng: number,
  date: string // ISO date string, e.g. "2026-03-15"
): Promise<DayWeather | null> {
  try {
    const targetDate = new Date(date);
    const now = new Date();
    const daysDiff = Math.floor((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Choose endpoint: forecast for ≤16 days out, archive for past dates
    // For dates >16 days in the future, use same date from previous year as historical proxy
    let apiUrl: string;
    let queryDate = date;

    if (daysDiff >= 0 && daysDiff <= 16) {
      // Near future — use forecast
      apiUrl = 'https://api.open-meteo.com/v1/forecast';
    } else if (daysDiff < 0) {
      // Past date — use archive
      apiUrl = 'https://archive-api.open-meteo.com/v1/archive';
    } else {
      // Far future — use last year's same date as historical proxy
      const proxyDate = new Date(targetDate);
      proxyDate.setFullYear(proxyDate.getFullYear() - 1);
      queryDate = proxyDate.toISOString().split('T')[0];
      apiUrl = 'https://archive-api.open-meteo.com/v1/archive';
    }

    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode',
      start_date: queryDate,
      end_date: queryDate,
      timezone: 'auto',
    });

    const res = await fetch(`${apiUrl}?${params}`, {
      signal: AbortSignal.timeout(3000), // 3s timeout — don't block suggestions
    });

    if (!res.ok) return null;

    const data = await res.json();
    const daily: OpenMeteoDaily = data.daily;

    if (!daily?.time?.length) return null;

    const weatherCode = daily.weathercode[0];
    return {
      tempHighC: Math.round(daily.temperature_2m_max[0]),
      tempLowC: Math.round(daily.temperature_2m_min[0]),
      precipMm: Math.round(daily.precipitation_sum[0] * 10) / 10,
      weatherCode,
      description: WMO_CODES[weatherCode] || 'Unknown',
    };
  } catch (err) {
    // Weather is non-blocking — log and return null
    console.warn('[weather] Failed to fetch weather:', err);
    return null;
  }
}

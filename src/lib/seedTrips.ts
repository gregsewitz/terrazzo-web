import type { SeedTripInput, TripCreationData, GeoDestination } from '@/types';

/**
 * Convert onboarding seed trip inputs into TripCreationData
 * that can be passed to tripStore.createTrip
 */
export function seedTripToCreationData(seed: SeedTripInput): TripCreationData {
  // New path: structured name + destinations from DestinationInput
  if (seed.name && seed.destinations && seed.destinations.length > 0) {
    const { startDate, endDate } = estimateDates(seed);
    return {
      name: seed.name,
      destinations: seed.destinations.map(d => d.name),
      geoDestinations: seed.destinations,
      startDate,
      endDate,
      travelContext: seed.travelContext ?? 'partner',
      status: seed.status,
    };
  }

  // Legacy fallback: parse from single destination string
  const raw = (seed.destination || seed.name || '').trim();
  const destination = extractDestination(raw);
  const { startDate, endDate } = estimateDates(seed);

  return {
    name: raw || destination,
    destinations: [destination],
    startDate,
    endDate,
    travelContext: seed.travelContext ?? 'partner',
    status: seed.status,
  };
}

/**
 * Extract a geographic place name from free-text trip input (legacy fallback).
 */
function extractDestination(input: string): string {
  const temporalSplit = input.split(/\s+(?:in|during|for|this|next)\s+/i);
  if (temporalSplit.length > 1) {
    const firstPart = temporalSplit[0].trim();
    const lastPart = temporalSplit[temporalSplit.length - 1].trim();
    if (isGenericWord(firstPart) && !isTemporalPhrase(lastPart)) {
      return cleanDestination(lastPart);
    }
    if (!isTemporalPhrase(firstPart)) {
      return cleanDestination(firstPart);
    }
  }
  return cleanDestination(input);
}

function cleanDestination(text: string): string {
  const stripped = text
    .replace(/\b(trip|vacation|holiday|getaway|adventure|honeymoon|escape|visit|tour)\b/gi, '')
    .replace(/\b(family|solo|couples?|friends?|girls?|guys?|boys?|group|bachelor(?:ette)?)\b/gi, '')
    .replace(/\b(\d+\s*(?:weeks?|days?|nights?))\b/gi, '')
    .replace(/\b(spring|summer|fall|autumn|winter)\b/gi, '')
    .replace(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/gi, '')
    .replace(/\b20\d{2}\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return stripped || text.trim();
}

function isTemporalPhrase(text: string): boolean {
  return /^(spring|summer|fall|autumn|winter|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|next\s+\w+|\d+\s*(?:weeks?|days?)|cherry\s+blossom\s+season)/i.test(text.trim());
}

function isGenericWord(text: string): boolean {
  return /^(a|my|our|the|honeymoon|trip|vacation|family|solo|friends?|couples?|group|\d+\s*weeks?)/i.test(text.trim());
}

function estimateDates(seed: SeedTripInput): { startDate: string; endDate: string } {
  const now = new Date();
  const year = now.getFullYear();

  if (seed.dates) {
    const monthMatch = seed.dates.match(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i);
    if (monthMatch) {
      const months: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
      };
      const month = months[monthMatch[0].toLowerCase()];
      const yearMatch = seed.dates.match(/20\d{2}/);
      const dateYear = yearMatch ? parseInt(yearMatch[0]) : (month < now.getMonth() ? year + 1 : year);
      const start = new Date(dateYear, month, 15);
      const end = new Date(dateYear, month, 22);
      return { startDate: toISO(start), endDate: toISO(end) };
    }

    const seasonMap: Record<string, number> = { spring: 3, summer: 6, fall: 9, autumn: 9, winter: 11 };
    for (const [season, month] of Object.entries(seasonMap)) {
      if (seed.dates.toLowerCase().includes(season)) {
        const dateYear = month < now.getMonth() ? year + 1 : year;
        const start = new Date(dateYear, month, 1);
        const end = new Date(dateYear, month, 8);
        return { startDate: toISO(start), endDate: toISO(end) };
      }
    }
  }

  if (seed.status === 'dreaming') {
    const future = new Date(now);
    future.setMonth(future.getMonth() + 6);
    const end = new Date(future);
    end.setDate(end.getDate() + 7);
    return { startDate: toISO(future), endDate: toISO(end) };
  }

  const start = new Date(now);
  start.setMonth(start.getMonth() + 2);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { startDate: toISO(start), endDate: toISO(end) };
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

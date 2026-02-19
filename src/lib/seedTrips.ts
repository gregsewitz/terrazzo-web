import type { SeedTripInput, TripCreationData } from '@/types';

/**
 * Convert onboarding seed trip inputs into TripCreationData
 * that can be passed to tripStore.createTrip
 */
export function seedTripToCreationData(seed: SeedTripInput): TripCreationData {
  // Parse destination — could be "Sicily in September" or "Japan during cherry blossom season"
  const destination = seed.destination.split(/\s+in\s+|\s+during\s+/i)[0].trim();

  // Try to extract rough dates
  const { startDate, endDate } = estimateDates(seed);

  return {
    name: destination,
    destinations: [destination],
    startDate,
    endDate,
    travelContext: seed.travelContext ?? 'partner',
    status: seed.status,
  };
}

function estimateDates(seed: SeedTripInput): { startDate: string; endDate: string } {
  const now = new Date();
  const year = now.getFullYear();

  // If dates string is provided, try to parse it
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

    // Season-based
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

  // For dream trips, put them ~6 months out
  if (seed.status === 'dreaming') {
    const future = new Date(now);
    future.setMonth(future.getMonth() + 6);
    const end = new Date(future);
    end.setDate(end.getDate() + 7);
    return { startDate: toISO(future), endDate: toISO(end) };
  }

  // Default: 2 months from now
  const start = new Date(now);
  start.setMonth(start.getMonth() + 2);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { startDate: toISO(start), endDate: toISO(end) };
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

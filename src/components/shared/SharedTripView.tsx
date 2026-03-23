'use client';

import React, { useState, useMemo } from 'react';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT, COLOR, SECTION } from '@/constants/theme';
import { TYPE_ICONS, TYPE_BRAND_COLORS, THUMB_GRADIENTS } from '@/constants/placeTypes';
import { generateDestColor, getDestColor } from '@/lib/destination-helpers';
import { getDisplayLocation } from '@/lib/place-display';
import { getMatchTier, shouldShowTierBadge } from '@/lib/match-tier';
import GoogleMapView, { type MapMarker } from '@/components/maps/GoogleMapView';
import { formatTime12h } from '@/components/place/PlaceTimeEditor';
import { QUICK_ENTRY_CATEGORY_ICONS } from '@/types';
import type { ImportedPlace, TripDay, PlaceType } from '@/types';

// ─── Types ───

interface SharedTripProps {
  trip: {
    id: string;
    name: string;
    location: string;
    destinations: string[] | null;
    startDate: string | null;
    endDate: string | null;
    groupSize: number | null;
    groupType: string | null;
    days: TripDay[];
    pool?: ImportedPlace[];
    status: string;
    vibe: string | null;
  };
  ownerName: string;
}

type ViewMode = 'overview' | 'itinerary' | 'map';

const TYPE_LABELS: Record<string, string> = {
  restaurant: 'Restaurant',
  hotel: 'Hotel',
  bar: 'Bar',
  cafe: 'Café',
  museum: 'Museum',
  activity: 'Activity',
  neighborhood: 'Neighborhood',
  shop: 'Shop',
  rental: 'Rental',
};

// ─── Helpers ───

function formatDateLong(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDateShort(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function placeholderGradient(type: string): string {
  const brandHex = TYPE_BRAND_COLORS[type as PlaceType] || COLOR.navy;
  return `linear-gradient(135deg, ${brandHex}18 0%, ${brandHex}30 100%)`;
}

function getAllPlaces(days: TripDay[], pool?: ImportedPlace[]): ImportedPlace[] {
  const placed = days.flatMap(d => d.slots.flatMap(s => s.places));
  return [...placed, ...(pool || [])];
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function SharedTripView({ trip, ownerName }: SharedTripProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');

  const days = trip.days || [];
  const destinations = trip.destinations || [trip.location];
  const allPlaces = useMemo(() => getAllPlaces(days, trip.pool), [days, trip.pool]);

  // Type breakdown
  const typeMap = useMemo(() => {
    const map: Record<string, number> = {};
    allPlaces.forEach(p => { map[p.type] = (map[p.type] || 0) + 1; });
    return map;
  }, [allPlaces]);

  const typeBreakdown = useMemo(() => {
    return Object.entries(typeMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => `${count} ${TYPE_LABELS[type] || type}${count !== 1 ? 's' : ''}`)
      .join(', ');
  }, [typeMap]);

  // Featured places — all placed items, editorial-rich ones sorted first
  const featured = useMemo(() => {
    return [...allPlaces]
      .sort((a, b) => {
        const scoreA = (a.terrazzoInsight?.why ? 2 : 0) + (a.whatToOrder?.length ? 1 : 0) + (a.tips?.length ? 1 : 0);
        const scoreB = (b.terrazzoInsight?.why ? 2 : 0) + (b.whatToOrder?.length ? 1 : 0) + (b.tips?.length ? 1 : 0);
        return scoreB - scoreA;
      });
  }, [allPlaces]);

  // Hotels
  const uniqueHotels = useMemo(() => {
    const hotels = days
      .filter(d => d.hotelInfo?.name || d.hotel)
      .map(d => d.hotelInfo?.name || d.hotel || '');
    return Array.from(new Set(hotels));
  }, [days]);

  // Places by destination
  const placesByDest = useMemo(() => {
    const map = new Map<string, ImportedPlace[]>();
    days.forEach(d => {
      const dest = d.destination || trip.location;
      const existing = map.get(dest) || [];
      existing.push(...d.slots.flatMap(s => s.places));
      map.set(dest, existing);
    });
    return map;
  }, [days, trip.location]);

  // Map markers with day colors
  const mapMarkers = useMemo((): MapMarker[] => {
    const markers: MapMarker[] = [];
    // Build destination-to-color map
    const destColorMap = new Map<string, string>();
    destinations.forEach((dest, i) => {
      destColorMap.set(dest, getDestColor(i).accent);
    });

    days.forEach(day => {
      const dayDest = day.destination || trip.location;
      const dayColor = destColorMap.get(dayDest) || getDestColor(0).accent;

      day.slots.forEach(slot => {
        slot.places.forEach(place => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const google = place.google || (place as any).googleData;
          const lat = google?.lat as number | undefined;
          const lng = google?.lng as number | undefined;
          if (lat && lng) {
            markers.push({
              id: place.id,
              name: place.name,
              location: place.location || '',
              type: place.type,
              lat,
              lng,
              color: dayColor,
              matchScore: place.matchScore ?? undefined,
              description: place.enrichment?.description,
            });
          }
        });
      });
    });
    return markers;
  }, [days, destinations, trip.location]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--t-cream)' }}>
      {/* ── Sticky header with view tabs ── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'rgba(245,240,230,0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--t-linen)',
        }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '12px 20px 0' }}>
          {/* Brand + shared by */}
          <div className="flex items-center justify-between mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-pixellance-navy.svg"
              alt="Terrazzo"
              style={{ height: 18, width: 'auto' }}
            />
            <span style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              color: TEXT.secondary,
            }}>
              Shared by {ownerName}
            </span>
          </div>

          {/* View mode tabs */}
          <div className="flex gap-0" style={{ marginBottom: -1 }}>
            {([
              { key: 'overview', label: 'Overview', icon: 'discover' },
              { key: 'itinerary', label: 'Itinerary', icon: 'calendar' },
              { key: 'map', label: 'Map', icon: 'location' },
            ] as const).map(tab => {
              const active = viewMode === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setViewMode(tab.key)}
                  className="flex items-center gap-1.5 px-4 py-2.5 cursor-pointer transition-all"
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: active ? '2px solid var(--t-dark-teal)' : '2px solid transparent',
                    fontFamily: FONT.sans,
                    fontSize: 12,
                    fontWeight: active ? 600 : 500,
                    color: active ? 'var(--t-dark-teal)' : TEXT.secondary,
                  }}
                >
                  <PerriandIcon
                    name={tab.icon}
                    size={13}
                    color={active ? 'var(--t-dark-teal)' : INK['40']}
                  />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {viewMode === 'overview' && (
          <OverviewView
            trip={trip}
            days={days}
            destinations={destinations}
            allPlaces={allPlaces}
            typeBreakdown={typeBreakdown}
            featured={featured}
            uniqueHotels={uniqueHotels}
            placesByDest={placesByDest}
          />
        )}

        {viewMode === 'itinerary' && (
          <ItineraryView
            trip={trip}
            days={days}
            destinations={destinations}
          />
        )}

        {viewMode === 'map' && (
          <MapView
            markers={mapMarkers}
            fallbackDestination={trip.location}
            days={days}
            destinations={destinations}
            tripLocation={trip.location}
          />
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
//  OVERVIEW VIEW (mirrors TripBriefing)
// ═══════════════════════════════════════════════════════════════════

function OverviewView({
  trip, days, destinations, allPlaces, typeBreakdown, featured, uniqueHotels, placesByDest,
}: {
  trip: SharedTripProps['trip'];
  days: TripDay[];
  destinations: string[];
  allPlaces: ImportedPlace[];
  typeBreakdown: string;
  featured: ImportedPlace[];
  uniqueHotels: string[];
  placesByDest: Map<string, ImportedPlace[]>;
}) {
  return (
    <div style={{ paddingBottom: 120 }}>

      {/* ── HERO ── */}
      <div style={{ padding: '48px 24px 40px' }}>
        <div style={{
          fontFamily: FONT.mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
          textTransform: 'uppercase', color: SECTION.plain.accent,
          marginBottom: 28,
        }}>
          Terrazzo · Trip
        </div>

        <h1 style={{
          fontFamily: FONT.serif, fontSize: 42, fontStyle: 'italic',
          fontWeight: 400, color: SECTION.plain.primary,
          margin: 0, lineHeight: 1.1, letterSpacing: '-0.015em',
          maxWidth: 560,
        }}>
          {trip.name}
        </h1>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          marginTop: 16, flexWrap: 'wrap',
        }}>
          <span style={{ fontFamily: FONT.sans, fontSize: 13, color: TEXT.primary }}>
            {trip.startDate && trip.endDate
              ? `${formatDateLong(trip.startDate)} — ${formatDateLong(trip.endDate)}`
              : `${days.length} days`
            }
          </span>
        </div>

        <div style={{
          fontFamily: FONT.sans, fontSize: 15, lineHeight: 1.65,
          color: TEXT.primary, marginTop: 24, maxWidth: 520,
        }}>
          {days.length} days across {destinations.length === 1
            ? destinations[0]
            : destinations.slice(0, -1).join(', ') + ' and ' + destinations[destinations.length - 1]
          }. {typeBreakdown} — curated for taste.
        </div>
      </div>

      {/* ── AT A GLANCE ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-evenly', gap: 16,
        padding: '32px 20px',
        borderTop: '1px solid var(--t-linen)',
        borderBottom: '1px solid var(--t-linen)',
      }}>
        <StatBlock value={days.length} label="Days" />
        <StatBlock value={destinations.length} label={destinations.length === 1 ? 'City' : 'Cities'} />
        <StatBlock value={allPlaces.length} label="Places" />
        {uniqueHotels.length > 0 && (
          <StatBlock value={uniqueHotels.length} label={uniqueHotels.length === 1 ? 'Hotel' : 'Hotels'} />
        )}
      </div>

      {/* ── DESTINATION HEROES ── */}
      {destinations.length > 0 && (
        <div style={{ padding: '40px 24px 0' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: destinations.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
            gap: 16,
          }}>
            {destinations.map(dest => {
              const destPlaces = placesByDest.get(dest) || [];
              return <DestinationHero key={dest} name={dest} placeCount={destPlaces.length} />;
            })}
          </div>
        </div>
      )}

      {/* ── DAY BY DAY ── */}
      <div style={{
        margin: '40px 20px 0',
        padding: '36px 24px 12px',
        background: SECTION.editorial.bg,
        borderRadius: 20,
      }}>
        <SectionHeader kicker="Day by Day" title="The itinerary" variant="editorial" />
        <div>
          {days.map(d => (
            <ReadOnlyDayCard key={d.dayNumber} day={d} trip={trip} />
          ))}
        </div>
      </div>

      {/* ── FEATURED PLACES ── */}
      {featured.length > 0 && (
        <div style={{ padding: '48px 24px 0' }}>
          <SectionHeader kicker="The Places" title="What's waiting" />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))',
            gap: 20,
          }}>
            {featured.map(p => (
              <ReadOnlyPlaceCard key={p.id} place={p} />
            ))}
          </div>
        </div>
      )}

      {/* ── FOOTER ── */}
      <div style={{ padding: '64px 36px 32px', textAlign: 'center' }}>
        <div style={{ width: 40, height: 1, background: INK['10'], margin: '0 auto 20px' }} />
        <div style={{ marginBottom: 6 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-pixellance-navy.svg"
            alt="Terrazzo"
            style={{ height: 14, width: 'auto', opacity: 0.5 }}
          />
        </div>
        <div style={{ fontFamily: FONT.sans, fontSize: 11, color: TEXT.secondary }}>
          Travel that matches your taste
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
//  ITINERARY VIEW — Spreadsheet-style grid (days × slots)
// ═══════════════════════════════════════════════════════════════════

const GRID_SLOT_ORDER = ['breakfast', 'morning', 'lunch', 'afternoon', 'dinner', 'evening'];
const GRID_SLOT_META: Record<string, { label: string; time: string; icon: string }> = {
  breakfast: { label: 'Breakfast', time: '8 AM',   icon: 'breakfast' },
  morning:   { label: 'Morning',   time: '10 AM',  icon: 'discover' },
  lunch:     { label: 'Lunch',     time: '12:30 PM', icon: 'restaurant' },
  afternoon: { label: 'Afternoon', time: '2:30 PM', icon: 'discover' },
  dinner:    { label: 'Dinner',    time: '7 PM',   icon: 'restaurant' },
  evening:   { label: 'Evening',   time: '9:30 PM', icon: 'discover' },
};

/** Compact read-only card for the grid cell */
function GridCellCard({ place }: { place: ImportedPlace }) {
  const typeIcon = TYPE_ICONS[place.type as PlaceType] || 'pin';
  const brandColor = TYPE_BRAND_COLORS[place.type as PlaceType] || INK['70'];

  return (
    <div
      style={{
        padding: '5px 8px',
        borderRadius: 8,
        background: 'rgba(58,128,136,0.03)',
        border: '1px solid rgba(58,128,136,0.1)',
        marginBottom: 4,
      }}
    >
      {place.activityContext ? (
        <>
          {/* Activity-first layout */}
          <div style={{
            fontFamily: FONT.sans, fontSize: 11, fontWeight: 600,
            color: TEXT.primary, lineHeight: 1.25,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
          }}>
            {place.activityContext}
          </div>
          {place.specificTime && (
            <div style={{
              fontFamily: FONT.mono, fontSize: 8, fontWeight: 600,
              color: 'var(--t-dark-teal)', marginTop: 2,
            }}>
              {place.specificTimeLabel
                ? `${place.specificTimeLabel} at ${formatTime12h(place.specificTime)}`
                : formatTime12h(place.specificTime)}
            </div>
          )}
          <div className="flex items-center gap-1" style={{ marginTop: 2 }}>
            <span style={{ fontFamily: FONT.sans, fontSize: 9, color: TEXT.secondary }}>
              at {place.name}
            </span>
          </div>
        </>
      ) : (
        <>
          {/* Standard: venue name primary */}
          <div className="flex items-center gap-1">
            <PerriandIcon name={typeIcon} size={9} color={brandColor} />
            <span style={{
              fontFamily: FONT.sans, fontSize: 11, fontWeight: 600,
              color: TEXT.primary, lineHeight: 1.25,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {place.name}
            </span>
          </div>
          {place.specificTime && (
            <div style={{
              fontFamily: FONT.mono, fontSize: 8, fontWeight: 600,
              color: 'var(--t-dark-teal)', marginTop: 2,
            }}>
              {place.specificTimeLabel
                ? `${place.specificTimeLabel} at ${formatTime12h(place.specificTime)}`
                : formatTime12h(place.specificTime)}
            </div>
          )}
          {place.userContext && (
            <div style={{
              fontFamily: FONT.sans, fontSize: 9, color: TEXT.secondary,
              fontStyle: 'italic', marginTop: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {place.userContext}
            </div>
          )}
        </>
      )}
      {/* Subtle type + match tier row */}
      <div className="flex items-center gap-1" style={{ marginTop: 2 }}>
        <span style={{
          fontFamily: FONT.mono, fontSize: 8, color: INK['40'],
          textTransform: 'uppercase',
        }}>
          {place.type}
        </span>
        {shouldShowTierBadge(place.matchScore) && (() => {
          const tier = getMatchTier(place.matchScore);
          return (
            <span style={{
              fontFamily: FONT.mono, fontSize: 8, fontWeight: 700,
              color: tier.color,
            }}>
              {tier.shortLabel}
            </span>
          );
        })()}
      </div>
    </div>
  );
}

/** Compact read-only quick entry for grid cell */
function GridCellQuickEntry({ entry }: { entry: { label?: string; text: string; category: string; specificTime?: string; specificTimeLabel?: string } }) {
  return (
    <div
      className="flex items-start gap-1.5"
      style={{
        padding: '4px 8px',
        borderRadius: 8,
        background: INK['04'],
        marginBottom: 4,
      }}
    >
      <PerriandIcon name={QUICK_ENTRY_CATEGORY_ICONS[entry.category as keyof typeof QUICK_ENTRY_CATEGORY_ICONS] || 'pin'} size={9} color={INK['30']} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontFamily: FONT.sans, fontSize: 10,
          color: TEXT.primary, lineHeight: 1.3,
        }}>
          {entry.label || entry.text}
        </span>
        {entry.specificTime && (
          <div style={{
            fontFamily: FONT.mono, fontSize: 8,
            color: TEXT.secondary, marginTop: 1,
          }}>
            {entry.specificTimeLabel
              ? `${entry.specificTimeLabel} at ${formatTime12h(entry.specificTime)}`
              : formatTime12h(entry.specificTime)}
          </div>
        )}
      </div>
    </div>
  );
}

function ItineraryView({
  trip, days, destinations,
}: {
  trip: SharedTripProps['trip'];
  days: TripDay[];
  destinations: string[];
}) {
  if (days.length === 0) {
    return (
      <div className="text-center py-16">
        <PerriandIcon name="calendar" size={28} color={INK['20']} />
        <p className="mt-3" style={{ fontFamily: FONT.serif, fontSize: 16, fontStyle: 'italic', color: TEXT.secondary }}>
          No itinerary yet
        </p>
      </div>
    );
  }

  const dayCount = days.length;
  const minColW = 180;

  // Filter to only slots that have content across ANY day
  const activeSlots = GRID_SLOT_ORDER.filter(slotId =>
    days.some(day => {
      const slot = day.slots.find(s => s.id === slotId);
      return slot && (slot.places.length > 0 || (slot.quickEntries && slot.quickEntries.length > 0));
    })
  );

  // If no active slots at all, show all standard slots
  const displaySlots = activeSlots.length > 0 ? activeSlots : GRID_SLOT_ORDER;

  return (
    <div style={{ padding: '16px 12px 120px' }}>
      {/* Scrollable grid wrapper */}
      <div style={{
        overflowX: 'auto',
        borderRadius: 16,
        border: '1px solid var(--t-linen)',
        background: 'white',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `56px repeat(${dayCount}, minmax(${minColW}px, 1fr))`,
          minWidth: dayCount > 3 ? dayCount * minColW + 56 : undefined,
        }}>

          {/* ─── Row 0: Header row ─── */}
          {/* Corner cell */}
          <div style={{
            position: 'sticky', left: 0, zIndex: 10,
            background: 'white',
            borderRight: '1px solid var(--t-linen)',
            borderBottom: '2px solid var(--t-linen)',
          }} />

          {/* Day column headers */}
          {days.map((day) => {
            const dest = day.destination || trip.location;
            const destColor = generateDestColor(dest);
            return (
              <div
                key={`hdr-${day.dayNumber}`}
                style={{
                  padding: '12px 10px 10px',
                  background: destColor.bg,
                  borderBottom: `2px solid ${destColor.accent}40`,
                  borderRight: '1px solid var(--t-linen)',
                }}
              >
                <div style={{
                  fontFamily: FONT.sans, fontSize: 13, fontWeight: 700,
                  color: destColor.text, lineHeight: 1.2,
                }}>
                  {day.dayOfWeek && day.date
                    ? `${day.dayOfWeek?.slice(0, 3)} ${day.date?.replace(/\D/g, ' ').trim().split(' ').pop()}`
                    : `Day ${day.dayNumber}`}
                </div>
                <div className="flex items-center gap-1.5" style={{ marginTop: 3 }}>
                  {day.destination && (
                    <span style={{
                      fontFamily: FONT.sans, fontSize: 10, fontWeight: 500,
                      color: destColor.accent,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {day.destination}
                    </span>
                  )}
                </div>
                {(day.hotelInfo?.name || day.hotel) && (
                  <div className="flex items-center gap-1" style={{ marginTop: 3 }}>
                    <PerriandIcon name="hotel" size={8} color={destColor.text} />
                    <span style={{
                      fontFamily: FONT.sans, fontSize: 9, fontWeight: 500,
                      color: destColor.text, opacity: 0.7,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {day.hotelInfo?.name || day.hotel}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {/* ─── Slot rows ─── */}
          {displaySlots.map((slotId) => {
            const meta = GRID_SLOT_META[slotId] || { label: slotId, time: '', icon: 'pin' };
            return (
              <React.Fragment key={slotId}>
                {/* Row label (sticky left) */}
                <div style={{
                  position: 'sticky', left: 0, zIndex: 5,
                  background: 'white',
                  borderRight: '1px solid var(--t-linen)',
                  borderBottom: '1px solid var(--t-linen)',
                  padding: '8px 4px',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'flex-start',
                }}>
                  <PerriandIcon name={meta.icon as import('@/components/icons/PerriandIcons').PerriandIconName} size={12} color={INK['30']} />
                  <span style={{
                    fontFamily: FONT.mono, fontSize: 7, fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: INK['40'], marginTop: 3, textAlign: 'center',
                    lineHeight: 1.2,
                  }}>
                    {meta.label}
                  </span>
                  <span style={{
                    fontFamily: FONT.mono, fontSize: 7,
                    color: INK['20'], marginTop: 1,
                  }}>
                    {meta.time}
                  </span>
                </div>

                {/* Day cells for this slot */}
                {days.map((day) => {
                  const slot = day.slots.find(s => s.id === slotId);
                  const places = slot?.places || [];
                  const quickEntries = slot?.quickEntries || [];
                  const isEmpty = places.length === 0 && quickEntries.length === 0;

                  return (
                    <div
                      key={`${day.dayNumber}-${slotId}`}
                      style={{
                        padding: '6px 6px',
                        borderBottom: '1px solid var(--t-linen)',
                        borderRight: '1px solid var(--t-linen)',
                        minHeight: 60,
                        background: isEmpty ? 'transparent' : 'transparent',
                      }}
                    >
                      {places.map(place => (
                        <GridCellCard key={place.id} place={place} />
                      ))}
                      {quickEntries.map(entry => (
                        <GridCellQuickEntry key={entry.id} entry={entry} />
                      ))}
                      {isEmpty && (
                        <div style={{
                          height: '100%', minHeight: 48,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{
                            fontFamily: FONT.mono, fontSize: 8,
                            color: INK['15'],
                          }}>
                            —
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}

          {/* ─── Transport row (if any day has transport) ─── */}
          {days.some(d => d.transport && d.transport.length > 0) && (
            <>
              <div style={{
                position: 'sticky', left: 0, zIndex: 5,
                background: 'white',
                borderRight: '1px solid var(--t-linen)',
                padding: '8px 4px',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'flex-start',
              }}>
                <PerriandIcon name="discover" size={12} color={INK['30']} />
                <span style={{
                  fontFamily: FONT.mono, fontSize: 7, fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: INK['40'], marginTop: 3, textAlign: 'center',
                  lineHeight: 1.2,
                }}>
                  Travel
                </span>
              </div>
              {days.map((day) => {
                const transports = day.transport || [];
                return (
                  <div
                    key={`transport-${day.dayNumber}`}
                    style={{
                      padding: '6px 8px',
                      borderRight: '1px solid var(--t-linen)',
                    }}
                  >
                    {transports.map((t, i) => (
                      <div key={i} className="flex items-center gap-1.5" style={{ marginBottom: 2 }}>
                        <span style={{
                          fontFamily: FONT.sans, fontSize: 9, color: TEXT.secondary,
                        }}>
                          {t.mode && `${t.mode.charAt(0).toUpperCase() + t.mode.slice(1)}`}
                          {t.from && t.to ? ` → ${t.to}` : ''}
                          {t.departureTime ? ` at ${t.departureTime}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
//  MAP VIEW
// ═══════════════════════════════════════════════════════════════════

function MapView({
  markers, fallbackDestination, days, destinations, tripLocation,
}: {
  markers: MapMarker[];
  fallbackDestination: string;
  days: TripDay[];
  destinations: string[];
  tripLocation: string;
}) {
  return (
    <div>
      {/* Map */}
      <div style={{ height: 'calc(100dvh - 100px)', position: 'relative' }}>
        <GoogleMapView
          markers={markers}
          height="100%"
          fallbackDestination={fallbackDestination}
        />

        {/* Day legend overlay */}
        {destinations.length > 1 && (
          <div
            style={{
              position: 'absolute', bottom: 20, left: 20, right: 20,
              display: 'flex', flexWrap: 'wrap', gap: 6,
              pointerEvents: 'none',
            }}
          >
            {destinations.map((dest, i) => {
              const dColor = getDestColor(i);
              return (
                <div
                  key={dest}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 20,
                    background: 'rgba(255,255,255,0.92)',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: dColor.accent,
                  }} />
                  <span style={{
                    fontFamily: FONT.sans, fontSize: 11, fontWeight: 500,
                    color: TEXT.primary,
                  }}>
                    {dest}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
//  SHARED SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function SectionHeader({ kicker, title, variant = 'plain' }: { kicker: string; title?: string; variant?: 'plain' | 'editorial' }) {
  const isEditorial = variant === 'editorial';
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontFamily: FONT.mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: isEditorial ? SECTION.editorial.label : SECTION.plain.accent,
        marginBottom: title ? 6 : 0,
      }}>
        {kicker}
      </div>
      {title && (
        <div style={{
          fontFamily: FONT.serif, fontSize: 24, fontStyle: 'italic',
          color: isEditorial ? SECTION.editorial.headline : SECTION.plain.primary,
          lineHeight: 1.25,
        }}>
          {title}
        </div>
      )}
    </div>
  );
}

function StatBlock({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ textAlign: 'center', flex: '1 1 0', minWidth: 0 }}>
      <div style={{
        fontFamily: FONT.serif, fontSize: 36, fontStyle: 'italic',
        color: TEXT.primary, lineHeight: 1, marginBottom: 4,
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: FONT.sans, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: TEXT.secondary,
      }}>
        {label}
      </div>
    </div>
  );
}

function DestinationHero({ name, placeCount }: { name: string; placeCount: number }) {
  const dColor = generateDestColor(name);
  return (
    <div style={{
      height: 280, borderRadius: 20, overflow: 'hidden', position: 'relative',
      background: dColor.bg,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      padding: '28px 28px',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(circle at 70% 30%, ${dColor.accent}10 0%, transparent 60%)`,
      }} />
      <div style={{ position: 'relative' }}>
        <div style={{
          fontFamily: FONT.sans, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: dColor.text, marginBottom: 8,
        }}>
          {placeCount} place{placeCount !== 1 ? 's' : ''} planned
        </div>
        <div style={{
          fontFamily: FONT.serif, fontSize: 44, fontStyle: 'italic',
          color: dColor.text, lineHeight: 1.05, letterSpacing: '-0.01em',
        }}>
          {name}
        </div>
      </div>
    </div>
  );
}


// ─── Read-only Day Card (for overview) ───

function ReadOnlyDayCard({ day, trip }: { day: TripDay; trip: SharedTripProps['trip'] }) {
  const places = day.slots.flatMap(s => s.places.map(p => ({
    place: p,
    time: p.specificTime ? formatTime12h(p.specificTime) : s.time,
  })));
  const quickEntries = day.slots.flatMap(s =>
    (s.quickEntries || []).map(q => ({ entry: q, slotTime: s.time }))
  );
  const hasContent = places.length > 0 || quickEntries.length > 0;

  return (
    <div style={{ padding: '20px 0', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
      {/* Day header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <span style={{
          fontFamily: FONT.serif, fontSize: 32, fontStyle: 'italic',
          color: SECTION.editorial.cardPrimary, lineHeight: 1,
        }}>
          {day.dayNumber}
        </span>
        <div>
          <div style={{
            fontFamily: FONT.sans, fontSize: 13, fontWeight: 600,
            color: SECTION.editorial.headline,
          }}>
            {day.dayOfWeek && day.date
              ? `${day.dayOfWeek}, ${day.date}`
              : `Day ${day.dayNumber}`
            }
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            {day.destination && (
              <span style={{
                fontFamily: FONT.sans, fontSize: 11, fontWeight: 500,
                color: SECTION.editorial.label,
              }}>
                {day.destination}
              </span>
            )}
            {(day.hotelInfo?.name || day.hotel) && (
              <span style={{
                fontFamily: FONT.sans, fontSize: 10, color: SECTION.editorial.body,
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                <PerriandIcon name="hotel" size={10} color={SECTION.editorial.body} />
                {day.hotelInfo?.name || day.hotel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Places + quick entries */}
      {hasContent ? (
        <div style={{ paddingLeft: 44 }}>
          {places.map(({ place, time }) => (
            <div
              key={place.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 0',
              }}
            >
              {time && (
                <span style={{
                  fontFamily: FONT.sans, fontSize: 11, fontWeight: 500,
                  color: SECTION.editorial.body, width: 56, flexShrink: 0,
                }}>
                  {time}
                </span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  fontFamily: FONT.sans, fontSize: 13, fontWeight: 500,
                  color: SECTION.editorial.headline,
                }}>
                  {place.name}
                </span>
                <span style={{
                  fontFamily: FONT.sans, fontSize: 11, color: SECTION.editorial.body,
                  marginLeft: 8,
                }}>
                  {place.location}
                </span>
              </div>
            </div>
          ))}
          {quickEntries.map(({ entry, slotTime }) => (
            <div
              key={entry.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 0',
              }}
            >
              <span style={{
                fontFamily: FONT.sans, fontSize: 11, fontWeight: 500,
                color: SECTION.editorial.body, width: 56, flexShrink: 0,
              }}>
                {entry.specificTime ? formatTime12h(entry.specificTime) : slotTime}
              </span>
              <PerriandIcon name={QUICK_ENTRY_CATEGORY_ICONS[entry.category] || 'pin'} size={12} color={SECTION.editorial.body} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  fontFamily: FONT.sans, fontSize: 13, fontWeight: 500,
                  color: SECTION.editorial.headline,
                }}>
                  {entry.label || entry.text}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          paddingLeft: 44,
          fontFamily: FONT.sans, fontSize: 12,
          color: SECTION.editorial.body, fontStyle: 'italic',
        }}>
          Open day — still dreaming
        </div>
      )}
    </div>
  );
}


// ─── Read-only Place Card (editorial, for featured places) ───

function ReadOnlyPlaceCard({ place }: { place: ImportedPlace }) {
  const photoUrl = place.google?.photoUrl;
  const gradient = placeholderGradient(place.type);
  const typeLabel = TYPE_LABELS[place.type] || place.type;
  const typeIcon = TYPE_ICONS[place.type as PlaceType] || 'pin';
  const brandColor = TYPE_BRAND_COLORS[place.type as PlaceType] || COLOR.navy;

  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden', background: 'white',
      border: '1px solid var(--t-linen)',
    }}>
      {/* Photo / gradient area */}
      <div style={{
        height: 180,
        background: photoUrl ? `url(${photoUrl}) center/cover` : gradient,
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {!photoUrl && (
          <PerriandIcon name={typeIcon} size={40} color={brandColor} />
        )}
        <div style={{
          position: 'absolute', bottom: 12, left: 14,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            fontFamily: FONT.sans, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
            textTransform: 'uppercase',
            padding: '4px 10px', borderRadius: 20,
            background: 'rgba(255,255,255,0.9)',
            color: TEXT.primary,
            backdropFilter: 'blur(8px)',
          }}>
            {typeLabel}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '18px 20px 20px' }}>
        {place.activityContext ? (
          <>
            {/* Activity-first: activity is the headline */}
            <div style={{
              fontFamily: FONT.serif, fontSize: 20, fontStyle: 'italic',
              color: SECTION.plain.primary, marginBottom: 2, lineHeight: 1.25,
            }}>
              {place.activityContext}
            </div>
            {place.specificTime && (
              <div style={{
                fontFamily: FONT.mono, fontSize: 10, fontWeight: 600,
                color: 'var(--t-dark-teal)', marginBottom: 4,
              }}>
                {place.specificTimeLabel ? `${place.specificTimeLabel} at ${formatTime12h(place.specificTime)}` : formatTime12h(place.specificTime)}
              </div>
            )}
            <div style={{
              fontFamily: FONT.sans, fontSize: 12,
              color: SECTION.plain.secondary, marginBottom: 12,
            }}>
              at {place.name} · {place.location}
            </div>
          </>
        ) : (
          <>
            {/* Standard: venue name is the headline */}
            <div style={{
              fontFamily: FONT.serif, fontSize: 20, fontStyle: 'italic',
              color: SECTION.plain.primary, marginBottom: 4, lineHeight: 1.25,
            }}>
              {place.name}
            </div>
            <div style={{
              fontFamily: FONT.sans, fontSize: 12,
              color: SECTION.plain.secondary, marginBottom: 12,
            }}>
              {place.location}
            </div>
          </>
        )}

        {/* Terrazzo insight */}
        {place.terrazzoInsight?.why && (
          <div style={{
            fontFamily: FONT.sans, fontSize: 13, lineHeight: 1.6,
            color: SECTION.plain.secondary, marginBottom: 12,
          }}>
            {place.terrazzoInsight.why}
          </div>
        )}

        {/* What to order */}
        {place.whatToOrder && place.whatToOrder.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{
              fontFamily: FONT.sans, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: TEXT.secondary, marginBottom: 6,
            }}>
              What to order
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {place.whatToOrder.map((item, i) => (
                <span key={i} style={{
                  fontFamily: FONT.sans, fontSize: 12, color: TEXT.primary,
                  padding: '4px 10px', borderRadius: 8, background: 'var(--t-cream)',
                }}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        {place.tips && place.tips.length > 0 && (
          <div>
            <div style={{
              fontFamily: FONT.sans, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: TEXT.secondary, marginBottom: 6,
            }}>
              Tips
            </div>
            {place.tips.map((tip, i) => (
              <div key={i} style={{
                fontFamily: FONT.sans, fontSize: 12, lineHeight: 1.5,
                color: TEXT.primary, marginBottom: 2,
              }}>
                {tip}
              </div>
            ))}
          </div>
        )}

        {/* Caveat */}
        {place.terrazzoInsight?.caveat && (
          <div style={{
            marginTop: 12, padding: '10px 12px', borderRadius: 10,
            background: 'rgba(238,113,109,0.06)',
            fontFamily: FONT.sans, fontSize: 11, lineHeight: 1.5,
            color: COLOR.coral,
          }}>
            {place.terrazzoInsight.caveat}
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Itinerary Place Card (compact, for slot view) ───

function ItineraryPlaceCard({ place }: { place: ImportedPlace }) {
  const typeIcon = TYPE_ICONS[place.type as PlaceType] || 'location';
  const brandColor = TYPE_BRAND_COLORS[place.type as PlaceType] || INK['70'];
  const thumbGrad = THUMB_GRADIENTS[place.type as PlaceType] || THUMB_GRADIENTS.restaurant;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const google = place.google || (place as any).googleData;
  const photoUrl = google?.photoUrl as string | undefined;
  const rating = google?.rating as number | undefined;
  const priceLevel = google?.priceLevel as number | undefined;
  const priceStr = priceLevel ? '$'.repeat(priceLevel) : null;
  const description = place.enrichment?.description || place.terrazzoInsight?.why || '';
  const truncDesc = description.length > 100 ? description.slice(0, 97) + '…' : description;
  const displayLoc = getDisplayLocation(place.location, place.name);

  return (
    <div
      className="rounded-xl overflow-hidden mb-2"
      style={{ background: INK['02'], border: '1px solid var(--t-linen)' }}
    >
      <div className="flex gap-3 p-3">
        {/* Thumbnail */}
        <div
          className="rounded-lg flex-shrink-0 overflow-hidden"
          style={{
            width: 52, height: 52,
            background: photoUrl ? `url(${photoUrl}) center/cover` : thumbGrad,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {!photoUrl && (
            <PerriandIcon name={typeIcon} size={18} color={brandColor} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {place.activityContext ? (
                <>
                  {/* Activity-first: activity title is primary */}
                  <div style={{
                    fontFamily: FONT.sans, fontSize: 14, fontWeight: 600,
                    color: TEXT.primary, lineHeight: 1.3,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {place.activityContext}
                  </div>
                  <div style={{
                    fontFamily: FONT.sans, fontSize: 11,
                    color: TEXT.secondary, marginTop: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    at {place.name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span style={{ fontFamily: FONT.sans, fontSize: 10, color: INK['50'] }}>
                      {TYPE_LABELS[place.type] || place.type}
                    </span>
                    {rating && (
                      <span style={{
                        fontFamily: FONT.mono, fontSize: 9, color: TEXT.secondary,
                        display: 'flex', alignItems: 'center', gap: 2,
                      }}>
                        <PerriandIcon name="star" size={9} color={TEXT.secondary} /> {rating}
                      </span>
                    )}
                    {shouldShowTierBadge(place.matchScore) && (() => {
                      const tier = getMatchTier(place.matchScore);
                      return (
                        <span style={{ fontFamily: FONT.mono, fontSize: 9, fontWeight: 600, color: tier.color }}>
                          {tier.shortLabel}
                        </span>
                      );
                    })()}
                  </div>
                </>
              ) : (
                <>
                  {/* Standard: venue name is primary */}
                  <div style={{
                    fontFamily: FONT.sans, fontSize: 13, fontWeight: 600,
                    color: TEXT.primary,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {place.name}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span style={{ fontFamily: FONT.sans, fontSize: 10, color: INK['50'] }}>
                      {TYPE_LABELS[place.type] || place.type}
                    </span>
                    {displayLoc && (
                      <span style={{ fontSize: 10, color: INK['50'] }}>· {displayLoc}</span>
                    )}
                    {rating && (
                      <span style={{
                        fontFamily: FONT.mono, fontSize: 9, color: TEXT.secondary,
                        display: 'flex', alignItems: 'center', gap: 2,
                      }}>
                        <PerriandIcon name="star" size={9} color={TEXT.secondary} /> {rating}
                      </span>
                    )}
                    {priceStr && (
                      <span style={{ fontFamily: FONT.mono, fontSize: 9, color: TEXT.secondary }}>
                        {priceStr}
                      </span>
                    )}
                    {shouldShowTierBadge(place.matchScore) && (() => {
                      const tier = getMatchTier(place.matchScore);
                      return (
                        <span style={{ fontFamily: FONT.mono, fontSize: 9, fontWeight: 600, color: tier.color }}>
                          {tier.shortLabel}
                        </span>
                      );
                    })()}
                  </div>
                </>
              )}
            </div>

            {/* Specific time badge */}
            {place.specificTime && (
              <div style={{
                fontFamily: FONT.mono, fontSize: 9, fontWeight: 600,
                color: 'var(--t-dark-teal)',
                padding: '3px 8px', borderRadius: 8,
                background: 'rgba(58,128,136,0.08)',
                flexShrink: 0,
              }}>
                {place.specificTimeLabel ? `${place.specificTimeLabel} ${formatTime12h(place.specificTime)}` : formatTime12h(place.specificTime)}
              </div>
            )}
          </div>

          {truncDesc && (
            <div style={{
              fontFamily: FONT.sans, fontSize: 11, color: TEXT.secondary,
              fontStyle: 'italic', lineHeight: 1.4, marginTop: 4,
            }}>
              {truncDesc}
            </div>
          )}

          {/* What to order tags */}
          {place.whatToOrder && place.whatToOrder.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {place.whatToOrder.slice(0, 3).map((item, i) => (
                <span
                  key={i}
                  style={{
                    fontFamily: FONT.mono, fontSize: 9,
                    padding: '2px 6px', borderRadius: 4,
                    background: 'rgba(232,112,128,0.06)',
                    color: 'var(--t-royere-pink)',
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

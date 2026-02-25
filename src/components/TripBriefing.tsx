'use client';

import React, { useMemo } from 'react';
import {
  Trip, ImportedPlace, TasteDomain,
  DOMAIN_COLORS, SOURCE_STYLES,
  GhostSourceType, DEST_COLORS, T,
} from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK } from '@/constants/theme';
import { useTripWeather, weatherEmoji, type DestinationWeather } from '@/hooks/useTripWeather';

// ─── Props ───

interface TripBriefingProps {
  trip: Trip;
  onTapDay: (dayNum: number) => void;
  onTapDetail: (item: ImportedPlace) => void;
}

// ─── Helpers ───

function getAllPlaces(trip: Trip): ImportedPlace[] {
  const placed = trip.days.flatMap(d => d.slots.flatMap(s => s.places));
  return [...placed, ...trip.pool];
}

function formatDateLong(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDateShort(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

/** Google Places photo URL from a placeId */
function placePhotoUrl(placeId?: string, maxWidth = 800): string | null {
  if (!placeId) return null;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  // Use Place Photos (New) — proxy through Next route or direct
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${placeId}&key=${key}`;
}

// Simple hash for consistent placeholder gradients
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Warm editorial gradient based on a name — used when no photo available
const PLACE_GRADIENTS = [
  'linear-gradient(135deg, #e8dcc8 0%, #d4c4a8 100%)',
  'linear-gradient(135deg, #dce4d8 0%, #b8c8a8 100%)',
  'linear-gradient(135deg, #d8dce8 0%, #a8b8c8 100%)',
  'linear-gradient(135deg, #e8d8d4 0%, #c8a8a0 100%)',
  'linear-gradient(135deg, #e8e0d0 0%, #c8b898 100%)',
  'linear-gradient(135deg, #d8e0e4 0%, #a8b8c0 100%)',
];

function placeholderGradient(name: string): string {
  return PLACE_GRADIENTS[hashString(name) % PLACE_GRADIENTS.length];
}

// Place type labels for editorial copy
const TYPE_LABELS: Record<string, string> = {
  restaurant: 'Restaurant',
  hotel: 'Hotel',
  bar: 'Bar',
  cafe: 'Café',
  museum: 'Museum',
  activity: 'Activity',
  neighborhood: 'Neighborhood',
  shop: 'Shop',
};

// ─── Data Computation ───

function useBriefingData(trip: Trip) {
  return useMemo(() => {
    const allPlaces = getAllPlaces(trip);
    const totalDays = trip.days.length;
    const destinations = trip.destinations || [trip.location];

    // Group places by destination
    const placesByDest = new Map<string, ImportedPlace[]>();
    trip.days.forEach(d => {
      const dest = d.destination || trip.location;
      const existing = placesByDest.get(dest) || [];
      existing.push(...d.slots.flatMap(s => s.places));
      placesByDest.set(dest, existing);
    });

    // Source breakdown
    const sourceMap: Record<string, number> = {};
    allPlaces.forEach(p => {
      const src = p.ghostSource || 'manual';
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    });

    // Friends
    const friendMap = new Map<string, { name: string; count: number; places: string[]; note?: string }>();
    allPlaces.forEach(p => {
      if (p.friendAttribution?.name) {
        const f = friendMap.get(p.friendAttribution.name) || {
          name: p.friendAttribution.name, count: 0, places: [],
        };
        f.count += 1;
        f.places.push(p.name);
        if (p.friendAttribution.note) f.note = p.friendAttribution.note;
        friendMap.set(p.friendAttribution.name, f);
      }
    });
    const friends = Array.from(friendMap.values()).sort((a, b) => b.count - a.count);

    // Featured places — ones with the best editorial content (insights, tips, what to order)
    const featured = [...allPlaces]
      .filter(p => p.terrazzoInsight?.why || (p.whatToOrder && p.whatToOrder.length > 0) || p.tips?.length)
      .sort((a, b) => {
        // Prefer places with more editorial richness
        const scoreA = (a.terrazzoInsight?.why ? 2 : 0) + (a.whatToOrder?.length ? 1 : 0) + (a.tips?.length ? 1 : 0);
        const scoreB = (b.terrazzoInsight?.why ? 2 : 0) + (b.whatToOrder?.length ? 1 : 0) + (b.tips?.length ? 1 : 0);
        return scoreB - scoreA;
      })
      .slice(0, 6);

    // Hotels
    const hotels = trip.days
      .filter(d => d.hotelInfo?.name || d.hotel)
      .map(d => ({ name: d.hotelInfo?.name || d.hotel || '', destination: d.destination }));
    const uniqueHotels = Array.from(new Set(hotels.map(h => h.name)));

    // Place types breakdown
    const typeMap: Record<string, number> = {};
    allPlaces.forEach(p => { typeMap[p.type] = (typeMap[p.type] || 0) + 1; });

    return {
      allPlaces, totalDays, destinations, placesByDest,
      sourceMap, friends, featured, uniqueHotels, typeMap,
    };
  }, [trip]);
}

// ═══════════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

// ─── Section Header ───

function SectionHeader({ kicker, title }: { kicker: string; title?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontFamily: FONT.sans, fontSize: 10, fontWeight: 600, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: INK['70'],
        marginBottom: title ? 6 : 0,
      }}>
        {kicker}
      </div>
      {title && (
        <div style={{
          fontFamily: FONT.serif, fontSize: 24, fontStyle: 'italic',
          color: 'var(--t-ink)', lineHeight: 1.25,
        }}>
          {title}
        </div>
      )}
    </div>
  );
}

// ─── Large Place Card (editorial, with photo area) ───

function PlaceCard({ place, onTap }: { place: ImportedPlace; onTap: () => void }) {
  const photoUrl = place.google?.photoUrl;
  const gradient = placeholderGradient(place.name);
  const typeLabel = TYPE_LABELS[place.type] || place.type;
  const srcStyle = SOURCE_STYLES[place.ghostSource as GhostSourceType] || SOURCE_STYLES.manual;

  return (
    <div
      onClick={onTap}
      className="card-hover"
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        background: 'white',
        border: '1px solid var(--t-linen)',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
      }}
    >
      {/* Photo / gradient area */}
      <div style={{
        height: 180,
        background: photoUrl ? `url(${photoUrl}) center/cover` : gradient,
        position: 'relative',
      }}>
        {/* Type badge */}
        <div style={{
          position: 'absolute', bottom: 12, left: 14,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            fontFamily: FONT.sans, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
            textTransform: 'uppercase',
            padding: '4px 10px', borderRadius: 20,
            background: 'rgba(255,255,255,0.9)',
            color: INK['80'],
            backdropFilter: 'blur(8px)',
          }}>
            {typeLabel}
          </span>
          {place.ghostSource && place.ghostSource !== 'manual' && (
            <span style={{
              fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
              padding: '4px 10px', borderRadius: 20,
              background: 'rgba(255,255,255,0.9)',
              color: srcStyle.color,
              backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <PerriandIcon name={srcStyle.icon} size={10} color={srcStyle.color} />
              {srcStyle.label}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '18px 20px 20px' }}>
        <div style={{
          fontFamily: FONT.serif, fontSize: 20, fontStyle: 'italic',
          color: 'var(--t-ink)', marginBottom: 4, lineHeight: 1.25,
        }}>
          {place.name}
        </div>
        <div style={{
          fontFamily: FONT.sans, fontSize: 12,
          color: INK['75'], marginBottom: 12,
        }}>
          {place.location}
        </div>

        {/* Terrazzo insight — the editorial voice */}
        {place.terrazzoInsight?.why && (
          <div style={{
            fontFamily: FONT.sans, fontSize: 13, lineHeight: 1.6,
            color: INK['85'], marginBottom: 12,
          }}>
            {place.terrazzoInsight.why}
          </div>
        )}

        {/* What to order */}
        {place.whatToOrder && place.whatToOrder.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{
              fontFamily: FONT.sans, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: INK['70'],
              marginBottom: 6,
            }}>
              What to order
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {place.whatToOrder.map((item, i) => (
                <span key={i} style={{
                  fontFamily: FONT.sans, fontSize: 12,
                  color: INK['80'],
                  padding: '4px 10px', borderRadius: 8,
                  background: 'var(--t-cream)',
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
              textTransform: 'uppercase', color: INK['70'],
              marginBottom: 6,
            }}>
              Tips
            </div>
            {place.tips.map((tip, i) => (
              <div key={i} style={{
                fontFamily: FONT.sans, fontSize: 12, lineHeight: 1.5,
                color: INK['85'], marginBottom: 2,
              }}>
                {tip}
              </div>
            ))}
          </div>
        )}

        {/* Friend attribution */}
        {place.friendAttribution && (
          <div style={{
            marginTop: 12, paddingTop: 12,
            borderTop: '1px solid var(--t-linen)',
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'rgba(42,122,86,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: FONT.sans, fontSize: 11, fontWeight: 600,
              color: T.verde, flexShrink: 0,
            }}>
              {place.friendAttribution.name.charAt(0)}
            </div>
            <div>
              <span style={{
                fontFamily: FONT.sans, fontSize: 11, fontWeight: 600,
                color: INK['80'],
              }}>
                {place.friendAttribution.name}
              </span>
              {place.friendAttribution.note && (
                <div style={{
                  fontFamily: FONT.sans, fontSize: 12, fontStyle: 'italic',
                  color: INK['75'], marginTop: 2, lineHeight: 1.5,
                }}>
                  &ldquo;{place.friendAttribution.note}&rdquo;
                </div>
              )}
            </div>
          </div>
        )}

        {/* Caveat */}
        {place.terrazzoInsight?.caveat && (
          <div style={{
            marginTop: 12, padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(200,146,58,0.06)',
            fontFamily: FONT.sans, fontSize: 11, lineHeight: 1.5,
            color: T.amber,
          }}>
            {place.terrazzoInsight.caveat}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Compact place row (for day timeline) ───

function PlaceRow({ place, onTap, time }: { place: ImportedPlace; onTap: () => void; time?: string }) {
  return (
    <div
      onClick={onTap}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 0', cursor: 'pointer',
      }}
    >
      {/* Time */}
      {time && (
        <span style={{
          fontFamily: FONT.sans, fontSize: 11, fontWeight: 500, color: INK['75'],
          width: 56, flexShrink: 0,
        }}>
          {time}
        </span>
      )}
      {/* Place info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontFamily: FONT.sans, fontSize: 13, fontWeight: 500,
          color: 'var(--t-ink)',
        }}>
          {place.name}
        </span>
        <span style={{
          fontFamily: FONT.sans, fontSize: 11, color: INK['75'],
          marginLeft: 8,
        }}>
          {place.location}
        </span>
      </div>
      {/* Source indicator */}
      {place.ghostSource && place.ghostSource !== 'manual' && (
        <span style={{
          fontFamily: FONT.sans, fontSize: 10, fontWeight: 600, color: INK['70'],
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {SOURCE_STYLES[place.ghostSource]?.label}
        </span>
      )}
    </div>
  );
}

// ─── Day Card ───

function DayCard({
  day, trip, onTapDay, onTapDetail,
}: {
  day: Trip['days'][0]; trip: Trip;
  onTapDay: (n: number) => void;
  onTapDetail: (item: ImportedPlace) => void;
}) {
  const dColor = DEST_COLORS[day.destination || ''] || { bg: '#f5f0e6', accent: '#8a7a6a', text: '#5a4a3a' };
  const places = day.slots.flatMap(s => s.places.map(p => ({ place: p, time: s.time })));

  return (
    <div style={{
      padding: '20px 0',
      borderBottom: '1px solid var(--t-linen)',
    }}>
      {/* Day header */}
      <div
        onClick={() => onTapDay(day.dayNumber)}
        style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12, cursor: 'pointer' }}
      >
        <span style={{
          fontFamily: FONT.serif, fontSize: 32, fontStyle: 'italic',
          color: INK['45'], lineHeight: 1,
        }}>
          {day.dayNumber}
        </span>
        <div>
          <div style={{
            fontFamily: FONT.sans, fontSize: 13, fontWeight: 600,
            color: 'var(--t-ink)',
          }}>
            {trip.flexibleDates
              ? `Day ${day.dayNumber}`
              : `${day.dayOfWeek}${day.date ? `, ${day.date}` : ''}`
            }
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            {day.destination && (
              <span style={{
                fontFamily: FONT.sans, fontSize: 11, fontWeight: 500,
                color: dColor.text,
              }}>
                {day.destination}
              </span>
            )}
            {(day.hotelInfo?.name || day.hotel) && (
              <span style={{
                fontFamily: FONT.sans, fontSize: 10, color: INK['70'],
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                <PerriandIcon name="hotel" size={10} color={INK['60']} />
                {day.hotelInfo?.name || day.hotel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Places */}
      {places.length > 0 ? (
        <div style={{ paddingLeft: 44 }}>
          {places.map(({ place, time }) => (
            <PlaceRow
              key={place.id}
              place={place}
              time={time}
              onTap={() => onTapDetail(place)}
            />
          ))}
        </div>
      ) : (
        <div style={{
          paddingLeft: 44,
          fontFamily: FONT.sans, fontSize: 12,
          color: INK['55'], fontStyle: 'italic',
        }}>
          Open day — still dreaming
        </div>
      )}
    </div>
  );
}

// ─── Stat ───

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 60 }}>
      <div style={{
        fontFamily: FONT.serif, fontSize: 36, fontStyle: 'italic',
        color: 'var(--t-ink)', lineHeight: 1, marginBottom: 4,
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: FONT.sans, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: INK['75'],
      }}>
        {label}
      </div>
    </div>
  );
}

// ─── Weather Forecast Section ───

function WeatherSection({ weather }: { weather: DestinationWeather[] }) {
  if (weather.length === 0) return null;
  const isHistorical = weather.some(w => w.isHistorical);

  return (
    <div style={{
      margin: '0 20px',
      padding: '28px 24px',
      background: 'white',
      borderRadius: 20,
      border: '1px solid var(--t-linen)',
      marginTop: 28,
    }}>
      <SectionHeader
        kicker={isHistorical ? 'Based on Past Years' : 'Weather Forecast'}
        title={isHistorical
          ? 'What to expect'
          : 'What the forecast looks like'
        }
      />

      {isHistorical && (
        <div style={{
          fontFamily: FONT.sans, fontSize: 12, lineHeight: 1.6,
          color: INK['70'], marginBottom: 20, marginTop: -10,
        }}>
          Based on last year&apos;s weather for the same dates — expect similar conditions.
        </div>
      )}

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 24,
      }}>
        {weather.map(dest => {
          const tempF = (c: number) => Math.round(c * 9 / 5 + 32);

          return (
            <div key={dest.destination}>
              {/* Destination label */}
              {weather.length > 1 && (
                <div style={{
                  fontFamily: FONT.sans, fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: INK['70'], marginBottom: 12,
                }}>
                  {dest.destination}
                </div>
              )}

              {/* Summary row */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 20,
                marginBottom: 16, flexWrap: 'wrap',
              }}>
                <div style={{
                  fontFamily: FONT.serif, fontSize: 28, fontStyle: 'italic',
                  color: 'var(--t-ink)', lineHeight: 1,
                }}>
                  {dest.avgLowC}–{dest.avgHighC}°C
                </div>
                <div style={{
                  fontFamily: FONT.sans, fontSize: 12,
                  color: INK['75'],
                }}>
                  ({tempF(dest.avgLowC)}–{tempF(dest.avgHighC)}°F)
                </div>
                <div style={{
                  fontFamily: FONT.sans, fontSize: 12, fontWeight: 500,
                  color: INK['80'],
                  padding: '4px 10px', borderRadius: 8,
                  background: 'var(--t-cream)',
                }}>
                  {dest.dominantCondition}
                  {dest.avgPrecipMm > 1 ? ` · ~${dest.avgPrecipMm}mm rain/day` : ''}
                </div>
              </div>

              {/* Daily weather strip */}
              <div style={{
                display: 'flex', gap: 2,
                overflowX: 'auto',
                paddingBottom: 4,
              }}>
                {dest.days.map(day => {
                  const dayDate = new Date(day.date + 'T12:00:00');
                  const dayLabel = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
                  const dateLabel = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                  return (
                    <div
                      key={day.date}
                      style={{
                        flex: '1 0 52px',
                        maxWidth: 64,
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: 4, padding: '10px 6px',
                        borderRadius: 12,
                        background: 'transparent',
                      }}
                    >
                      <span style={{
                        fontFamily: FONT.sans, fontSize: 10, fontWeight: 600,
                        color: INK['70'], textTransform: 'uppercase',
                      }}>
                        {dayLabel}
                      </span>
                      <span style={{
                        fontFamily: FONT.sans, fontSize: 9,
                        color: INK['55'],
                      }}>
                        {dateLabel}
                      </span>
                      <span style={{ fontSize: 18, lineHeight: 1 }}>
                        {weatherEmoji(day.weatherCode)}
                      </span>
                      <span style={{
                        fontFamily: FONT.sans, fontSize: 11, fontWeight: 500,
                        color: 'var(--t-ink)',
                      }}>
                        {day.tempHighC}°
                      </span>
                      <span style={{
                        fontFamily: FONT.sans, fontSize: 10,
                        color: INK['60'],
                      }}>
                        {day.tempLowC}°
                      </span>
                      {day.precipMm > 1 && (
                        <span style={{
                          fontFamily: FONT.sans, fontSize: 9,
                          color: '#6b8b9a',
                          marginTop: -2,
                        }}>
                          {day.precipMm}mm
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Destination Hero Block ───

function DestinationHero({ name, placeCount }: { name: string; placeCount: number }) {
  const dColor = DEST_COLORS[name] || { bg: '#f0edf5', accent: '#7a5a9a', text: '#5a3a7a' };

  return (
    <div style={{
      height: 280,
      borderRadius: 20,
      overflow: 'hidden',
      position: 'relative',
      background: dColor.bg,
      display: 'flex', flexDirection: 'column',
      justifyContent: 'flex-end',
      padding: '28px 28px',
    }}>
      {/* Subtle pattern overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(circle at 70% 30%, ${dColor.accent}10 0%, transparent 60%)`,
      }} />

      <div style={{ position: 'relative' }}>
        <div style={{
          fontFamily: FONT.sans, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: dColor.text,
          marginBottom: 8,
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

// ═══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

function TripBriefingInner({ trip, onTapDay, onTapDetail }: TripBriefingProps) {
  const data = useBriefingData(trip);
  const { weather: tripWeather, isLoading: weatherLoading } = useTripWeather(trip);

  // Type breakdown string for the summary
  const typeBreakdown = useMemo(() => {
    const entries = Object.entries(data.typeMap).sort((a, b) => b[1] - a[1]);
    return entries
      .slice(0, 3)
      .map(([type, count]) => `${count} ${TYPE_LABELS[type] || type}${count !== 1 ? 's' : ''}`)
      .join(', ');
  }, [data.typeMap]);

  return (
    <div style={{
      background: 'var(--t-cream)',
      minHeight: '100%',
      paddingBottom: 120,
    }}>

      {/* ════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════ */}
      <div style={{ padding: '48px 36px 40px' }}>
        {/* Terrazzo kicker */}
        <div style={{
          fontFamily: FONT.sans, fontSize: 10, fontWeight: 600, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: INK['70'],
          marginBottom: 28,
        }}>
          Terrazzo · Trip Briefing
        </div>

        {/* Trip name */}
        <h1 style={{
          fontFamily: FONT.serif, fontSize: 42, fontStyle: 'italic',
          fontWeight: 400, color: 'var(--t-ink)',
          margin: 0, lineHeight: 1.1, letterSpacing: '-0.015em',
          maxWidth: 560,
        }}>
          {trip.name}
        </h1>

        {/* Date + destination tags */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          marginTop: 16, flexWrap: 'wrap',
        }}>
          <span style={{
            fontFamily: FONT.sans, fontSize: 13,
            color: INK['80'],
          }}>
            {trip.flexibleDates
              ? `${trip.days.length} days · dates flexible`
              : (trip.startDate && trip.endDate
                  ? `${formatDateLong(trip.startDate)} — ${formatDateLong(trip.endDate)}`
                  : ''
                )
            }
          </span>
        </div>

        {/* Brief editorial summary */}
        <div style={{
          fontFamily: FONT.sans, fontSize: 15, lineHeight: 1.65,
          color: INK['85'],
          marginTop: 24, maxWidth: 520,
        }}>
          {data.totalDays} days across {data.destinations.length === 1
            ? data.destinations[0]
            : data.destinations.slice(0, -1).join(', ') + ' and ' + data.destinations[data.destinations.length - 1]
          }. {typeBreakdown} — {data.friends.length > 0
            ? `with recommendations from ${data.friends.map(f => f.name.split(' ')[0]).join(', ')}`
            : 'curated for your taste'
          }.
        </div>
      </div>

      {/* ════════════════════════════════════════════
          AT A GLANCE
      ════════════════════════════════════════════ */}
      <div style={{
        display: 'flex', justifyContent: 'flex-start', gap: 48,
        padding: '32px 36px',
        borderTop: '1px solid var(--t-linen)',
        borderBottom: '1px solid var(--t-linen)',
      }}>
        <Stat value={data.totalDays} label="Days" />
        <Stat value={data.destinations.length} label={data.destinations.length === 1 ? 'City' : 'Cities'} />
        <Stat value={data.allPlaces.length} label="Places" />
        {data.uniqueHotels.length > 0 && (
          <Stat value={data.uniqueHotels.length} label={data.uniqueHotels.length === 1 ? 'Hotel' : 'Hotels'} />
        )}
      </div>

      {/* ════════════════════════════════════════════
          WEATHER FORECAST
      ════════════════════════════════════════════ */}
      {tripWeather.length > 0 && (
        <WeatherSection weather={tripWeather} />
      )}

      {/* ════════════════════════════════════════════
          DESTINATION HEROES
      ════════════════════════════════════════════ */}
      {data.destinations.length > 0 && (
        <div style={{ padding: '40px 36px 0' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: data.destinations.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}>
            {data.destinations.map(dest => {
              const destPlaces = data.placesByDest.get(dest) || [];
              return (
                <DestinationHero
                  key={dest}
                  name={dest}
                  placeCount={destPlaces.length}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          DAY BY DAY — The Itinerary
      ════════════════════════════════════════════ */}
      <div style={{
        margin: '40px 20px 0',
        padding: '36px 24px 12px',
        background: 'white',
        borderRadius: 20,
        border: '1px solid var(--t-linen)',
      }}>
        <SectionHeader
          kicker="Day by Day"
          title="Your itinerary"
        />
        <div>
          {trip.days.map(d => (
            <DayCard
              key={d.dayNumber}
              day={d}
              trip={trip}
              onTapDay={onTapDay}
              onTapDetail={onTapDetail}
            />
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════
          THE PLACES — Editorial Cards
      ════════════════════════════════════════════ */}
      {data.featured.length > 0 && (
        <div style={{ padding: '48px 36px 0' }}>
          <SectionHeader
            kicker="The Places"
            title="What's waiting for you"
          />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 20,
          }}>
            {data.featured.map(p => (
              <PlaceCard
                key={p.id}
                place={p}
                onTap={() => onTapDetail(p)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          YOUR PEOPLE — Friend Recommendations
      ════════════════════════════════════════════ */}
      {data.friends.length > 0 && (
        <div style={{ padding: '48px 36px 0' }}>
          <SectionHeader
            kicker="Your People"
            title={data.friends.length === 1
              ? `${data.friends[0].name.split(' ')[0]} helped shape this trip`
              : `${data.friends.length} friends helped shape this trip`
            }
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.friends.map(f => (
              <div key={f.name} style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '18px 20px',
                borderRadius: 14,
                background: 'white',
                border: '1px solid var(--t-linen)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(42,122,86,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: FONT.serif, fontSize: 16, fontStyle: 'italic',
                  color: T.verde, flexShrink: 0,
                }}>
                  {f.name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: FONT.sans, fontSize: 14, fontWeight: 600,
                    color: 'var(--t-ink)', marginBottom: 4,
                  }}>
                    {f.name}
                  </div>
                  <div style={{
                    fontFamily: FONT.sans, fontSize: 12,
                    color: INK['75'], marginBottom: f.note ? 8 : 0,
                  }}>
                    Recommended {f.places.slice(0, 3).join(', ')}
                    {f.places.length > 3 ? ` and ${f.places.length - 3} more` : ''}
                  </div>
                  {f.note && (
                    <div style={{
                      fontFamily: FONT.sans, fontSize: 13, fontStyle: 'italic',
                      color: INK['80'], lineHeight: 1.55,
                      paddingTop: 8,
                      borderTop: '1px solid var(--t-linen)',
                    }}>
                      &ldquo;{f.note}&rdquo;
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          WHERE IT ALL CAME FROM — Sources
      ════════════════════════════════════════════ */}
      {Object.keys(data.sourceMap).length > 1 && (
        <div style={{ padding: '48px 36px 0' }}>
          <SectionHeader kicker="Sources" />
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8,
          }}>
            {Object.entries(data.sourceMap)
              .sort((a, b) => b[1] - a[1])
              .map(([key, count]) => {
                const style = SOURCE_STYLES[key as GhostSourceType] || SOURCE_STYLES.manual;
                return (
                  <div key={key} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 10,
                    background: 'white',
                    border: '1px solid var(--t-linen)',
                  }}>
                    <PerriandIcon name={style.icon} size={13} color={style.color} />
                    <span style={{
                      fontFamily: FONT.sans, fontSize: 12, fontWeight: 500,
                      color: INK['80'],
                    }}>
                      {count} from {style.label}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════ */}
      <div style={{
        padding: '64px 36px 32px',
        textAlign: 'center',
      }}>
        <div style={{
          width: 40, height: 1,
          background: INK['10'],
          margin: '0 auto 20px',
        }} />
        <div style={{
          fontFamily: FONT.sans, fontSize: 10, fontWeight: 600, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: INK['55'],
          marginBottom: 6,
        }}>
          Terrazzo
        </div>
        <div style={{
          fontFamily: FONT.sans, fontSize: 11,
          color: INK['60'],
        }}>
          Travel that matches your taste
        </div>
      </div>
    </div>
  );
}

const TripBriefing = React.memo(TripBriefingInner);
TripBriefing.displayName = 'TripBriefing';
export default TripBriefing;

'use client';

import React, { useMemo } from 'react';
import {
  Trip, GhostSourceType,
  SOURCE_STYLES,
} from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, INK, TEXT, COLOR, SECTION } from '@/constants/theme';
import { useTripWeather } from '@/hooks/useTripWeather';
import {
  SectionHeader, PlaceCard, DayCard, Stat, WeatherSection, DestinationHero,
} from '../trip-briefing/sections';
import { useBriefingData } from '../trip-briefing/useBriefingData';
import { formatDateLong, TYPE_LABELS } from '../trip-briefing/helpers';
import { usePlaceDetail } from '@/context/PlaceDetailContext';

// ─── Props ───

interface TripBriefingProps {
  trip: Trip;
  onTapDay: (dayNum: number) => void;
}

// ═══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

function TripBriefingInner({ trip, onTapDay }: TripBriefingProps) {
  const { openDetail: onTapDetail } = usePlaceDetail();
  const data = useBriefingData(trip);
  const { weather: tripWeather } = useTripWeather(trip);

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
      overflowX: 'hidden',
    }}>

      {/* ════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════ */}
      <div style={{ padding: '48px 24px 40px' }}>
        {/* Terrazzo kicker */}
        <div style={{
          fontFamily: FONT.mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
          textTransform: 'uppercase', color: SECTION.plain.accent,
          marginBottom: 28,
        }}>
          Terrazzo · Trip Briefing
        </div>

        {/* Trip name */}
        <h1 style={{
          fontFamily: FONT.serif, fontSize: 42, fontStyle: 'italic',
          fontWeight: 400, color: SECTION.plain.primary,
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
            color: TEXT.primary,
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
          color: TEXT.primary,
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
        display: 'flex', justifyContent: 'space-evenly', gap: 16,
        padding: '32px 20px',
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
        <div style={{ padding: '40px 24px 0' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: data.destinations.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
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
        background: SECTION.editorial.bg,
        borderRadius: 20,
      }}>
        <SectionHeader
          kicker="Day by Day"
          title="Your itinerary"
          variant="editorial"
        />
        <div>
          {trip.days.map(d => (
            <DayCard
              key={d.dayNumber}
              day={d}
              trip={trip}
              onTapDay={onTapDay}
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
                background: SECTION.plain.cardBg,
                border: SECTION.plain.cardBorder,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(58,128,136,0.10)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: FONT.serif, fontSize: 16, fontStyle: 'italic',
                  color: COLOR.darkTeal, flexShrink: 0,
                }}>
                  {f.name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: FONT.sans, fontSize: 14, fontWeight: 600,
                    color: TEXT.primary, marginBottom: 4,
                  }}>
                    {f.name}
                  </div>
                  <div style={{
                    fontFamily: FONT.sans, fontSize: 12,
                    color: TEXT.primary, marginBottom: f.note ? 8 : 0,
                  }}>
                    Recommended {f.places.slice(0, 3).join(', ')}
                    {f.places.length > 3 ? ` and ${f.places.length - 3} more` : ''}
                  </div>
                  {f.note && (
                    <div style={{
                      fontFamily: FONT.sans, fontSize: 13, fontStyle: 'italic',
                      color: TEXT.primary, lineHeight: 1.55,
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
                    background: SECTION.plain.cardBg,
                    border: SECTION.plain.cardBorder,
                  }}>
                    <PerriandIcon name={style.icon} size={13} color={style.color} />
                    <span style={{
                      fontFamily: FONT.sans, fontSize: 12, fontWeight: 500,
                      color: TEXT.primary,
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
        <div style={{ marginBottom: 6 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-pixellance-navy.svg"
            alt="Terrazzo"
            style={{ height: 14, width: 'auto', opacity: 0.5 }}
          />
        </div>
        <div style={{
          fontFamily: FONT.sans, fontSize: 11,
          color: TEXT.secondary,
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

'use client';

import React from 'react';
import {
  Trip, ImportedPlace, QuickEntry,
  getSourceStyle, QUICK_ENTRY_CATEGORY_ICONS,
} from '@/types';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { FONT, TEXT, COLOR, SECTION } from '@/constants/theme';
import { weatherEmoji, type DestinationWeather } from '@/hooks/useTripWeather';
import { generateDestColor } from '@/lib/destination-helpers';
import { TYPE_BRAND_COLORS, TYPE_ICONS } from '@/constants/placeTypes';
import { placeholderGradient, TYPE_LABELS } from './helpers';
import { formatTime12h } from '@/components/place/PlaceTimeEditor';
import { usePlaceDetail } from '@/context/PlaceDetailContext';

// ─── Section Header ───

export function SectionHeader({ kicker, title, variant = 'plain' }: { kicker: string; title?: string; variant?: 'plain' | 'editorial' }) {
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

// ─── Large Place Card (editorial, with photo area) ───

export function PlaceCard({ place, onTap }: { place: ImportedPlace; onTap: () => void }) {
  const photoUrl = place.google?.photoUrl;
  const gradient = placeholderGradient(place.type);
  const typeLabel = TYPE_LABELS[place.type] || place.type;
  const typeIcon = TYPE_ICONS[place.type as keyof typeof TYPE_ICONS] || 'pin';
  const brandColor = TYPE_BRAND_COLORS[place.type as keyof typeof TYPE_BRAND_COLORS] || COLOR.navy;
  const srcStyle = getSourceStyle(place);

  return (
    <div
      onClick={onTap}
      className="card-hover"
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        background: 'white',
        border: '1px solid var(--t-navy)',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
      }}
    >
      {/* Photo / gradient area */}
      <div style={{
        height: 180,
        background: photoUrl ? `url(${photoUrl}) center/cover` : gradient,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Centered type icon when no photo */}
        {!photoUrl && (
          <PerriandIcon name={typeIcon} size={40} color={brandColor} />
        )}
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
            color: TEXT.primary,
            backdropFilter: 'blur(8px)',
          }}>
            {typeLabel}
          </span>
          {place.source?.type && place.source.type !== 'manual' && place.source.type !== 'text' && (
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
          color: SECTION.plain.primary, marginBottom: 4, lineHeight: 1.25,
        }}>
          {place.name}
        </div>
        <div style={{
          fontFamily: FONT.sans, fontSize: 12,
          color: SECTION.plain.secondary,
        }}>
          {place.location}
        </div>
      </div>
    </div>
  );
}

// ─── Compact place row (for day timeline) ───

export function PlaceRow({ place, onTap, time }: { place: ImportedPlace; onTap: () => void; time?: string }) {
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
          fontFamily: FONT.sans, fontSize: 11, fontWeight: 500, color: SECTION.editorial.body,
          width: 56, flexShrink: 0,
        }}>
          {time}
        </span>
      )}
      {/* Place info */}
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
  );
}

// ─── Quick entry row (for day timeline) ───

function QuickEntryRow({ entry, slotTime }: { entry: QuickEntry; slotTime: string }) {
  const time = entry.specificTime ? formatTime12h(entry.specificTime) : slotTime;
  const icon = QUICK_ENTRY_CATEGORY_ICONS[entry.category] || 'pin';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 0',
    }}>
      {time && (
        <span style={{
          fontFamily: FONT.sans, fontSize: 11, fontWeight: 500, color: SECTION.editorial.body,
          width: 56, flexShrink: 0,
        }}>
          {time}
        </span>
      )}
      <PerriandIcon name={icon} size={12} color={SECTION.editorial.body} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontFamily: FONT.sans, fontSize: 13, fontWeight: 500,
          color: SECTION.editorial.headline,
        }}>
          {entry.label || entry.text}
        </span>
      </div>
    </div>
  );
}

// ─── Day Card ───

export function DayCard({
  day, trip, onTapDay,
}: {
  day: Trip['days'][0]; trip: Trip;
  onTapDay: (n: number) => void;
}) {
  const { openDetail: onTapDetail } = usePlaceDetail();
  const places = day.slots.flatMap(s => s.places.map(p => ({
    place: p,
    time: p.specificTime ? formatTime12h(p.specificTime) : s.time,
  })));
  const quickEntries = day.slots.flatMap(s =>
    (s.quickEntries || []).map(q => ({ entry: q, slotTime: s.time }))
  );
  const hasContent = places.length > 0 || quickEntries.length > 0;

  return (
    <div style={{
      padding: '20px 0',
      borderBottom: '1px solid rgba(255,255,255,0.12)',
    }}>
      {/* Day header */}
      <div
        onClick={() => onTapDay(day.dayNumber)}
        style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12, cursor: 'pointer' }}
      >
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
            {trip.flexibleDates
              ? `Day ${day.dayNumber}`
              : `${day.dayOfWeek}${day.date ? `, ${day.date}` : ''}`
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
            <PlaceRow
              key={place.id}
              place={place}
              time={time}
              onTap={() => onTapDetail(place)}
            />
          ))}
          {quickEntries.map(({ entry, slotTime }) => (
            <QuickEntryRow
              key={entry.id}
              entry={entry}
              slotTime={slotTime}
            />
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

// ─── Stat ───

export function Stat({ value, label }: { value: string | number; label: string }) {
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

// ─── Weather Forecast Section ───

export function WeatherSection({ weather }: { weather: DestinationWeather[] }) {
  if (weather.length === 0) return null;
  const isHistorical = weather.some(w => w.isHistorical);

  return (
    <div style={{
      margin: '0 20px',
      padding: '28px 24px',
      background: SECTION.plain.cardBg,
      borderRadius: 20,
      border: SECTION.plain.cardBorder,
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
          color: TEXT.secondary, marginBottom: 20, marginTop: -10,
        }}>
          Based on last year&apos;s weather for the same dates — expect similar conditions.
        </div>
      )}

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 24,
      }}>
        {weather.map(dest => {
          return (
            <div key={dest.destination}>
              {/* Destination label */}
              {weather.length > 1 && (
                <div style={{
                  fontFamily: FONT.sans, fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: TEXT.secondary, marginBottom: 12,
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
                  color: TEXT.primary, lineHeight: 1,
                }}>
                  {dest.avgLowF}–{dest.avgHighF}°F
                </div>
                <div style={{
                  fontFamily: FONT.sans, fontSize: 12, fontWeight: 500,
                  color: TEXT.primary,
                  padding: '4px 10px', borderRadius: 8,
                  background: 'var(--t-cream)',
                }}>
                  {dest.dominantCondition}
                  {dest.avgPrecipIn > 0.04 ? ` · ~${dest.avgPrecipIn}in rain/day` : ''}
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
                        color: TEXT.secondary, textTransform: 'uppercase',
                      }}>
                        {dayLabel}
                      </span>
                      <span style={{
                        fontFamily: FONT.sans, fontSize: 9,
                        color: TEXT.secondary,
                      }}>
                        {dateLabel}
                      </span>
                      <span style={{ fontSize: 18, lineHeight: 1 }}>
                        {weatherEmoji(day.weatherCode)}
                      </span>
                      <span style={{
                        fontFamily: FONT.sans, fontSize: 11, fontWeight: 500,
                        color: TEXT.primary,
                      }}>
                        {day.tempHighF}°
                      </span>
                      <span style={{
                        fontFamily: FONT.sans, fontSize: 10,
                        color: TEXT.secondary,
                      }}>
                        {day.tempLowF}°
                      </span>
                      {day.precipIn > 0.04 && (
                        <span style={{
                          fontFamily: FONT.sans, fontSize: 9,
                          color: COLOR.darkTeal,
                          marginTop: -2,
                        }}>
                          {day.precipIn}in
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

export function DestinationHero({ name, placeCount }: { name: string; placeCount: number }) {
  const dColor = generateDestColor(name);

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

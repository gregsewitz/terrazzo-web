'use client';

/**
 * Detail and ghost card components for TripMapView.
 *
 * Both mobile (Apple Maps style) and desktop (floating overlay) variants.
 * Extracted from TripMapView.tsx for readability.
 */

import React from 'react';
import { FONT, TEXT, INK } from '@/constants/theme';
import { SOURCE_STYLES, GhostSourceType, ImportedPlace } from '@/types';
import { TYPE_ICONS } from '@/constants/placeTypes';
import { generateDestColor } from '@/lib/destination-helpers';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { getDisplayLocation } from '@/lib/place-display';

// ─── Shared types ────────────────────────────────────────────────────────────

export interface PlacedItem {
  place: ImportedPlace;
  slotLabel: string;
  slotTime: string;
  slotId: string;
  dayNumber: number;
  dayOfWeek?: string;
  date?: string;
  destination?: string;
  orderIndex: number;
}

export type GhostTier = 'library' | 'contextual' | 'discovery';

export interface GhostItem {
  place: ImportedPlace;
  dayNumber: number;
  slotId: string;
  destination?: string;
  tier: GhostTier;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getDestColor = generateDestColor;


// ═══════════════════════════════════════════════════════════════════════════
//  MOBILE DETAIL CARD — Apple Maps inspired
// ═══════════════════════════════════════════════════════════════════════════

export function MobileDetailCard({
  item, index, showDirections, onViewDetail, onDismiss, onDirections,
}: {
  item: PlacedItem;
  index?: number;
  showDirections: boolean;
  onViewDetail: () => void;
  onDismiss: () => void;
  onDirections: () => void;
}) {
  const { place } = item;
  const typeIcon = TYPE_ICONS[place.type] || 'pin';
  const destColor = getDestColor(item.destination || '');

  return (
    <div
      className="rounded-2xl overflow-hidden"
      onClick={onViewDetail}
      style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        border: '1px solid rgba(255,255,255,0.7)',
        cursor: 'pointer',
      }}
    >
      {/* Swipe handle */}
      <div className="flex justify-center pt-2 pb-1" onClick={(e) => { e.stopPropagation(); onDismiss(); }} style={{ cursor: 'pointer' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: INK['15'] }} />
      </div>

      <div className="px-4 pb-3">
        {/* Name row */}
        <div className="flex items-center gap-3 mb-2">
          {index != null ? (
            <div
              className="flex items-center justify-center rounded-full flex-shrink-0"
              style={{
                width: 36, height: 36,
                background: destColor.accent, color: 'white',
                fontFamily: FONT.mono, fontSize: 14, fontWeight: 700,
                boxShadow: `0 2px 8px ${destColor.accent}40`,
              }}
            >
              {index}
            </div>
          ) : (
            <div
              className="flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ width: 40, height: 40, background: `${destColor.accent}10` }}
            >
              <PerriandIcon name={typeIcon} size={20} color={destColor.accent} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div
              style={{
                fontFamily: FONT.serif, fontSize: 17, fontWeight: 600,
                color: 'var(--t-ink)', lineHeight: 1.2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {place.name}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span style={{ fontFamily: FONT.sans, fontSize: 11, color: TEXT.secondary }}>
                {place.type.charAt(0).toUpperCase() + place.type.slice(1)}
              </span>
              {(() => { const dl = getDisplayLocation(place.location, place.name, place.google?.address); return dl ? <><span style={{ color: INK['20'] }}>·</span><span style={{ fontFamily: FONT.sans, fontSize: 11, color: TEXT.secondary }}>{dl}</span></> : null; })()}
            </div>
          </div>
          {place.matchScore && (
            <div
              className="flex items-center justify-center rounded-lg flex-shrink-0"
              style={{
                fontFamily: FONT.mono, fontSize: 13, fontWeight: 700,
                color: '#ee716d', background: 'rgba(238,113,109,0.08)',
                padding: '4px 8px',
              }}
            >
              {Math.round(place.matchScore)}%
            </div>
          )}
          {/* Chevron hint */}
          <div className="flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK['30']} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>

        {/* Taste note */}
        {(place.terrazzoInsight?.why || place.enrichment?.description) && (
          <p style={{
            fontFamily: FONT.sans, fontSize: 12, color: TEXT.secondary,
            fontStyle: 'italic', lineHeight: 1.5, margin: '0 0 10px 0',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as React.CSSProperties['WebkitBoxOrient'],
            overflow: 'hidden',
          }}>
            {place.terrazzoInsight?.why || place.enrichment?.description}
          </p>
        )}

        {/* Info chips + directions button inline */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span
              className="px-2 py-0.5 rounded-md flex items-center gap-1"
              style={{ fontSize: 10, fontWeight: 600, background: destColor.bg, color: destColor.accent, fontFamily: FONT.mono }}
            >
              Day {item.dayNumber} · {item.slotTime}
            </span>
            {place.google?.rating && (
              <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-md" style={{ fontFamily: FONT.mono, fontSize: 10, color: TEXT.secondary, background: INK['04'] }}>
                ★ {place.google.rating}
              </span>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDirections(); }}
            className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg"
            style={{
              background: INK['04'], border: `1px solid ${INK['08']}`, color: TEXT.secondary,
              fontFamily: FONT.sans, fontSize: 10, fontWeight: 500, cursor: 'pointer',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l18-5-5 18-4-8-9-5z" />
            </svg>
            Directions
          </button>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
//  MOBILE GHOST CARD — dashed cream card for suggestions
// ═══════════════════════════════════════════════════════════════════════════

export function MobileGhostCard({
  ghost, onViewDetail, onAdd, onDismiss, onDismissGhost,
}: {
  ghost: GhostItem;
  onViewDetail: () => void;
  onAdd: (g: GhostItem) => void;
  onDismiss: () => void;
  onDismissGhost: (ghostId: string) => void;
}) {
  const { place } = ghost;
  const typeIcon = TYPE_ICONS[place.type] || 'pin';
  const destColor = getDestColor(ghost.destination || '');
  const srcStyle = SOURCE_STYLES[(place.ghostSource || 'terrazzo') as GhostSourceType] || SOURCE_STYLES.terrazzo;

  return (
    <div
      style={{
        background: '#faf6ef',
        borderRadius: 20,
        border: '1.5px dashed rgba(0,0,0,0.12)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
        overflow: 'hidden',
      }}
    >
      {/* Drag handle */}
      <div className="flex justify-center py-2">
        <div style={{ width: 36, height: 4, borderRadius: 2, background: INK['15'] }} />
      </div>

      <div
        className="px-4 pb-4 cursor-pointer"
        onClick={(e) => { e.stopPropagation(); onViewDetail(); }}
      >
        {/* Header row */}
        <div className="flex items-center gap-3 mb-2">
          <div
            className="flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ width: 40, height: 40, background: `${destColor.accent}10`, border: `1px dashed ${destColor.accent}30` }}
          >
            <PerriandIcon name={typeIcon} size={20} color={destColor.accent} />
          </div>
          <div className="flex-1 min-w-0">
            <div
              style={{
                fontFamily: FONT.serif, fontSize: 17, fontWeight: 600,
                color: 'var(--t-ink)', lineHeight: 1.2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {place.name}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className="px-1.5 py-0.5 rounded-md flex items-center gap-0.5"
                style={{ fontSize: 10, fontWeight: 600, background: srcStyle.bg, color: srcStyle.color, fontFamily: FONT.mono }}
              >
                <PerriandIcon name={srcStyle.icon} size={9} color={srcStyle.color} />
                {srcStyle.label}
              </span>
              <span style={{ fontFamily: FONT.sans, fontSize: 11, color: TEXT.secondary }}>
                {place.type.charAt(0).toUpperCase() + place.type.slice(1)}
              </span>
              {(() => { const dl = getDisplayLocation(place.location, place.name, place.google?.address); return dl ? <><span style={{ color: INK['20'] }}>·</span><span style={{ fontFamily: FONT.sans, fontSize: 11, color: TEXT.secondary }}>{dl}</span></> : null; })()}
            </div>
          </div>
          {place.matchScore && (
            <div
              className="flex items-center justify-center rounded-lg flex-shrink-0"
              style={{
                fontFamily: FONT.mono, fontSize: 13, fontWeight: 700,
                color: '#ee716d', background: 'rgba(238,113,109,0.08)',
                padding: '4px 8px',
              }}
            >
              {Math.round(place.matchScore)}%
            </div>
          )}
        </div>

        {/* Taste note */}
        {(place.terrazzoInsight?.why || place.enrichment?.description) && (
          <p style={{
            fontFamily: FONT.sans, fontSize: 12, color: TEXT.secondary,
            fontStyle: 'italic', lineHeight: 1.5, margin: '0 0 10px 0',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as React.CSSProperties['WebkitBoxOrient'],
            overflow: 'hidden',
          }}>
            {place.terrazzoInsight?.why || place.enrichment?.description}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(ghost); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl cursor-pointer"
            style={{
              background: 'var(--t-verde, #3a7d44)', border: 'none',
              color: 'white', fontFamily: FONT.sans, fontSize: 13, fontWeight: 600,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add to Day {ghost.dayNumber}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismissGhost(place.id);
              onDismiss();
            }}
            className="flex items-center justify-center px-4 py-2.5 rounded-xl cursor-pointer"
            style={{
              background: INK['04'], border: `1px solid ${INK['08']}`,
              color: TEXT.secondary, fontFamily: FONT.sans, fontSize: 12, fontWeight: 500,
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
//  SIDEBAR PLACE CARD — desktop list
// ═══════════════════════════════════════════════════════════════════════════

export function SidebarPlaceCard({
  item, index, isActive, showDay, onTap, onHover, onLeave,
}: {
  item: PlacedItem;
  index?: number;
  isActive: boolean;
  showDay: boolean;
  onTap: () => void;
  onHover: () => void;
  onLeave: () => void;
}) {
  const { place } = item;
  const typeIcon = TYPE_ICONS[place.type] || 'pin';
  const destColor = getDestColor(item.destination || '');

  return (
    <div
      onClick={onTap}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer"
      style={{
        background: isActive ? `${destColor.accent}06` : 'white',
        border: isActive ? `1.5px solid ${destColor.accent}30` : '1px solid transparent',
        boxShadow: isActive ? `0 2px 12px ${destColor.accent}12` : 'none',
        transition: 'all 180ms ease',
      }}
    >
      {index !== undefined ? (
        <div
          className="flex items-center justify-center rounded-full flex-shrink-0"
          style={{
            width: 24, height: 24,
            background: destColor.accent, color: 'white',
            fontFamily: FONT.mono, fontSize: 10, fontWeight: 700,
          }}
        >
          {index}
        </div>
      ) : (
        <div
          className="flex items-center justify-center rounded-lg flex-shrink-0"
          style={{ width: 32, height: 32, background: INK['04'] }}
        >
          <PerriandIcon name={typeIcon} size={16} color="var(--t-ink)" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <span style={{
          fontFamily: FONT.sans, fontSize: 12, fontWeight: 600, color: 'var(--t-ink)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block',
        }}>
          {place.name}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span style={{ fontFamily: FONT.sans, fontSize: 10, color: TEXT.secondary }}>
            {place.type.charAt(0).toUpperCase() + place.type.slice(1)}
          </span>
          {showDay && (
            <span className="px-1.5 rounded-full" style={{
              fontFamily: FONT.mono, fontSize: 8, fontWeight: 600,
              background: destColor.bg, color: destColor.accent,
            }}>
              D{item.dayNumber}
            </span>
          )}
          <span style={{ fontFamily: FONT.mono, fontSize: 9, color: TEXT.secondary }}>
            {item.slotTime}
          </span>
        </div>
      </div>
      {place.matchScore && (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0" style={{
          fontFamily: FONT.mono, color: '#ee716d', background: 'rgba(238,113,109,0.08)',
        }}>
          {Math.round(place.matchScore)}%
        </span>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
//  DESKTOP DETAIL CARD — floating on map
// ═══════════════════════════════════════════════════════════════════════════

export function DesktopDetailCard({
  item, onClose, onViewDetail,
}: {
  item: PlacedItem;
  onClose: () => void;
  onViewDetail: () => void;
}) {
  const { place } = item;
  const typeIcon = TYPE_ICONS[place.type] || 'pin';
  const destColor = getDestColor(item.destination || '');
  const srcStyle = SOURCE_STYLES[place.ghostSource as GhostSourceType] || SOURCE_STYLES.manual;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 12px 48px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        border: '1px solid rgba(255,255,255,0.7)',
      }}
    >
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: destColor.bg, borderBottom: `1px solid ${destColor.accent}15` }}>
        <span style={{ fontFamily: FONT.mono, fontSize: 9, color: destColor.accent, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>
          {place.type.charAt(0).toUpperCase() + place.type.slice(1)}
        </span>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} aria-label="Close detail card">
          <PerriandIcon name="close" size={16} color={INK['40']} />
        </button>
      </div>

      <div className="px-4 py-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center rounded-xl" style={{ width: 44, height: 44, background: `${destColor.accent}10` }}>
            <PerriandIcon name={typeIcon} size={22} color={destColor.accent} />
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ fontFamily: FONT.serif, fontSize: 16, fontWeight: 600, color: 'var(--t-ink)' }}>{place.name}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {(() => { const dl = getDisplayLocation(place.location, place.name, place.google?.address); return dl ? <span style={{ fontFamily: FONT.sans, fontSize: 10, color: TEXT.secondary }}>{dl}</span> : null; })()}
            </div>
          </div>
          {place.matchScore && (
            <span className="px-2 py-1 rounded-lg" style={{ fontFamily: FONT.mono, fontSize: 12, fontWeight: 700, color: '#ee716d', background: 'rgba(238,113,109,0.08)' }}>
              {Math.round(place.matchScore)}%
            </span>
          )}
        </div>

        {(place.terrazzoInsight?.why || place.tasteNote) && (
          <p style={{ fontFamily: FONT.sans, fontSize: 12, color: TEXT.secondary, fontStyle: 'italic', lineHeight: 1.5, margin: '0 0 10px 0' }}>
            {place.terrazzoInsight?.why || place.tasteNote}
          </p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <span className="px-2 py-0.5 rounded-md flex items-center gap-0.5" style={{ fontSize: 9, fontWeight: 600, background: srcStyle.bg, color: srcStyle.color, fontFamily: FONT.mono }}>
            <PerriandIcon name={srcStyle.icon} size={10} color={srcStyle.color} />
            {place.source?.name || srcStyle.label}
          </span>
          <span className="px-2 py-0.5 rounded-md flex items-center gap-0.5" style={{ fontSize: 9, fontWeight: 600, background: destColor.bg, color: destColor.accent, fontFamily: FONT.mono }}>
            Day {item.dayNumber} · {item.slotTime}
          </span>
          {place.google?.rating && (
            <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-md" style={{ fontFamily: FONT.mono, fontSize: 9, color: TEXT.secondary, background: INK['04'] }}>
              ★ {place.google.rating}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onViewDetail(); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl cursor-pointer"
            style={{ background: 'var(--t-ink)', border: 'none', color: 'var(--t-cream)', fontFamily: FONT.sans, fontSize: 12, fontWeight: 600 }}
          >
            View Details
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const q = encodeURIComponent(place.name + (place.location ? `, ${place.location}` : ''));
              window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
            }}
            className="flex items-center justify-center gap-1 px-4 py-2.5 rounded-xl cursor-pointer"
            style={{ background: INK['04'], border: `1px solid ${INK['08']}`, color: TEXT.secondary, fontFamily: FONT.sans, fontSize: 12, fontWeight: 500 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l18-5-5 18-4-8-9-5z" />
            </svg>
            Directions
          </button>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
//  DESKTOP GHOST CARD — floating suggestion card on map
// ═══════════════════════════════════════════════════════════════════════════

export function DesktopGhostCard({
  ghost, onClose, onViewDetail, onAdd, onDismissGhost,
}: {
  ghost: GhostItem;
  onClose: () => void;
  onViewDetail: () => void;
  onAdd: (g: GhostItem) => void;
  onDismissGhost: (ghostId: string) => void;
}) {
  const { place } = ghost;
  const typeIcon = TYPE_ICONS[place.type] || 'pin';
  const destColor = getDestColor(ghost.destination || '');
  const srcStyle = SOURCE_STYLES[(place.ghostSource || 'terrazzo') as GhostSourceType] || SOURCE_STYLES.terrazzo;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(250,246,239,0.96)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 12px 48px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        border: '1.5px dashed rgba(0,0,0,0.12)',
      }}
    >
      {/* Header bar */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: `${destColor.accent}06`, borderBottom: '1px dashed rgba(0,0,0,0.08)' }}>
        <div className="flex items-center gap-2">
          <span
            className="px-1.5 py-0.5 rounded-md flex items-center gap-0.5"
            style={{ fontSize: 9, fontWeight: 600, background: srcStyle.bg, color: srcStyle.color, fontFamily: FONT.mono }}
          >
            <PerriandIcon name={srcStyle.icon} size={9} color={srcStyle.color} />
            {srcStyle.label}
          </span>
          <span style={{ fontFamily: FONT.mono, fontSize: 9, color: TEXT.secondary, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>
            Suggestion
          </span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} aria-label="Close suggestion card">
          <PerriandIcon name="close" size={16} color={INK['40']} />
        </button>
      </div>

      <div className="px-4 py-3">
        {/* Place info */}
        <div className="flex items-center gap-3 mb-2">
          <div
            className="flex items-center justify-center rounded-xl"
            style={{ width: 44, height: 44, background: `${destColor.accent}10`, border: `1px dashed ${destColor.accent}30` }}
          >
            <PerriandIcon name={typeIcon} size={22} color={destColor.accent} />
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ fontFamily: FONT.serif, fontSize: 16, fontWeight: 600, color: 'var(--t-ink)' }}>{place.name}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span style={{ fontFamily: FONT.sans, fontSize: 10, color: TEXT.secondary }}>
                {place.type.charAt(0).toUpperCase() + place.type.slice(1)}
              </span>
              {(() => { const dl = getDisplayLocation(place.location, place.name, place.google?.address); return dl ? <><span style={{ color: INK['20'] }}>·</span><span style={{ fontFamily: FONT.sans, fontSize: 10, color: TEXT.secondary }}>{dl}</span></> : null; })()}
            </div>
          </div>
          {place.matchScore && (
            <span className="px-2 py-1 rounded-lg" style={{ fontFamily: FONT.mono, fontSize: 12, fontWeight: 700, color: '#ee716d', background: 'rgba(238,113,109,0.08)' }}>
              {Math.round(place.matchScore)}%
            </span>
          )}
        </div>

        {/* Taste note */}
        {(place.terrazzoInsight?.why || place.tasteNote) && (
          <p style={{ fontFamily: FONT.sans, fontSize: 12, color: TEXT.secondary, fontStyle: 'italic', lineHeight: 1.5, margin: '0 0 10px 0' }}>
            {place.terrazzoInsight?.why || place.tasteNote}
          </p>
        )}

        {/* Info chips */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {place.google?.rating && (
            <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-md" style={{ fontFamily: FONT.mono, fontSize: 9, color: TEXT.secondary, background: INK['04'] }}>
              ★ {place.google.rating}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(ghost); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl cursor-pointer"
            style={{
              background: 'var(--t-verde, #3a7d44)', border: 'none',
              color: 'white', fontFamily: FONT.sans, fontSize: 12, fontWeight: 600,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add to Day {ghost.dayNumber}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onViewDetail(); }}
            className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl cursor-pointer"
            style={{ background: 'rgba(0,0,0,0.04)', border: `1px solid ${INK['08']}`, color: TEXT.secondary, fontFamily: FONT.sans, fontSize: 12, fontWeight: 500 }}
          >
            Details
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismissGhost(place.id);
              onClose();
            }}
            className="flex items-center justify-center px-3 py-2.5 rounded-xl cursor-pointer"
            style={{ background: 'transparent', border: `1px solid ${INK['08']}`, color: TEXT.secondary, fontFamily: FONT.sans, fontSize: 11, fontWeight: 500 }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

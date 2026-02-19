'use client';

import React, { useState } from 'react';
import { ImportedPlace, DOMAIN_COLORS, DOMAIN_ICONS, TasteDomain, REACTIONS, SOURCE_STYLES, GhostSourceType } from '@/types';
import { useSavedStore } from '@/stores/savedStore';
import { useBriefing } from '@/hooks/useBriefing';
import { getPlaceImage } from '@/constants/placeImages';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { TerrazzoMosaic, MosaicLegend } from '@/components/TerrazzoMosaic';
import PipelineProgress from '@/components/PipelineProgress';
import { FONT, INK } from '@/constants/theme';

interface PlaceDetailSheetProps {
  item: ImportedPlace;
  onClose: () => void;
  onRate?: () => void;
  onSave?: () => void;
  onEditRating?: () => void;
  onViewBriefing?: () => void;
  onShortlistTap?: () => void;
  isPreview?: boolean;
  siblingPlaces?: ImportedPlace[]; // other places from the same import batch
}

const TASTE_DOMAINS: TasteDomain[] = ['Design', 'Character', 'Service', 'Food', 'Location', 'Wellness'];

// Generate a warm gradient based on place type
function getPhotoGradient(type: string): string {
  const gradients: Record<string, string> = {
    restaurant: 'linear-gradient(135deg, #d8c0a0, #c0a880, #b89870)',
    hotel: 'linear-gradient(135deg, #c8c0d0, #b0a8b8, #a098a8)',
    bar: 'linear-gradient(135deg, #d0c0a0, #b8a888, #a89878)',
    cafe: 'linear-gradient(135deg, #d8d0c0, #c8c0b0, #b8b0a0)',
    museum: 'linear-gradient(135deg, #c0c8d0, #a8b0b8, #98a0a8)',
    activity: 'linear-gradient(135deg, #c0d0c8, #a8b8a8, #98a898)',
    neighborhood: 'linear-gradient(135deg, #d0d8c8, #b8c0a8, #a8b098)',
    shop: 'linear-gradient(135deg, #d8c8b8, #c0b0a0, #b0a090)',
  };
  return gradients[type] || gradients.restaurant;
}

export default function PlaceDetailSheet({ item, onClose, onRate, onSave, onEditRating, onViewBriefing, onShortlistTap, isPreview, siblingPlaces }: PlaceDetailSheetProps) {
  const existingRating = item.rating;
  const ratingReaction = existingRating ? REACTIONS.find(r => r.id === existingRating.reaction) : null;
  const sourceStyle = item.ghostSource ? SOURCE_STYLES[item.ghostSource as GhostSourceType] : null;
  const addPlace = useSavedStore(s => s.addPlace);
  const myPlaces = useSavedStore(s => s.myPlaces);
  const shortlists = useSavedStore(s => s.shortlists);
  const [saved, setSaved] = useState(myPlaces.some(p => p.name === item.name));
  const isShortlisted = item.isShortlisted || false;
  const memberShortlists = shortlists.filter(sl => sl.placeIds.includes(item.id));

  // Briefing polling for inline progress
  const googlePlaceId = (item.google as Record<string, unknown> & { placeId?: string })?.placeId as string | undefined;
  const { data: intelData } = useBriefing(onViewBriefing ? googlePlaceId : undefined);
  const isEnriching = intelData?.status === 'enriching' || intelData?.status === 'pending';

  const handleSave = () => {
    if (!saved) {
      addPlace({ ...item, id: `saved-${Date.now()}` });
      setSaved(true);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 overflow-y-auto rounded-t-2xl"
        style={{
          maxWidth: 480,
          margin: '0 auto',
          maxHeight: '90vh',
          background: 'var(--t-cream)',
        }}
      >
        {/* Photo header */}
        <div
          className="relative"
          style={{
            height: 200,
            background: getPhotoGradient(item.type),
          }}
        >
          {getPlaceImage(item.name) && (
            <img
              src={getPlaceImage(item.name)}
              alt={item.name}
              width={480}
              height={200}
              style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          {/* Back button — frosted pill */}
          <button
            onClick={onClose}
            className="absolute top-14 left-4 flex items-center justify-center border-none cursor-pointer"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(28,26,23,0.45)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              color: 'white',
              fontSize: 14,
            }}
          >
            ←
          </button>
        </div>

        <div className="px-5 pb-24">
          {/* Save to library CTA — shown immediately for previews */}
          {isPreview && onSave && (
            <button
              onClick={onSave}
              className="w-full mb-3 py-3 rounded-xl border-none cursor-pointer text-[13px] font-semibold transition-all hover:opacity-90 flex items-center justify-center gap-2 mt-4"
              style={{
                background: saved ? INK['06'] : 'var(--t-ink)',
                color: saved ? 'var(--t-ink)' : 'var(--t-cream)',
                fontFamily: FONT.sans,
              }}
            >
              <PerriandIcon name={saved ? 'check' : 'add'} size={14} color={saved ? 'var(--t-ink)' : 'var(--t-cream)'} />
              {saved ? 'Saved to library' : 'Save to library'}
            </button>
          )}

          {/* ── Compact header ── */}
          {/* Row 1: Name + action badges */}
          <div className="flex items-start gap-2 mt-4">
            <h2
              className="text-[22px] italic leading-tight flex-1 min-w-0"
              style={{ fontFamily: FONT.serif, color: 'var(--t-ink)', margin: 0 }}
            >
              {item.name}
            </h2>
            {/* Action badges — rating + shortlist */}
            <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
              {existingRating && ratingReaction ? (
                <button
                  onClick={onRate}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg cursor-pointer transition-all hover:scale-[1.02] border-none"
                  style={{
                    background: `${ratingReaction.color}10`,
                    border: `1.5px solid ${ratingReaction.color}25`,
                  }}
                >
                  <PerriandIcon name={ratingReaction.icon} size={13} color={ratingReaction.color} />
                  <span className="text-[9px] font-semibold" style={{ color: ratingReaction.color, fontFamily: FONT.mono }}>
                    {ratingReaction.label}
                  </span>
                </button>
              ) : onRate && !isPreview ? (
                <button
                  onClick={onRate}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg cursor-pointer transition-all hover:scale-[1.02] border-none"
                  style={{
                    background: INK['04'],
                    border: `1.5px solid ${INK['08']}`,
                  }}
                >
                  <PerriandIcon name="star" size={12} color={INK['80']} />
                  <span className="text-[9px] font-medium" style={{ color: INK['80'], fontFamily: FONT.mono }}>
                    Rate
                  </span>
                </button>
              ) : null}

              {/* Shortlist badge */}
              {!isPreview && onShortlistTap && (
                <button
                  onClick={onShortlistTap}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg cursor-pointer transition-all hover:scale-[1.02] border-none"
                  style={{
                    background: isShortlisted ? 'rgba(42,122,86,0.06)' : INK['03'],
                    border: isShortlisted ? '1.5px solid rgba(42,122,86,0.2)' : `1.5px solid ${INK['08']}`,
                  }}
                >
                  <PerriandIcon name="bookmark" size={11} color={isShortlisted ? 'var(--t-verde)' : INK['70']} />
                  <span className="text-[9px] font-semibold" style={{
                    color: isShortlisted ? 'var(--t-verde)' : INK['70'],
                    fontFamily: FONT.mono,
                  }}>
                    {isShortlisted ? `${memberShortlists.length} list${memberShortlists.length > 1 ? 's' : ''}` : 'Save'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Location + all metadata chips flowing together */}
          <div className="flex items-center gap-1.5 mt-1.5 mb-3 flex-wrap">
            <span className="text-[11px]" style={{ color: INK['70'] }}>
              {item.location} · {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            </span>
            {item.alsoKnownAs && (
              <span className="text-[10px]" style={{ color: INK['70'] }}>
                aka &ldquo;{item.alsoKnownAs}&rdquo;
              </span>
            )}
            {sourceStyle && (
              <span
                className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1"
                style={{ background: sourceStyle.bg, color: sourceStyle.color }}
              >
                <PerriandIcon name={sourceStyle.icon} size={10} color={sourceStyle.color} />
                via {item.source?.name || sourceStyle.label}
              </span>
            )}
            {item.google?.category && (
              <span
                className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
                style={{ background: 'rgba(200,146,58,0.15)', color: '#7a5e24' }}
              >
                {item.google.category}
              </span>
            )}
            {item.google?.rating && (
              <span className="flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: INK['04'], color: 'var(--t-ink)' }}>
                <PerriandIcon name="star" size={10} color="var(--t-chrome-yellow)" />
                {item.google.rating}
                {item.google.reviewCount && (
                  <span style={{ color: INK['70'] }}>({item.google.reviewCount.toLocaleString()})</span>
                )}
              </span>
            )}
            {item.google?.priceLevel && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: INK['04'], color: 'var(--t-ink)' }}>
                {'$'.repeat(item.google.priceLevel)}
              </span>
            )}
          </div>

          {/* Description */}
          {item.enrichment?.description && (
            <p className="text-[12px] leading-relaxed mb-4" style={{ color: INK['85'] }}>
              {item.enrichment.description}
            </p>
          )}

          {/* Place details — tile grid with grout lines */}
          {item.google && (item.google.address || item.google.website || item.google.phone || item.google.placeId || item.google.lat) && (() => {
            const g = item.google as Record<string, unknown> & { placeId?: string; lat?: number; lng?: number; address?: string; website?: string; phone?: string };
            const mapsUrl = g.placeId
              ? `https://www.google.com/maps/place/?q=place_id:${g.placeId}`
              : g.lat && g.lng
                ? `https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lng}`
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.name} ${item.location}`)}`;

            const tiles: React.ReactNode[] = [];
            if (g.address) {
              tiles.push(
                <div key="addr" className="flex items-start gap-2 p-3 min-w-0">
                  <PerriandIcon name="pin" size={13} color={INK['50']} />
                  <span className="text-[10px] leading-snug" style={{ color: INK['75'] }}>
                    {g.address}
                  </span>
                </div>
              );
            }
            if (g.website) {
              tiles.push(
                <div key="web" className="flex items-center gap-2 p-3 min-w-0">
                  <PerriandIcon name="discover" size={13} color={INK['50']} />
                  <a href={g.website} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] no-underline truncate" style={{ color: '#8a6a2a' }}
                    onClick={(e) => e.stopPropagation()}>
                    {g.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                  </a>
                </div>
              );
            }
            if (g.phone) {
              tiles.push(
                <div key="phone" className="flex items-center gap-2 p-3 min-w-0">
                  <PerriandIcon name="sparkle" size={13} color={INK['50']} />
                  <a href={`tel:${g.phone}`} className="text-[10px] no-underline" style={{ color: '#8a6a2a' }}
                    onClick={(e) => e.stopPropagation()}>
                    {g.phone}
                  </a>
                </div>
              );
            }
            tiles.push(
              <div key="maps" className="flex items-center gap-2 p-3 min-w-0">
                <PerriandIcon name="maps" size={13} color={INK['50']} />
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] no-underline" style={{ color: '#8a6a2a' }}
                  onClick={(e) => e.stopPropagation()}>
                  Google Maps ↗
                </a>
              </div>
            );

            const cols = tiles.length >= 2 ? 2 : 1;

            return (
              <div
                className="mb-4 rounded-xl overflow-hidden"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gap: 1,
                  background: INK['06'],
                  border: `1px solid ${INK['04']}`,
                }}
              >
                {tiles.map((tile, i) => (
                  <div key={i} style={{ background: '#fffdf8' }}>
                    {tile}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Enrichment warnings */}
          {item.enrichment?.closedDays && item.enrichment.closedDays.length > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4"
              style={{ background: 'rgba(232,104,48,0.12)', border: '1px solid rgba(232,104,48,0.25)' }}
            >
              <span>⚠️</span>
              <span className="text-[11px] font-medium" style={{ color: '#a04018' }}>
                Closed {item.enrichment.closedDays.join(', ')}s
              </span>
            </div>
          )}

          {/* What to order — extracted tags */}
          {item.whatToOrder && item.whatToOrder.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
                style={{ color: INK['95'], fontFamily: FONT.mono, letterSpacing: '1px' }}>
                What to order
              </div>
              <div className="flex flex-wrap gap-1.5">
                {item.whatToOrder.map((tag, i) => (
                  <div key={i} className="px-2.5 py-1 rounded-lg text-[11px]"
                    style={{ background: 'var(--t-linen)', color: 'var(--t-ink)' }}>
                    {tag}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tips — extracted from source */}
          {item.tips && item.tips.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
                style={{ color: INK['95'], fontFamily: FONT.mono, letterSpacing: '1px' }}>
                Tips
              </div>
              <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--t-linen)' }}>
                {item.tips.map((tip, i) => (
                  <div key={i} className="text-[11px] leading-relaxed" style={{ color: 'var(--t-ink)' }}>
                    {tip}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Also from this guide — sibling places from same import */}
          {siblingPlaces && siblingPlaces.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
                style={{ color: INK['95'], fontFamily: FONT.mono, letterSpacing: '1px' }}>
                Also from this guide
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {siblingPlaces.slice(0, 5).map(sibling => (
                  <div key={sibling.id} className="min-w-[120px] rounded-xl p-2.5 flex-shrink-0"
                    style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
                    <div className="text-[11px] font-semibold" style={{ color: 'var(--t-ink)' }}>{sibling.name}</div>
                    <div className="text-[9px]" style={{ color: INK['95'] }}>
                      {sibling.type.charAt(0).toUpperCase() + sibling.type.slice(1)} · {sibling.location.split(',')[0]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Author's notes callout — the gold, wireframe style */}
          {item.tasteNote && (
            <div
              className="mb-4"
              style={{
                background: sourceStyle ? `${sourceStyle.color}14` : 'rgba(199,82,51,0.08)',
                borderLeft: `3px solid ${sourceStyle?.color || '#c75233'}`,
                padding: '12px 14px',
                borderRadius: '0 12px 12px 0',
              }}
            >
              <div
                className="text-[9px] font-bold uppercase tracking-widest mb-1"
                style={{
                  color: sourceStyle?.color || '#a8422a',
                  fontFamily: FONT.mono,
                }}
              >
                {item.source?.name ? `From ${item.source.name}` : 'Source note'}
              </div>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--t-ink)' }}>
                {item.tasteNote}
              </p>
            </div>
          )}

          {/* Friend attribution */}
          {item.friendAttribution && (
            <div
              className="mb-4"
              style={{
                background: 'rgba(42,122,86,0.08)',
                borderLeft: '3px solid var(--t-verde)',
                padding: '12px 14px',
                borderRadius: '0 12px 12px 0',
              }}
            >
              <div
                className="text-[9px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1"
                style={{ color: 'var(--t-verde)', fontFamily: FONT.mono }}
              >
                <PerriandIcon name="friend" size={12} color="var(--t-verde)" />
                {item.friendAttribution.name}
              </div>
              {item.friendAttribution.note && (
                <p className="text-[12px] italic leading-relaxed" style={{ color: 'var(--t-ink)' }}>
                  &ldquo;{item.friendAttribution.note}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* Your notes — tappable section to edit rating details */}
          {existingRating && ratingReaction && (existingRating.tags?.length || existingRating.personalNote || existingRating.contextTags?.length) && (
            <div
              className="mb-4 px-3 py-2.5 rounded-xl cursor-pointer"
              style={{ background: `${ratingReaction.color}06`, border: `1px solid ${ratingReaction.color}15` }}
              onClick={onEditRating || onRate}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1"
                style={{ color: ratingReaction.color, fontFamily: FONT.mono }}
              >
                <PerriandIcon name="edit" size={11} color={ratingReaction.color} />
                Your notes
              </div>
              {existingRating.tags && existingRating.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {existingRating.tags.map(tag => (
                    <span
                      key={tag}
                      className="text-[9px] px-2 py-0.5 rounded-full"
                      style={{ background: `${ratingReaction.color}12`, color: ratingReaction.color }}
                    >
                      {tag}
                    </span>
                  ))}
                  {existingRating.returnIntent === 'absolutely' && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: INK['04'], color: INK['90'] }}>
                      Would return <PerriandIcon name="check" size={11} color={INK['90']} />
                    </span>
                  )}
                </div>
              )}
              {existingRating.personalNote && (
                <p className="text-[11px] italic mt-1.5" style={{ color: INK['90'] }}>
                  &ldquo;{existingRating.personalNote}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* Terrazzo Insights */}
          {item.terrazzoInsight && (
            <div className="flex flex-col gap-3 mb-4">
              {/* Why you'll love it */}
              <div
                className="p-3 rounded-xl"
                style={{ background: 'rgba(42,122,86,0.10)', border: '1px solid rgba(42,122,86,0.20)' }}
              >
                <h4
                  className="text-[10px] uppercase tracking-wider font-bold mb-1.5 flex items-center gap-1"
                  style={{ color: '#226848', fontFamily: FONT.mono }}
                >
                  <PerriandIcon name="terrazzo" size={12} color="#226848" />
                  Why You&apos;ll Love It
                </h4>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--t-ink)' }}>
                  {item.terrazzoInsight.why}
                </p>
              </div>

              {/* Heads up */}
              {item.terrazzoInsight.caveat && (
                <div
                  className="p-3 rounded-xl"
                  style={{ background: 'rgba(160,108,40,0.10)', border: '1px solid rgba(160,108,40,0.20)' }}
                >
                  <h4
                    className="text-[10px] uppercase tracking-wider font-bold mb-1.5"
                    style={{ color: '#7a5518', fontFamily: FONT.mono }}
                  >
                    Heads Up
                  </h4>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--t-ink)' }}>
                    {item.terrazzoInsight.caveat}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Match score highlight */}
          <div
            className="flex items-center gap-3 p-3 rounded-xl mb-4"
            style={{
              background: 'rgba(200,146,58,0.10)',
              border: '1px solid rgba(200,146,58,0.20)',
              cursor: onViewBriefing ? 'pointer' : 'default',
            }}
            onClick={onViewBriefing}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-[14px] font-bold flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(200,146,58,0.2), rgba(200,146,58,0.1))',
                color: '#8a6a2a',
                fontFamily: FONT.mono,
              }}
            >
              {item.matchScore}%
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold" style={{ color: 'var(--t-ink)' }}>
                Taste match
              </div>
              <div className="text-[10px]" style={{ color: INK['95'] }}>
                Based on your profile preferences
              </div>
              {/* Inline pipeline progress when enriching */}
              {isEnriching && intelData?.latestRun && (
                <div className="mt-1.5">
                  <PipelineProgress
                    currentStage={intelData.latestRun.currentStage}
                    stagesCompleted={intelData.latestRun.stagesCompleted}
                    startedAt={intelData.latestRun.startedAt}
                    compact
                  />
                </div>
              )}
              {/* View full analysis link */}
              {onViewBriefing && googlePlaceId && (
                <button
                  className="text-[10px] mt-1 block border-none bg-transparent p-0 cursor-pointer"
                  style={{ color: '#7a5a20', fontFamily: FONT.mono }}
                  onClick={(e) => { e.stopPropagation(); onViewBriefing(); }}
                >
                  View full briefing →
                </button>
              )}
            </div>
          </div>

          {/* Terrazzo Mosaic Breakdown */}
          <div className="mb-4">
            <h3
              className="text-[10px] uppercase tracking-wider mb-2.5 font-bold"
              style={{ color: INK['95'], fontFamily: FONT.mono }}
            >
              Taste Mosaic
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <TerrazzoMosaic profile={item.matchBreakdown} size="md" />
              <MosaicLegend profile={item.matchBreakdown} style={{ gridTemplateColumns: 'repeat(2, auto)', gap: '6px 14px' }} />
            </div>
          </div>

          {/* Rate this place button */}
          {onRate && (
            <button
              onClick={onRate}
              className="w-full mt-6 py-3.5 rounded-xl border-none cursor-pointer text-[13px] font-semibold transition-all hover:opacity-90"
              style={{
                background: existingRating ? INK['06'] : 'var(--t-ink)',
                color: existingRating ? 'var(--t-ink)' : 'var(--t-cream)',
                fontFamily: FONT.sans,
              }}
            >
              {existingRating ? 'Update your rating' : 'Rate this place'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

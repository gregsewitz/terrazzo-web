'use client';

import React, { useState, memo } from 'react';
import { ImportedPlace, DOMAIN_COLORS, DOMAIN_ICONS, TasteDomain, REACTIONS, SOURCE_STYLES, GhostSourceType } from '@/types';
import { useSavedStore } from '@/stores/savedStore';
import { useBriefing } from '@/hooks/useBriefing';
import { getPlaceImage } from '@/constants/placeImages';
import { PHOTO_GRADIENTS } from '@/constants/placeTypes';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { TerrazzoMosaic, MosaicLegend } from '@/components/TerrazzoMosaic';
import PipelineProgress from '@/components/PipelineProgress';
import { FONT, INK } from '@/constants/theme';
import PlacePhoto from '@/components/PlacePhoto';

export interface PlaceDetailContentProps {
  item: ImportedPlace;
  onClose: () => void;
  onRate?: () => void;
  onSave?: () => void;
  onEditRating?: () => void;
  onViewBriefing?: () => void;
  onCollectionTap?: () => void;
  onDelete?: () => void;
  isPreview?: boolean;
  siblingPlaces?: ImportedPlace[]; // other places from the same import batch
  variant: 'desktop' | 'mobile';
}

const TASTE_DOMAINS: TasteDomain[] = ['Design', 'Character', 'Service', 'Food', 'Location', 'Wellness'];

function PlaceDetailContent({
  item,
  onClose,
  onRate,
  onSave,
  onEditRating,
  onViewBriefing,
  onCollectionTap,
  onDelete,
  isPreview,
  siblingPlaces,
  variant,
}: PlaceDetailContentProps) {
  const existingRating = item.rating;
  const ratingReaction = existingRating ? REACTIONS.find(r => r.id === existingRating.reaction) : null;
  const sourceStyle = item.ghostSource ? SOURCE_STYLES[item.ghostSource as GhostSourceType] : null;
  const addPlace = useSavedStore(s => s.addPlace);
  const myPlaces = useSavedStore(s => s.myPlaces);
  const collections = useSavedStore(s => s.collections);
  const [saved, setSaved] = useState(myPlaces.some(p => p.name === item.name));
  const memberCollections = collections.filter(sl => sl.placeIds.includes(item.id));
  const isInCollections = memberCollections.length > 0;

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

  // Variant-specific styles
  const isDesktop = variant === 'desktop';
  const photoHeight = isDesktop ? 240 : 200;
  const containerPadding = isDesktop ? 'px-7 pb-8' : 'px-5 pb-24';
  const containerMarginTop = isDesktop ? 'mt-5' : 'mt-4';
  const nameFontSize = isDesktop ? 'text-[24px]' : 'text-[22px]';
  const locationFontSize = isDesktop ? 'text-[12px]' : 'text-[11px]';
  const akaFontSize = isDesktop ? 'text-[11px]' : 'text-[10px]';
  const descriptionFontSize = isDesktop ? 'text-[13px]' : 'text-[12px]';
  const whatToOrderTagFontSize = isDesktop ? 'text-[12px]' : 'text-[11px]';
  const tipsFontSize = isDesktop ? 'text-[12px]' : 'text-[11px]';
  const siblingCardWidth = isDesktop ? 'min-w-[140px]' : 'min-w-[120px]';
  const siblingNameFontSize = isDesktop ? 'text-[12px]' : 'text-[11px]';
  const siblingTypeFontSize = isDesktop ? 'text-[10px]' : 'text-[9px]';
  const tasteNoteFontSize = isDesktop ? 'text-[13px]' : 'text-[12px]';
  const friendAttributionFontSize = isDesktop ? 'text-[13px]' : 'text-[12px]';
  const yourNotesFontSize = isDesktop ? 'text-[12px]' : 'text-[11px]';
  const terrazzoParagraphFontSize = isDesktop ? 'text-[12px]' : 'text-[11px]';
  const matchScoreFontSize = isDesktop ? 'text-[15px]' : 'text-[14px]';
  const matchScoreLabelFontSize = isDesktop ? 'text-[13px]' : 'text-[12px]';
  const matchScoreSubFontSize = isDesktop ? 'text-[11px]' : 'text-[10px]';
  const rateButtonFontSize = isDesktop ? 'text-[14px]' : 'text-[13px]';
  const saveButtonFontSize = isDesktop ? 'text-[14px]' : 'text-[13px]';

  const ratingBadgeIconSize = isDesktop ? 14 : 13;
  const ratingBadgeFontSize = isDesktop ? 'text-[10px]' : 'text-[9px]';
  const collectionBadgeIconSize = isDesktop ? 12 : 11;
  const collectionBadgeFontSize = isDesktop ? 'text-[10px]' : 'text-[9px]';
  const closeButtonHoverClass = isDesktop ? 'btn-hover' : '';
  const saveButtonHoverClass = isDesktop ? 'transition-all btn-hover' : 'transition-all hover:opacity-90';
  const rateButtonHoverClass = isDesktop ? 'btn-hover' : 'transition-all hover:opacity-90';
  const ratingBadgeHoverClass = isDesktop ? 'btn-hover' : 'transition-all hover:scale-[1.02]';
  const collectionBadgeHoverClass = isDesktop ? 'btn-hover' : 'transition-all hover:scale-[1.02]';

  return (
    <>
      {/* Photo header — height varies by variant */}
      <div
        className="relative flex-shrink-0"
        style={{
          height: photoHeight,
          background: PHOTO_GRADIENTS[item.type] || PHOTO_GRADIENTS.restaurant,
        }}
      >
        {getPlaceImage(item.name) && (
          <PlacePhoto
            src={getPlaceImage(item.name)}
            alt={item.name}
            fill
            sizes={isDesktop ? '440px' : '100vw'}
            style={{ position: 'absolute', top: 0, left: 0 }}
          />
        )}
        {/* Close/back button — position and style varies */}
        <button
          onClick={onClose}
          className={`absolute flex items-center justify-center border-none cursor-pointer ${closeButtonHoverClass}`}
          style={{
            ...(isDesktop ? { top: 16, right: 16 } : { top: 56, left: 16 }),
            width: isDesktop ? 36 : 32,
            height: isDesktop ? 36 : 32,
            borderRadius: '50%',
            background: 'rgba(28,26,23,0.45)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            color: 'white',
            fontSize: isDesktop ? 16 : 14,
            transition: 'background 150ms ease',
          }}
          onMouseEnter={e => isDesktop && (e.currentTarget.style.background = 'rgba(28,26,23,0.6)')}
          onMouseLeave={e => isDesktop && (e.currentTarget.style.background = 'rgba(28,26,23,0.45)')}
          aria-label="Close"
        >
          {isDesktop ? '✕' : '←'}
        </button>
      </div>

      {/* Scrollable content */}
      <div className={`flex-1 overflow-y-auto ${containerPadding}`}>
        {/* Save CTA for previews */}
        {isPreview && onSave && (
          <button
            onClick={onSave}
            className={`w-full mb-3 py-3 rounded-xl border-none cursor-pointer ${saveButtonFontSize} font-semibold ${saveButtonHoverClass} flex items-center justify-center gap-2 ${containerMarginTop}`}
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

        {/* Name + action badges */}
        <div className={`flex items-start gap-2 ${containerMarginTop}`}>
          <h2
            className={`${nameFontSize} italic leading-tight flex-1 min-w-0`}
            style={{ fontFamily: FONT.serif, color: 'var(--t-ink)', margin: 0 }}
          >
            {item.name}
          </h2>
          <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
            {existingRating && ratingReaction ? (
              <button
                onClick={onRate}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg cursor-pointer border-none ${ratingBadgeHoverClass}`}
                style={{
                  background: `${ratingReaction.color}10`,
                  border: `1.5px solid ${ratingReaction.color}25`,
                }}
              >
                <PerriandIcon name={ratingReaction.icon} size={ratingBadgeIconSize} color={ratingReaction.color} />
                <span className={`${ratingBadgeFontSize} font-semibold`} style={{ color: ratingReaction.color, fontFamily: FONT.mono }}>
                  {ratingReaction.label}
                </span>
              </button>
            ) : onRate && !isPreview ? (
              <button
                onClick={onRate}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg cursor-pointer border-none ${ratingBadgeHoverClass}`}
                style={{
                  background: INK['04'],
                  border: `1.5px solid ${INK['08']}`,
                }}
              >
                <PerriandIcon name="star" size={isDesktop ? 13 : 12} color={INK['80']} />
                <span className={`${ratingBadgeFontSize} font-medium`} style={{ color: INK['80'], fontFamily: FONT.mono }}>
                  Rate
                </span>
              </button>
            ) : null}
            {!isPreview && onCollectionTap && (
              <button
                onClick={onCollectionTap}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg cursor-pointer border-none ${collectionBadgeHoverClass}`}
                style={{
                  background: isInCollections ? 'rgba(42,122,86,0.06)' : INK['03'],
                  border: isInCollections ? '1.5px solid rgba(42,122,86,0.2)' : `1.5px solid ${INK['08']}`,
                }}
              >
                <PerriandIcon name="bookmark" size={collectionBadgeIconSize} color={isInCollections ? 'var(--t-verde)' : INK['70']} />
                <span className={`${collectionBadgeFontSize} font-semibold`} style={{
                  color: isInCollections ? 'var(--t-verde)' : INK['70'],
                  fontFamily: FONT.mono,
                }}>
                  {isInCollections ? `${memberCollections.length} list${memberCollections.length > 1 ? 's' : ''}` : 'Save'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Location + metadata chips */}
        <div className="flex items-center gap-1.5 mt-2 mb-4 flex-wrap">
          <span className={`${locationFontSize}`} style={{ color: INK['70'] }}>
            {item.location} · {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
          </span>
          {item.alsoKnownAs && (
            <span className={`${akaFontSize}`} style={{ color: INK['70'] }}>
              aka &ldquo;{item.alsoKnownAs}&rdquo;
            </span>
          )}
          {sourceStyle && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1"
              style={{ background: sourceStyle.bg, color: sourceStyle.color }}
            >
              <PerriandIcon name={sourceStyle.icon} size={10} color={sourceStyle.color} />
              via {item.source?.name || sourceStyle.label}
            </span>
          )}
          {item.google?.category && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
              style={{ background: 'rgba(200,146,58,0.15)', color: '#7a5e24' }}
            >
              {item.google.category}
            </span>
          )}
          {item.google?.rating && (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: INK['04'], color: 'var(--t-ink)' }}>
              <PerriandIcon name="star" size={11} color="var(--t-chrome-yellow)" />
              {item.google.rating}
              {item.google.reviewCount && (
                <span style={{ color: INK['70'] }}>({item.google.reviewCount.toLocaleString()})</span>
              )}
            </span>
          )}
          {item.google?.priceLevel && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: INK['04'], color: 'var(--t-ink)' }}>
              {'$'.repeat(item.google.priceLevel)}
            </span>
          )}
        </div>

        {/* Description */}
        {item.enrichment?.description && (
          <p className={`${descriptionFontSize} leading-relaxed mb-4`} style={{ color: INK['85'] }}>
            {item.enrichment.description}
          </p>
        )}

        {/* Place details — tile grid */}
        {item.google && (item.google.address || item.google.website || item.google.phone || item.google.placeId || item.google.lat) && (() => {
          const g = item.google as Record<string, unknown> & { placeId?: string; lat?: number; lng?: number; address?: string; website?: string; phone?: string };
          const mapsUrl = g.placeId
            ? `https://www.google.com/maps/place/?q=place_id:${g.placeId}`
            : g.lat && g.lng
              ? `https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lng}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.name} ${item.location}`)}`;
          const tiles: React.ReactNode[] = [];
          if (g.address) tiles.push(<div key="addr" className="flex items-start gap-2 p-3 min-w-0"><PerriandIcon name="pin" size={13} color={INK['50']} /><span className="text-[11px] leading-snug" style={{ color: INK['75'] }}>{g.address}</span></div>);
          if (g.website) tiles.push(<div key="web" className="flex items-center gap-2 p-3 min-w-0"><PerriandIcon name="discover" size={13} color={INK['50']} /><a href={g.website} target="_blank" rel="noopener noreferrer" className="text-[11px] no-underline truncate" style={{ color: '#8a6a2a' }} onClick={(e) => e.stopPropagation()}>{g.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a></div>);
          if (g.phone) tiles.push(<div key="phone" className="flex items-center gap-2 p-3 min-w-0"><PerriandIcon name="sparkle" size={13} color={INK['50']} /><a href={`tel:${g.phone}`} className="text-[11px] no-underline" style={{ color: '#8a6a2a' }} onClick={(e) => e.stopPropagation()}>{g.phone}</a></div>);
          tiles.push(<div key="maps" className="flex items-center gap-2 p-3 min-w-0"><PerriandIcon name="maps" size={13} color={INK['50']} /><a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] no-underline" style={{ color: '#8a6a2a' }} onClick={(e) => e.stopPropagation()}>Google Maps ↗</a></div>);
          return (
            <div className="mb-4 rounded-xl overflow-hidden" style={{ display: 'grid', gridTemplateColumns: `repeat(${tiles.length >= 2 ? 2 : 1}, 1fr)`, gap: 1, background: INK['06'], border: `1px solid ${INK['04']}` }}>
              {tiles.map((tile, i) => (<div key={i} style={{ background: '#fffdf8' }}>{tile}</div>))}
            </div>
          );
        })()}

        {/* Enrichment warnings */}
        {item.enrichment?.closedDays && item.enrichment.closedDays.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4" style={{ background: 'rgba(232,104,48,0.12)', border: '1px solid rgba(232,104,48,0.25)' }}>
            <span>⚠️</span>
            <span className={`${isDesktop ? 'text-[12px]' : 'text-[11px]'} font-medium`} style={{ color: '#a04018' }}>Closed {item.enrichment.closedDays.join(', ')}s</span>
          </div>
        )}

        {/* What to order */}
        {item.whatToOrder && item.whatToOrder.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: INK['95'], fontFamily: FONT.mono, letterSpacing: '1px' }}>What to order</div>
            <div className="flex flex-wrap gap-1.5">
              {item.whatToOrder.map((tag, i) => (<div key={i} className={`px-2.5 py-1 rounded-lg ${whatToOrderTagFontSize}`} style={{ background: 'var(--t-linen)', color: 'var(--t-ink)' }}>{tag}</div>))}
            </div>
          </div>
        )}

        {/* Tips */}
        {item.tips && item.tips.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: INK['95'], fontFamily: FONT.mono, letterSpacing: '1px' }}>Tips</div>
            <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--t-linen)' }}>
              {item.tips.map((tip, i) => (<div key={i} className={`${tipsFontSize} leading-relaxed`} style={{ color: 'var(--t-ink)' }}>{tip}</div>))}
            </div>
          </div>
        )}

        {/* Sibling places */}
        {siblingPlaces && siblingPlaces.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: INK['95'], fontFamily: FONT.mono, letterSpacing: '1px' }}>Also from this guide</div>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {siblingPlaces.slice(0, 5).map(sibling => (
                <div key={sibling.id} className={`${siblingCardWidth} rounded-xl p-2.5 flex-shrink-0 card-hover`} style={{ background: 'white', border: '1px solid var(--t-linen)' }}>
                  <div className={`${siblingNameFontSize} font-semibold`} style={{ color: 'var(--t-ink)' }}>{sibling.name}</div>
                  <div className={`${siblingTypeFontSize}`} style={{ color: INK['95'] }}>{sibling.type.charAt(0).toUpperCase() + sibling.type.slice(1)} · {sibling.location.split(',')[0]}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Author's notes */}
        {item.tasteNote && (
          <div className="mb-4" style={{ background: sourceStyle ? `${sourceStyle.color}14` : 'rgba(199,82,51,0.08)', borderLeft: `3px solid ${sourceStyle?.color || '#c75233'}`, padding: '12px 14px', borderRadius: '0 12px 12px 0' }}>
            <div className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: sourceStyle?.color || '#a8422a', fontFamily: FONT.mono }}>{item.source?.name ? `From ${item.source.name}` : 'Source note'}</div>
            <p className={`${tasteNoteFontSize} leading-relaxed`} style={{ color: 'var(--t-ink)' }}>{item.tasteNote}</p>
          </div>
        )}

        {/* Friend attribution */}
        {item.friendAttribution && (
          <div className="mb-4" style={{ background: 'rgba(42,122,86,0.08)', borderLeft: '3px solid var(--t-verde)', padding: '12px 14px', borderRadius: '0 12px 12px 0' }}>
            <div className="text-[9px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1" style={{ color: 'var(--t-verde)', fontFamily: FONT.mono }}>
              <PerriandIcon name="friend" size={12} color="var(--t-verde)" />{item.friendAttribution.name}
            </div>
            {item.friendAttribution.note && <p className={`${friendAttributionFontSize} italic leading-relaxed`} style={{ color: 'var(--t-ink)' }}>&ldquo;{item.friendAttribution.note}&rdquo;</p>}
          </div>
        )}

        {/* Your notes */}
        {existingRating && ratingReaction && (existingRating.tags?.length || existingRating.personalNote || existingRating.contextTags?.length) && (
          <div className="mb-4 px-3 py-2.5 rounded-xl cursor-pointer" style={{ background: `${ratingReaction.color}06`, border: `1px solid ${ratingReaction.color}15` }} onClick={onEditRating || onRate} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (onEditRating || onRate)?.(); } }}>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: ratingReaction.color, fontFamily: FONT.mono }}>
              <PerriandIcon name="edit" size={11} color={ratingReaction.color} />Your notes
            </div>
            {existingRating.tags && existingRating.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {existingRating.tags.map(tag => (<span key={tag} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${ratingReaction.color}12`, color: ratingReaction.color }}>{tag}</span>))}
                {existingRating.returnIntent === 'absolutely' && <span className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: INK['04'], color: INK['90'] }}>Would return <PerriandIcon name="check" size={11} color={INK['90']} /></span>}
              </div>
            )}
            {existingRating.personalNote && <p className={`${yourNotesFontSize} italic mt-1.5`} style={{ color: INK['90'] }}>&ldquo;{existingRating.personalNote}&rdquo;</p>}
          </div>
        )}

        {/* Terrazzo Insights */}
        {item.terrazzoInsight && (
          <div className="flex flex-col gap-3 mb-4">
            <div className="p-3 rounded-xl" style={{ background: 'rgba(42,122,86,0.10)', border: '1px solid rgba(42,122,86,0.20)' }}>
              <h4 className="text-[10px] uppercase tracking-wider font-bold mb-1.5 flex items-center gap-1" style={{ color: '#226848', fontFamily: FONT.mono }}>
                <PerriandIcon name="terrazzo" size={12} color="#226848" />Why You&apos;ll Love It
              </h4>
              <p className={`${terrazzoParagraphFontSize} leading-relaxed`} style={{ color: 'var(--t-ink)' }}>{item.terrazzoInsight.why}</p>
            </div>
            {item.terrazzoInsight.caveat && (
              <div className="p-3 rounded-xl" style={{ background: 'rgba(160,108,40,0.10)', border: '1px solid rgba(160,108,40,0.20)' }}>
                <h4 className="text-[10px] uppercase tracking-wider font-bold mb-1.5" style={{ color: '#7a5518', fontFamily: FONT.mono }}>Heads Up</h4>
                <p className={`${terrazzoParagraphFontSize} leading-relaxed`} style={{ color: 'var(--t-ink)' }}>{item.terrazzoInsight.caveat}</p>
              </div>
            )}
          </div>
        )}

        {/* Match score */}
        <div className="flex items-center gap-3 p-3 rounded-xl mb-4" style={{ background: 'rgba(200,146,58,0.10)', border: '1px solid rgba(200,146,58,0.20)', cursor: onViewBriefing ? 'pointer' : 'default' }} onClick={onViewBriefing} role={onViewBriefing ? 'button' : undefined} tabIndex={onViewBriefing ? 0 : undefined} onKeyDown={onViewBriefing ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewBriefing(); } } : undefined}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${matchScoreFontSize} font-bold flex-shrink-0`} style={{ background: 'linear-gradient(135deg, rgba(200,146,58,0.2), rgba(200,146,58,0.1))', color: '#8a6a2a', fontFamily: FONT.mono }}>{item.matchScore}%</div>
          <div className="flex-1 min-w-0">
            <div className={`${matchScoreLabelFontSize} font-semibold`} style={{ color: 'var(--t-ink)' }}>Taste match</div>
            <div className={`${matchScoreSubFontSize}`} style={{ color: INK['95'] }}>Based on your profile preferences</div>
            {isEnriching && intelData?.latestRun && (<div className="mt-1.5"><PipelineProgress currentStage={intelData.latestRun.currentStage} stagesCompleted={intelData.latestRun.stagesCompleted} startedAt={intelData.latestRun.startedAt} compact /></div>)}
            {onViewBriefing && googlePlaceId && (<button className={`${matchScoreSubFontSize} mt-1 block border-none bg-transparent p-0 cursor-pointer`} style={{ color: '#7a5a20', fontFamily: FONT.mono }} onClick={(e) => { e.stopPropagation(); onViewBriefing(); }}>View full briefing →</button>)}
          </div>
        </div>

        {/* Taste Mosaic */}
        <div className="mb-4">
          <h3 className="text-[10px] uppercase tracking-wider mb-2.5 font-bold" style={{ color: INK['95'], fontFamily: FONT.mono }}>Taste Mosaic</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <TerrazzoMosaic profile={item.matchBreakdown} size="md" />
            <MosaicLegend profile={item.matchBreakdown} style={{ gridTemplateColumns: 'repeat(2, auto)', gap: '6px 14px' }} />
          </div>
        </div>

        {/* Rate button */}
        {onRate && (
          <button
            onClick={onRate}
            className={`w-full mt-6 py-3.5 rounded-xl border-none cursor-pointer ${rateButtonFontSize} font-semibold ${rateButtonHoverClass}`}
            style={{
              background: existingRating ? INK['06'] : 'var(--t-ink)',
              color: existingRating ? 'var(--t-ink)' : 'var(--t-cream)',
              fontFamily: FONT.sans,
            }}
          >
            {existingRating ? 'Update your rating' : 'Rate this place'}
          </button>
        )}

        {/* Delete from library */}
        {onDelete && !isPreview && (
          <button
            onClick={onDelete}
            className="w-full mt-3 py-2.5 rounded-xl cursor-pointer text-[12px]"
            style={{
              background: 'none',
              border: 'none',
              color: INK['40'],
              fontFamily: FONT.sans,
              fontWeight: 500,
            }}
          >
            Remove from library
          </button>
        )}
      </div>
    </>
  );
}

export default memo(PlaceDetailContent);

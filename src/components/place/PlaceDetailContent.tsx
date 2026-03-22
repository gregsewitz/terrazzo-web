'use client';

import React, { memo } from 'react';
import { ImportedPlace, ImportSourceEntry, DOMAIN_COLORS, DOMAIN_ICONS, TasteDomain } from '@/types';
import { getPlaceImage } from '@/constants/placeImages';
import { PHOTO_GRADIENTS, TYPE_BRAND_COLORS, TYPE_ICONS } from '@/constants/placeTypes';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { TerrazzoMosaic, MosaicLegend } from '@/components/profile/TerrazzoMosaic';
import PipelineProgress from '@/components/place/PipelineProgress';
import { COLOR, FONT, INK, TEXT } from '@/constants/theme';
import PlacePhoto from '@/components/place/PlacePhoto';
import SustainabilityBadge from '@/components/profile/SustainabilityBadge';
import AccoladesSection from '@/components/place/AccoladesSection';
import { SafeFadeIn } from '@/components/animations/SafeFadeIn';
import { FadeInSection, StaggerContainer, StaggerItem, AnimatedBar } from '@/components/animations/AnimatedElements';
import { getMatchTier } from '@/lib/match-tier';
import { SignalResonanceStrip, OverlapMosaic, DeepMatchBreakdown } from '@/components/intelligence';
import type { ResonanceCluster, DeepMatch, DeepMatchSignal } from '@/components/intelligence';
import { getDisplayLocation } from '@/lib/place-display';
import { usePlaceDetailData } from '@/hooks/usePlaceDetailData';
import { ReliabilityBreakdown } from '@/components/briefing-view/ReliabilityBreakdown';

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

const TASTE_DOMAINS: TasteDomain[] = ['Design', 'Atmosphere', 'Character', 'Service', 'FoodDrink', 'Setting', 'Wellness', 'Sustainability'];

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
  const {
    resolvedItem,
    hydratedMatchScore,
    hydratedBreakdown,
    hydratedGoogle,
    hydratedLocation,
    userTasteProfile,
    effectiveGooglePlaceId,
    intelData,
    isEnriching,
    isPrivateListing,
    saved,
    handleSave,
    memberCollections,
    isInCollections,
    existingRating,
    ratingReaction,
    sourceStyle,
  } = usePlaceDetailData(item);

  // Variant-specific styles
  const isDesktop = variant === 'desktop';
  const photoHeight = isDesktop ? 320 : 240;
  const containerPadding = isDesktop ? 'px-8 pb-8' : 'px-5 pb-24';
  const containerMarginTop = isDesktop ? 'mt-5' : 'mt-4';
  const nameFontSize = isDesktop ? 'text-[28px]' : 'text-[24px]';
  const locationFontSize = isDesktop ? 'text-[14px]' : 'text-[13px]';
  const akaFontSize = isDesktop ? 'text-[13px]' : 'text-[12px]';
  const descriptionFontSize = isDesktop ? 'text-[15px]' : 'text-[14px]';
  const whatToOrderTagFontSize = isDesktop ? 'text-[14px]' : 'text-[13px]';
  const tipsFontSize = isDesktop ? 'text-[14px]' : 'text-[13px]';
  const siblingCardWidth = isDesktop ? 'min-w-[140px]' : 'min-w-[120px]';
  const siblingNameFontSize = isDesktop ? 'text-[14px]' : 'text-[13px]';
  const siblingTypeFontSize = isDesktop ? 'text-[12px]' : 'text-[11px]';
  const tasteNoteFontSize = isDesktop ? 'text-[15px]' : 'text-[14px]';
  const personalNoteFontSize = isDesktop ? 'text-[15px]' : 'text-[14px]';
  const yourNotesFontSize = isDesktop ? 'text-[14px]' : 'text-[13px]';
  const terrazzoParagraphFontSize = isDesktop ? 'text-[14px]' : 'text-[13px]';
  const matchScoreSubFontSize = isDesktop ? 'text-[13px]' : 'text-[12px]';
  const rateButtonFontSize = isDesktop ? 'text-[16px]' : 'text-[15px]';
  const saveButtonFontSize = isDesktop ? 'text-[16px]' : 'text-[15px]';

  const ratingBadgeIconSize = isDesktop ? 14 : 13;
  const ratingBadgeFontSize = isDesktop ? 'text-[12px]' : 'text-[11px]';
  const collectionBadgeIconSize = isDesktop ? 12 : 11;
  const collectionBadgeFontSize = isDesktop ? 'text-[12px]' : 'text-[11px]';
  const closeButtonHoverClass = isDesktop ? 'btn-hover' : '';
  const saveButtonHoverClass = isDesktop ? 'transition-all btn-hover' : 'transition-all hover:opacity-90';
  const rateButtonHoverClass = isDesktop ? 'btn-hover' : 'transition-all hover:opacity-90';
  const ratingBadgeHoverClass = isDesktop ? 'btn-hover' : 'transition-all hover:scale-[1.02]';
  const collectionBadgeHoverClass = isDesktop ? 'btn-hover' : 'transition-all hover:scale-[1.02]';

  return (
    <>
      {/* Photo header — taller with gradient overlay for depth */}
      <div
        className="relative flex-shrink-0 overflow-hidden"
        style={{
          height: photoHeight,
          background: PHOTO_GRADIENTS[item.type] || PHOTO_GRADIENTS.restaurant,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {getPlaceImage(item.name) ? (
          <PlacePhoto
            src={getPlaceImage(item.name)}
            alt={item.name}
            fill
            sizes={isDesktop ? '440px' : '100vw'}
            style={{ position: 'absolute', top: 0, left: 0 }}
          />
        ) : (
          <PerriandIcon
            name={TYPE_ICONS[item.type] || 'pin'}
            size={48}
            color={TYPE_BRAND_COLORS[item.type] || COLOR.navy}
          />
        )}
        {/* Gradient overlay for text legibility */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(0,42,85,0.55) 0%, rgba(0,42,85,0.15) 40%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        {/* Close/back button */}
        <button
          onClick={onClose}
          className={`absolute flex items-center justify-center border-none cursor-pointer ${closeButtonHoverClass}`}
          style={{
            ...(isDesktop ? { top: 16, right: 16 } : { top: 56, left: 16 }),
            width: isDesktop ? 36 : 32,
            height: isDesktop ? 36 : 32,
            borderRadius: '50%',
            background: 'rgba(0,42,85,0.45)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            color: 'white',
            fontSize: isDesktop ? 16 : 14,
            transition: 'background 150ms ease',
          }}
          onMouseEnter={e => isDesktop && (e.currentTarget.style.background = 'rgba(0,42,85,0.6)')}
          onMouseLeave={e => isDesktop && (e.currentTarget.style.background = 'rgba(0,42,85,0.45)')}
          aria-label="Close"
        >
          {isDesktop ? 'x' : '<'}
        </button>
        {/* Overlaid name + action badges + metadata on photo */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-4" style={{ pointerEvents: 'auto' }}>
          <h2
            className={`${isDesktop ? 'text-[28px]' : 'text-[26px]'} italic leading-tight`}
            style={{ fontFamily: FONT.serif, color: 'white', margin: 0, textShadow: '0 1px 8px rgba(0,0,0,0.3)' }}
          >
            {item.name}
          </h2>

          {/* Location subtitle */}
          <div className={`${locationFontSize} mt-1.5`} style={{ color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
            {hydratedLocation}
            {item.alsoKnownAs && (
              <span style={{ color: 'rgba(255,255,255,0.65)' }}> · aka {"\u201C"}{item.alsoKnownAs}{"\u201D"}</span>
            )}
          </div>

          {/* Unified chips row — all use same frosted style */}
          {(() => {
            const chipStyle = {
              background: 'rgba(255,255,255,0.22)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.28)',
              color: 'white',
              fontFamily: FONT.mono,
            } as const;
            // Merge Terrazzo type + Google category into a single label.
            // Use the Google category when it's more specific; fall back to Terrazzo type.
            const rawCategory = hydratedGoogle?.category || '';
            const normalizedCategory = rawCategory.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            const placeType = item.type.charAt(0).toUpperCase() + item.type.slice(1);
            const GENERIC_CATEGORIES = new Set([
              'establishment', 'point of interest', 'store', 'food', 'place',
              'local business', 'business', 'health', 'general contractor',
            ]);
            const categoryIsGeneric = !normalizedCategory ||
              GENERIC_CATEGORIES.has(normalizedCategory.toLowerCase()) ||
              normalizedCategory.toLowerCase() === item.type.toLowerCase() ||
              normalizedCategory.toLowerCase().includes(item.type.toLowerCase()) ||
              item.type.toLowerCase().includes(normalizedCategory.toLowerCase().replace(/\s+/g, ''));
            // Show Google category when it adds specificity; otherwise show Terrazzo type
            const displayType = categoryIsGeneric ? placeType : normalizedCategory;
            return (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {/* Place type (merged with Google category) */}
                <span className="text-[12px] font-semibold px-2 py-1 rounded-lg flex items-center gap-1" style={chipStyle}>
                  {displayType}
                </span>

                {/* Google rating */}
                {hydratedGoogle?.rating && (
                  <span className="text-[12px] font-semibold px-2 py-1 rounded-lg flex items-center gap-1" style={chipStyle}>
                    <PerriandIcon name="star" size={10} color="var(--t-chrome-yellow)" />
                    {hydratedGoogle.rating}
                    {hydratedGoogle.reviewCount != null && hydratedGoogle.reviewCount > 0 && (
                      <span style={{ color: 'rgba(255,255,255,0.65)' }}>({hydratedGoogle.reviewCount.toLocaleString()})</span>
                    )}
                  </span>
                )}

                {/* Price level */}
                {hydratedGoogle?.priceLevel && (
                  <span className="text-[12px] font-semibold px-2 py-1 rounded-lg" style={chipStyle}>
                    {'$'.repeat(hydratedGoogle.priceLevel)}
                  </span>
                )}

                {/* Source attribution */}
                {sourceStyle && item.source?.name && (
                  <span className="text-[12px] font-semibold px-2 py-1 rounded-lg flex items-center gap-1" style={chipStyle}>
                    <PerriandIcon name={sourceStyle.icon} size={10} color="white" />
                    via {item.source.name}
                  </span>
                )}

                {/* Rating badge */}
                {existingRating && ratingReaction ? (
                  <button
                    onClick={onRate}
                    className={`text-[12px] font-semibold px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer border-none ${ratingBadgeHoverClass}`}
                    style={chipStyle}
                  >
                    <PerriandIcon name={ratingReaction.icon} size={ratingBadgeIconSize} color="white" />
                    {ratingReaction.label}
                  </button>
                ) : onRate && !isPreview ? (
                  <button
                    onClick={onRate}
                    className={`text-[12px] font-semibold px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer border-none ${ratingBadgeHoverClass}`}
                    style={chipStyle}
                  >
                    <PerriandIcon name="star" size={isDesktop ? 12 : 11} color="white" />
                    Rate
                  </button>
                ) : null}

                {/* Collection badge */}
                {!isPreview && onCollectionTap && (
                  <button
                    onClick={onCollectionTap}
                    className={`text-[12px] font-semibold px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer border-none ${collectionBadgeHoverClass}`}
                    style={{
                      ...chipStyle,
                      background: isInCollections ? 'rgba(58,128,136,0.4)' : chipStyle.background,
                      border: isInCollections ? '1px solid rgba(58,128,136,0.5)' : chipStyle.border,
                    }}
                  >
                    <PerriandIcon name="bookmark" size={collectionBadgeIconSize} color="white" />
                    {isInCollections ? `${memberCollections.length} list${memberCollections.length > 1 ? 's' : ''}` : 'Save'}
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Scrollable content */}
      <div className={`flex-1 overflow-y-auto ${containerPadding}`}>
        {/* Save CTA for previews */}
        {isPreview && onSave && (
          <SafeFadeIn direction="up" distance={12} duration={0.4}>
            <button
              onClick={onSave}
              className={`w-full mb-3 py-3 rounded-xl border-none cursor-pointer ${saveButtonFontSize} font-semibold ${saveButtonHoverClass} flex items-center justify-center gap-2 ${containerMarginTop}`}
              style={{
                background: saved ? INK['06'] : 'var(--t-ink)',
                color: saved ? TEXT.primary : TEXT.inverse,
                fontFamily: FONT.sans,
              }}
            >
              <PerriandIcon name={saved ? 'check' : 'add'} size={14} color={saved ? TEXT.primary : TEXT.inverse} />
              {saved ? 'Saved to library' : 'Save to library'}
            </button>
          </SafeFadeIn>
        )}

        {/* ── Practical info ── */}

        {/* Place details — tile grid */}
        {hydratedGoogle && (hydratedGoogle.address || hydratedGoogle.website || hydratedGoogle.phone || hydratedGoogle.placeId || hydratedGoogle.lat) && (() => {
          const g = hydratedGoogle as Record<string, unknown> & { placeId?: string; lat?: number; lng?: number; address?: string; website?: string; phone?: string };
          const mapsUrl = g.placeId
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name)}&query_place_id=${g.placeId}`
            : g.lat && g.lng
              ? `https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lng}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.name} ${item.location}`)}`;
          const tiles: React.ReactNode[] = [];
          if (g.address) tiles.push(<div key="addr" className="flex items-start gap-2.5 p-3.5 min-w-0"><PerriandIcon name="pin" size={13} color={TEXT.secondary} /><span className="text-[13px] leading-snug" style={{ color: TEXT.primary }}>{g.address}</span></div>);
          if (g.website) tiles.push(<div key="web" className="flex items-center gap-2.5 p-3.5 min-w-0"><PerriandIcon name="discover" size={13} color={TEXT.secondary} /><a href={g.website} target="_blank" rel="noopener noreferrer" className="text-[13px] no-underline truncate" style={{ color: TEXT.accent }} onClick={(e) => e.stopPropagation()}>{g.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a></div>);
          if (g.phone) tiles.push(<div key="phone" className="flex items-center gap-2.5 p-3.5 min-w-0"><PerriandIcon name="sparkle" size={13} color={TEXT.secondary} /><a href={`tel:${g.phone}`} className="text-[13px] no-underline" style={{ color: TEXT.accent }} onClick={(e) => e.stopPropagation()}>{g.phone}</a></div>);
          tiles.push(<div key="maps" className="flex items-center gap-2.5 p-3.5 min-w-0"><PerriandIcon name="maps" size={13} color={TEXT.secondary} /><a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] no-underline" style={{ color: TEXT.accent }} onClick={(e) => e.stopPropagation()}>Google Maps</a></div>);
          return (
            <SafeFadeIn direction="up" distance={12} duration={0.5} delay={0.2}>
              <div className={`mb-5 rounded-2xl overflow-hidden ${containerMarginTop}`} style={{ display: 'grid', gridTemplateColumns: `repeat(${tiles.length >= 2 ? 2 : 1}, 1fr)`, gap: 1, background: INK['06'], border: `1px solid ${INK['04']}` }}>
                {tiles.map((tile, i) => (<div key={i} style={{ background: '#fffdf8' }}>{tile}</div>))}
              </div>
            </SafeFadeIn>
          );
        })()}

        {/* ── Borderless sections with bar headers ── */}
        {/* Shared divider style between sections */}

        {/* Closed days warning — standalone alert, uses Dark Teal */}
        {item.enrichment?.closedDays && item.enrichment.closedDays.length > 0 && (
          <SafeFadeIn direction="up" distance={10} duration={0.4}>
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl mb-2" style={{ background: `${COLOR.darkTeal}14` }}>
              <PerriandIcon name="alert" size={14} color={COLOR.darkTeal} />
              <span className={`${isDesktop ? 'text-[14px]' : 'text-[13px]'} font-medium`} style={{ color: COLOR.darkTeal }}>Closed {item.enrichment.closedDays.join(', ')}s</span>
            </div>
          </SafeFadeIn>
        )}

        {/* Description — flows naturally, no header */}
        {item.enrichment?.description && (
          <SafeFadeIn direction="up" distance={12} duration={0.5} delay={0.15}>
            <p className={`${descriptionFontSize} leading-relaxed py-4`} style={{ color: TEXT.primary, borderBottom: `1px solid ${INK['06']}` }}>
              {item.enrichment.description}
            </p>
          </SafeFadeIn>
        )}

        {/* Personal note */}
        {resolvedItem.userContext && (
          <FadeInSection delay={0.05} direction="up" distance={14}>
            <div className="py-4" style={{ borderBottom: `1px solid ${INK['06']}` }}>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-2 -mx-1" style={{ background: `${COLOR.ochre}14`, color: COLOR.ochre, fontFamily: FONT.display, fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR.ochre, flexShrink: 0 }} />
                Personal Note
              </div>
              <p className={`${personalNoteFontSize} italic leading-relaxed`} style={{ color: TEXT.primary }}>{"\u201C"}{resolvedItem.userContext}{"\u201D"}</p>
            </div>
          </FadeInSection>
        )}

        {/* Your notes — tags + personal note from rating */}
        {existingRating && ratingReaction && (existingRating.tags?.length || existingRating.personalNote || existingRating.contextTags?.length) && (
          <FadeInSection delay={0.05} direction="up" distance={14}>
            <button type="button" className="py-4 cursor-pointer w-full text-left bg-transparent border-0 px-0" style={{ borderBottom: `1px solid ${INK['06']}` }} onClick={onEditRating || onRate}>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-2 -mx-1" style={{ background: `${ratingReaction.color}0a`, color: ratingReaction.color, fontFamily: FONT.display, fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: ratingReaction.color, flexShrink: 0 }} />
                <PerriandIcon name="edit" size={10} color={ratingReaction.color} />
                Your Notes
              </div>
              {existingRating.tags && existingRating.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {existingRating.tags.map(tag => (<span key={tag} className="text-[12px] px-2 py-0.5 rounded-full" style={{ background: `${ratingReaction.color}12`, color: ratingReaction.color }}>{tag}</span>))}
                  {existingRating.returnIntent === 'absolutely' && <span className="text-[12px] px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: INK['04'], color: TEXT.primary }}>Would return <PerriandIcon name="check" size={11} color={TEXT.primary} /></span>}
                </div>
              )}
              {existingRating.personalNote && <p className={`${yourNotesFontSize} italic mt-1.5`} style={{ color: TEXT.primary }}>{"\u201C"}{existingRating.personalNote}{"\u201D"}</p>}
            </button>
          </FadeInSection>
        )}

        {/* Your Visits — reservation history from email imports */}
        {(() => {
          const visits = (resolvedItem.existingImportSources || [])
            .filter((s: ImportSourceEntry) => s.type === 'email' && s.importedAt) as ImportSourceEntry[];
          if (visits.length === 0) return null;

          // Sort most recent first
          const sorted = [...visits].sort((a, b) =>
            new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
          );

          // Determine if visits are upcoming or past
          const now = new Date();

          return (
            <FadeInSection delay={0.05} direction="up" distance={14}>
              <div className="py-4" style={{ borderBottom: `1px solid ${INK['06']}` }}>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-2 -mx-1" style={{ background: `${COLOR.periwinkle}14`, color: COLOR.periwinkle, fontFamily: FONT.display, fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR.periwinkle, flexShrink: 0 }} />
                  <PerriandIcon name="calendar" size={10} color={COLOR.periwinkle} />
                  Your Visits
                </div>
                <div className="flex flex-col gap-2">
                  {sorted.map((visit, i) => {
                    const visitDate = new Date(visit.importedAt);
                    const isPast = visitDate < now;
                    const dateStr = visitDate.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: visitDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
                    });
                    // Extract provider from the "Provider: Subject" name format
                    const provider = visit.name?.split(':')[0]?.trim() || 'Email';

                    return (
                      <div key={i} className="flex items-start gap-3 py-1.5" style={{ borderTop: i > 0 ? `1px solid ${INK['04']}` : 'none' }}>
                        <div className="flex-shrink-0 mt-0.5">
                          <PerriandIcon
                            name={isPast ? 'check' : 'calendar'}
                            size={12}
                            color={isPast ? COLOR.olive : COLOR.periwinkle}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-[13px] font-medium" style={{ color: TEXT.primary, fontFamily: FONT.sans }}>
                              {dateStr}
                            </span>
                            <span className="text-[11px]" style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
                              via {provider}
                            </span>
                          </div>
                          {visit.bookingDetails && (
                            <p className="text-[12px] mt-0.5" style={{ color: TEXT.secondary, fontFamily: FONT.sans }}>
                              {visit.bookingDetails}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </FadeInSection>
          );
        })()}

        {/* Accolades — awards, editorial lists, memberships, certifications */}
        {(() => {
          const accolades = (intelData as any)?.accolades || item.accolades;
          return accolades && accolades.length > 0 ? (
            <AccoladesSection accolades={accolades} placeType={item.type} variant={variant} />
          ) : null;
        })()}

        {/* Why You'll Love It */}
        {item.terrazzoInsight && (
          <FadeInSection delay={0.1} direction="up" distance={16}>
            <div className="py-4" style={{ borderBottom: `1px solid ${INK['06']}` }}>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-2 -mx-1" style={{ background: `${COLOR.mint}18`, color: COLOR.darkTeal, fontFamily: FONT.display, fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR.darkTeal, flexShrink: 0 }} />
                <PerriandIcon name="terrazzo" size={10} color={COLOR.darkTeal} />
                Why You{"'"}ll Love It
              </div>
              <p className={`${terrazzoParagraphFontSize} leading-relaxed`} style={{ color: TEXT.primary }}>{item.terrazzoInsight.why}</p>
              {item.terrazzoInsight.caveat && (
                <div className="mt-4">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-2 -mx-1" style={{ background: `${COLOR.coral}14`, color: COLOR.coral, fontFamily: FONT.display, fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR.coral, flexShrink: 0 }} />
                    Heads Up
                  </div>
                  <p className={`${terrazzoParagraphFontSize} leading-relaxed`} style={{ color: TEXT.primary }}>{item.terrazzoInsight.caveat}</p>
                </div>
              )}
            </div>
          </FadeInSection>
        )}

        {/* What to order */}
        {item.whatToOrder && item.whatToOrder.length > 0 && (
          <FadeInSection delay={0.1} direction="up" distance={16}>
            <div className="py-4" style={{ borderBottom: `1px solid ${INK['06']}` }}>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-2 -mx-1" style={{ background: `${COLOR.navy}0c`, color: COLOR.navy, fontFamily: FONT.display, fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR.navy, flexShrink: 0 }} />
                What to Order
              </div>
              <StaggerContainer className="flex flex-wrap gap-1.5" staggerDelay={0.06}>
                {item.whatToOrder.map((tag, i) => (
                  <StaggerItem key={i}>
                    <div className={`px-2.5 py-1 rounded-lg ${whatToOrderTagFontSize}`} style={{ background: 'var(--t-linen)', color: TEXT.primary }}>{tag}</div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
          </FadeInSection>
        )}

        {/* Tips */}
        {item.tips && item.tips.length > 0 && (
          <FadeInSection delay={0.1} direction="up" distance={16}>
            <div className="py-4" style={{ borderBottom: `1px solid ${INK['06']}` }}>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-2 -mx-1" style={{ background: `${COLOR.olive}14`, color: COLOR.olive, fontFamily: FONT.display, fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR.olive, flexShrink: 0 }} />
                Tips
              </div>
              <div className="flex flex-col gap-1">
                {item.tips.map((tip, i) => (<div key={i} className={`${tipsFontSize} leading-relaxed py-1`} style={{ color: TEXT.primary, borderTop: i > 0 ? `1px solid ${INK['04']}` : 'none', paddingTop: i > 0 ? 6 : 0 }}>{tip}</div>))}
              </div>
            </div>
          </FadeInSection>
        )}

        {/* Sibling places */}
        {siblingPlaces && siblingPlaces.length > 0 && (
          <FadeInSection delay={0.1} direction="up" distance={16}>
            <div className="py-4" style={{ borderBottom: `1px solid ${INK['06']}` }}>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-2 -mx-1" style={{ background: `${COLOR.peach}20`, color: COLOR.charcoal, fontFamily: FONT.display, fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR.peach, flexShrink: 0 }} />
                Also from This Guide
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {siblingPlaces.slice(0, 5).map(sibling => (
                  <div key={sibling.id} className={`${siblingCardWidth} rounded-2xl p-3 flex-shrink-0 card-hover`} style={{ background: 'white', border: '1px solid var(--t-linen)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div className={`${siblingNameFontSize} font-semibold`} style={{ color: TEXT.primary }}>{sibling.name}</div>
                    <div className={`${siblingTypeFontSize} mt-0.5`} style={{ color: TEXT.secondary }}>{sibling.type.charAt(0).toUpperCase() + sibling.type.slice(1)}{(() => { const dl = getDisplayLocation(sibling.location, sibling.name); return dl ? ` · ${dl}` : ''; })()}</div>
                  </div>
                ))}
              </div>
            </div>
          </FadeInSection>
        )}

        {/* Google editorial summary */}
        {item.google?.editorialSummary && (
          <FadeInSection delay={0.05} direction="up" distance={14}>
            <div className="py-4" style={{ borderBottom: `1px solid ${INK['06']}` }}>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-2 -mx-1" style={{ background: `${COLOR.periwinkle}14`, color: COLOR.periwinkle, fontFamily: FONT.display, fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR.periwinkle, flexShrink: 0 }} />
                Google Places
              </div>
              <p className={`${tasteNoteFontSize} leading-relaxed`} style={{ color: TEXT.primary }}>{item.google.editorialSummary}</p>
            </div>
          </FadeInSection>
        )}

        {/* Taste Match — combined section: score, mosaic, signal resonance */}
        {!isPrivateListing ? (
          <FadeInSection delay={0.15} direction="up" distance={18}>
            <div className="py-4" style={{ borderBottom: `1px solid ${INK['06']}` }}>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-2 -mx-1" style={{ background: `${COLOR.coral}14`, color: COLOR.coral, fontFamily: FONT.display, fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR.coral, flexShrink: 0 }} />
                Taste Match
              </div>

              {/* 1. Match tier badge */}
              {(() => {
                const tier = getMatchTier(hydratedMatchScore);
                return (
                  <div className="flex items-center gap-2.5 mb-3">
                    <span
                      className="px-2.5 py-1 rounded-lg text-[13px] font-bold"
                      style={{ background: tier.bg, color: tier.color, fontFamily: FONT.mono }}
                    >
                      {tier.label}
                    </span>
                    {isEnriching && (
                      intelData?.latestRun
                        ? <PipelineProgress currentStage={intelData.latestRun.currentStage} stagesCompleted={intelData.latestRun.stagesCompleted} startedAt={intelData.latestRun.startedAt} compact />
                        : <span className={`${matchScoreSubFontSize}`} style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>Researching this place…</span>
                    )}
                  </div>
                );
              })()}

              {/* 2. Narrative explanation */}
              {resolvedItem.matchExplanation?.narrative && (
                <p
                  className={`${isDesktop ? 'text-[15px]' : 'text-[14px]'} leading-relaxed mb-4`}
                  style={{ color: TEXT.secondary, fontFamily: FONT.sans }}
                >
                  {resolvedItem.matchExplanation.narrative}
                </p>
              )}

              {/* 3. Taste mosaic / overlap */}
              <div className="mb-4" style={{ borderTop: `1px solid ${INK['04']}`, paddingTop: 12 }}>
                {userTasteProfile ? (
                  <OverlapMosaic
                    userProfile={userTasteProfile}
                    placeProfile={hydratedBreakdown}
                    matchScore={hydratedMatchScore}
                    size="md"
                    userLabel="Your taste"
                    placeLabel={item.name.length > 16 ? item.name.slice(0, 14) + '...' : item.name}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <TerrazzoMosaic profile={hydratedBreakdown} size="md" />
                    <MosaicLegend profile={hydratedBreakdown} style={{ gridTemplateColumns: 'repeat(2, auto)', gap: '6px 14px' }} />
                  </div>
                )}
              </div>

              {/* 4. Signal resonance — expanded clusters */}
              {resolvedItem.matchExplanation?.topClusters && resolvedItem.matchExplanation.topClusters.length > 0 && (
                <div style={{ borderTop: `1px solid ${INK['04']}`, paddingTop: 12 }}>
                  <SignalResonanceStrip
                    clusters={resolvedItem.matchExplanation.topClusters.map(c => ({
                      label: c.label,
                      domain: c.domain as TasteDomain,
                      score: c.score,
                      signals: c.signals,
                    }))}
                    variant="full"
                    layout={isDesktop ? 'desktop' : 'mobile'}
                  />
                </div>
              )}

              {onViewBriefing && effectiveGooglePlaceId && (<button className={`${matchScoreSubFontSize} mt-3 block border-none bg-transparent p-0 cursor-pointer`} style={{ color: COLOR.ochre, fontFamily: FONT.mono }} onClick={(e) => { e.stopPropagation(); onViewBriefing(); }}>View full briefing</button>)}
            </div>
          </FadeInSection>
        ) : (
          <FadeInSection delay={0.15} direction="up" distance={18}>
            <div className="py-4" style={{ borderBottom: `1px solid ${INK['06']}` }}>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-2 -mx-1" style={{ background: `${COLOR.warmGray}14`, color: COLOR.warmGray, fontFamily: FONT.display, fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR.warmGray, flexShrink: 0 }} />
                Private Listing
              </div>
              <p className={`${matchScoreSubFontSize} leading-relaxed`} style={{ color: TEXT.secondary, fontFamily: FONT.mono }}>
                Taste matching isn{"'"}t available for private rentals and listings
              </p>
            </div>
          </FadeInSection>
        )}

        {/* Reliability breakdown — category-level trust scores */}
        {!isPrivateListing && intelData?.reliability && Object.keys((intelData.reliability as Record<string, unknown>)?.categories || {}).length > 0 && (
          <FadeInSection delay={0.12} direction="up" distance={16}>
            <div className="py-4" style={{ borderBottom: `1px solid ${INK['06']}` }}>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-2 -mx-1" style={{ background: `${COLOR.navy}0c`, color: COLOR.navy, fontFamily: FONT.display, fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR.navy, flexShrink: 0 }} />
                Reliability by Category
              </div>
              <ReliabilityBreakdown reliability={intelData.reliability as Parameters<typeof ReliabilityBreakdown>[0]['reliability']} />
            </div>
          </FadeInSection>
        )}

        {/* Deep match breakdown — for 93%+ matches with signal data */}
        {!isPrivateListing && hydratedMatchScore >= 93 && resolvedItem.matchExplanation?.topClusters && (
          <FadeInSection delay={0.14} direction="up" distance={18}>
            <div className="py-4" style={{ borderBottom: `1px solid ${INK['06']}` }}>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-2 -mx-1" style={{ background: `${COLOR.ochre}14`, color: COLOR.ochre, fontFamily: FONT.display, fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR.ochre, flexShrink: 0 }} />
                Deep Match
              </div>
              <DeepMatchBreakdown
                match={{
                  name: item.name,
                  location: hydratedLocation || '',
                  matchTier: getMatchTier(hydratedMatchScore).label,
                  headline: resolvedItem.matchExplanation.narrative || '',
                  signalBreakdown: resolvedItem.matchExplanation.topClusters.slice(0, 4).map(c => ({
                    signal: c.label,
                    domain: c.domain as TasteDomain,
                    tierLabel: getMatchTier(c.score).shortLabel,
                    note: c.signals.join(', '),
                  })),
                  googlePlaceId: effectiveGooglePlaceId,
                }}
                variant={isDesktop ? 'desktop' : 'mobile'}
              />
            </div>
          </FadeInSection>
        )}

        {/* Sustainability alignment */}
        {item.sustainabilityScore !== undefined && item.sustainabilityScore > 0 && (
          <FadeInSection delay={0.1} direction="up" distance={16}>
            <div className="py-4" style={{ borderBottom: `1px solid ${INK['06']}` }}>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-2 -mx-1" style={{ background: `${COLOR.olive}14`, color: COLOR.olive, fontFamily: FONT.display, fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' as const }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR.olive, flexShrink: 0 }} />
                Sustainability
              </div>
              <SustainabilityBadge
                sensitivity={
                  item.sustainabilityScore >= 0.75 ? 'LEADING'
                    : item.sustainabilityScore >= 0.5 ? 'CONSCIOUS'
                      : item.sustainabilityScore >= 0.25 ? 'PASSIVE'
                        : 'INDIFFERENT'
                }
                score={Math.round(item.sustainabilityScore * 100)}
              />
            </div>
          </FadeInSection>
        )}

        {/* Rate button */}
        {onRate && (
          <SafeFadeIn direction="up" distance={10} duration={0.5} delay={0.2}>
            <button
              onClick={onRate}
              className={`w-full mt-6 py-3.5 rounded-xl border-none cursor-pointer ${rateButtonFontSize} font-semibold ${rateButtonHoverClass}`}
              style={{
                background: existingRating ? INK['06'] : 'var(--t-ink)',
                color: existingRating ? TEXT.primary : TEXT.inverse,
                fontFamily: FONT.sans,
              }}
            >
              {existingRating ? 'Update your rating' : 'Rate this place'}
            </button>
          </SafeFadeIn>
        )}

        {/* Delete from library */}
        {onDelete && !isPreview && (
          <button
            onClick={onDelete}
            className="w-full mt-3 py-2.5 rounded-xl cursor-pointer text-[14px]"
            style={{
              background: 'none',
              border: 'none',
              color: TEXT.secondary,
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

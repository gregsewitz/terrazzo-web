'use client';

import React, { useState, useEffect, memo } from 'react';
import { ImportedPlace, DOMAIN_COLORS, DOMAIN_ICONS, TasteDomain, REACTIONS, SOURCE_STYLES, GhostSourceType, GooglePlaceData } from '@/types';
import { apiFetch } from '@/lib/api-client';
import { useSavedStore } from '@/stores/savedStore';
import { useBriefing } from '@/hooks/useBriefing';
import { getPlaceImage } from '@/constants/placeImages';
import { PHOTO_GRADIENTS } from '@/constants/placeTypes';
import { PerriandIcon } from '@/components/icons/PerriandIcons';
import { TerrazzoMosaic, MosaicLegend } from '@/components/TerrazzoMosaic';
import PipelineProgress from '@/components/PipelineProgress';
import { FONT, INK } from '@/constants/theme';
import PlacePhoto from '@/components/PlacePhoto';
import SustainabilityBadge from '@/components/profile/SustainabilityBadge';
import { SafeFadeIn } from '@/components/animations/SafeFadeIn';
import { FadeInSection, StaggerContainer, StaggerItem, AnimatedBar, AnimatedNumber, AnimatedScoreArc } from '@/components/animations/AnimatedElements';
import { SignalResonanceStrip, OverlapMosaic, DeepMatchBreakdown } from '@/components/intelligence';
import type { ResonanceCluster, DeepMatch, DeepMatchSignal } from '@/components/intelligence';
import { useOnboardingStore } from '@/stores/onboardingStore';

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
  const existingRating = item.rating;
  const ratingReaction = existingRating ? REACTIONS.find(r => r.id === existingRating.reaction) : null;
  const sourceStyle = item.ghostSource ? SOURCE_STYLES[item.ghostSource as GhostSourceType] : null;
  const addPlace = useSavedStore(s => s.addPlace);
  const myPlaces = useSavedStore(s => s.myPlaces);
  const generatedProfile = useOnboardingStore(s => s.generatedProfile);

  // Derive user's numeric taste profile for overlap mosaic
  const userTasteProfile = React.useMemo(() => {
    const radarData = (generatedProfile as { radarData?: { axis: string; value: number }[] } | null)?.radarData;
    if (!radarData) return null;
    const result: ImportedPlace['matchBreakdown'] = { Design: 0.5, Atmosphere: 0.5, Character: 0.5, Service: 0.5, FoodDrink: 0.5, Setting: 0.5, Wellness: 0.5, Sustainability: 0.5 };
    for (const r of radarData) {
      if (r.axis in result) {
        result[r.axis as keyof typeof result] = Math.max(result[r.axis as keyof typeof result], r.value);
      }
    }
    return result;
  }, [generatedProfile]);
  const collections = useSavedStore(s => s.collections);
  const [saved, setSaved] = useState(myPlaces.some(p => p.name === item.name));
  const memberCollections = collections.filter(sl => sl.placeIds.includes(item.id));
  const isInCollections = memberCollections.length > 0;

  // ─── Hydrate preview places from the resolve API ───
  // When opened from discover feed, the item only has name/location/googlePlaceId.
  // Resolve fills in matchScore, matchBreakdown, google data, etc.
  // Also handles editorial cards that only have name/location (no googlePlaceId) —
  // the resolve endpoint supports name-based lookup as a fallback.
  const [resolvedItem, setResolvedItem] = useState<ImportedPlace>(item);

  // Briefing polling for inline progress — always fetch intelligence when we have a googlePlaceId
  // Use resolvedItem's googlePlaceId when available (editorial cards get resolved by name → googlePlaceId)
  const googlePlaceId = (item.google as Record<string, unknown> & { placeId?: string })?.placeId as string | undefined;
  const resolvedGooglePlaceId = (resolvedItem.google as Record<string, unknown> & { placeId?: string })?.placeId as string | undefined;
  const effectiveGooglePlaceId = resolvedGooglePlaceId || googlePlaceId;
  const { data: intelData } = useBriefing(effectiveGooglePlaceId);
  const isEnriching = intelData?.status === 'enriching' || intelData?.status === 'pending';

  // A place is a "private listing" (Airbnb/Vrbo) when the parser explicitly
  // classified it as a "rental" — a private vacation rental not on Google Maps.
  const isPrivateListing = item.type === 'rental';
  useEffect(() => {
    setResolvedItem(item); // reset when item changes
    // Only resolve if the item looks under-populated (no match data, no google details)
    const needsResolve = !item.matchScore && !item.google?.rating;
    if (!needsResolve && googlePlaceId) return;
    // Need at least a name to resolve
    if (!googlePlaceId && !item.name) return;

    let cancelled = false;
    apiFetch<{
      googlePlaceId: string; name: string; location: string | null; type: string;
      googleData: { address?: string | null; rating?: number | null; reviewCount?: number | null;
        priceLevel?: string | null; hours?: string[] | null; photoUrl?: string | null;
        website?: string | null; phone?: string | null; lat?: number | null; lng?: number | null;
        category?: string | null };
      matchScore: number | null; matchBreakdown: Record<string, number> | null;
      matchExplanation?: ImportedPlace['matchExplanation'] | null;
      tasteNote: string | null; intelligenceStatus: string;
      savedPlaceId: string | null; isInLibrary: boolean;
    }>('/api/places/resolve', {
      method: 'POST',
      body: JSON.stringify({
        googlePlaceId,
        name: item.name,
        location: item.location,
        lat: item.google?.lat,
        lng: item.google?.lng,
      }),
    }).then(data => {
      if (cancelled) return;
      const g = data.googleData;
      const priceNum = g.priceLevel ? g.priceLevel.length : undefined;
      const google: GooglePlaceData = {
        placeId: data.googlePlaceId,
        address: g.address || undefined, rating: g.rating || undefined,
        reviewCount: g.reviewCount || undefined, category: g.category || undefined,
        priceLevel: priceNum, hours: g.hours || undefined,
        photoUrl: g.photoUrl || undefined, website: g.website || undefined,
        phone: g.phone || undefined, lat: g.lat || undefined, lng: g.lng || undefined,
      };
      setResolvedItem(prev => ({
        ...prev,
        matchScore: data.matchScore || prev.matchScore || 0,
        matchBreakdown: (data.matchBreakdown || prev.matchBreakdown || {}) as ImportedPlace['matchBreakdown'],
        matchExplanation: data.matchExplanation || prev.matchExplanation,
        tasteNote: data.tasteNote || prev.tasteNote || '',
        google,
        location: data.location || prev.location,
        type: (data.type || prev.type) as ImportedPlace['type'],
      }));
    }).catch(err => console.error('Failed to resolve preview place:', err));
    return () => { cancelled = true; };
  }, [googlePlaceId, item.name, item.location, item]);

  // Hydrated values — prefer resolved data over the bare-bones item
  const hydratedMatchScore = resolvedItem.matchScore || item.matchScore || 0;
  const hydratedBreakdown = (Object.keys(resolvedItem.matchBreakdown || {}).length > 0 ? resolvedItem.matchBreakdown : item.matchBreakdown) || ({} as ImportedPlace['matchBreakdown']);
  const hydratedGoogle = resolvedItem.google && (resolvedItem.google as Record<string, unknown>).rating
    ? resolvedItem.google : item.google;
  const hydratedTasteNote = resolvedItem.tasteNote || item.tasteNote;
  const hydratedLocation = resolvedItem.location || item.location;

  const handleSave = () => {
    if (!saved) {
      addPlace({ ...item, id: `saved-${Date.now()}` });
      setSaved(true);
    }
  };

  // Variant-specific styles
  const isDesktop = variant === 'desktop';
  const photoHeight = isDesktop ? 320 : 240;
  const containerPadding = isDesktop ? 'px-8 pb-8' : 'px-5 pb-24';
  const containerMarginTop = isDesktop ? 'mt-5' : 'mt-4';
  const nameFontSize = isDesktop ? 'text-[28px]' : 'text-[24px]';
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
      {/* Photo header — taller with gradient overlay for depth */}
      <div
        className="relative flex-shrink-0 overflow-hidden"
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
        {/* Gradient overlay for text legibility */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(28,26,23,0.55) 0%, rgba(28,26,23,0.15) 40%, transparent 70%)',
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
          {isDesktop ? 'x' : '<'}
        </button>
        {/* Overlaid name on photo for immersive feel */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-4" style={{ pointerEvents: 'none' }}>
          <h2
            className={`${isDesktop ? 'text-[28px]' : 'text-[26px]'} italic leading-tight`}
            style={{ fontFamily: FONT.serif, color: 'white', margin: 0, textShadow: '0 1px 8px rgba(0,0,0,0.3)' }}
          >
            {item.name}
          </h2>
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
                color: saved ? 'var(--t-ink)' : 'var(--t-cream)',
                fontFamily: FONT.sans,
              }}
            >
              <PerriandIcon name={saved ? 'check' : 'add'} size={14} color={saved ? 'var(--t-ink)' : 'var(--t-cream)'} />
              {saved ? 'Saved to library' : 'Save to library'}
            </button>
          </SafeFadeIn>
        )}

        {/* Action badges row — rating + collection */}
        <SafeFadeIn direction="up" distance={10} duration={0.5} delay={0.05}>
          <div className={`flex items-center gap-1.5 ${containerMarginTop}`}>
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
        </SafeFadeIn>

        {/* Location + metadata chips */}
        <SafeFadeIn direction="up" distance={10} duration={0.5} delay={0.1}>
          <div className="flex items-center gap-1.5 mt-2.5 mb-4 flex-wrap">
            <span className={`${locationFontSize}`} style={{ color: INK['70'] }}>
              {hydratedLocation} · {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
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
            {hydratedGoogle?.category && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                style={{ background: 'rgba(200,146,58,0.15)', color: '#7a5e24' }}
              >
                {hydratedGoogle.category}
              </span>
            )}
            {hydratedGoogle?.rating && (
              <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: INK['04'], color: 'var(--t-ink)' }}>
                <PerriandIcon name="star" size={11} color="var(--t-chrome-yellow)" />
                {hydratedGoogle.rating}
                {hydratedGoogle.reviewCount && (
                  <span style={{ color: INK['70'] }}>({hydratedGoogle.reviewCount.toLocaleString()})</span>
                )}
              </span>
            )}
            {hydratedGoogle?.priceLevel && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: INK['04'], color: 'var(--t-ink)' }}>
                {'$'.repeat(hydratedGoogle.priceLevel)}
              </span>
            )}
          </div>
        </SafeFadeIn>

        {/* Description */}
        {item.enrichment?.description && (
          <SafeFadeIn direction="up" distance={12} duration={0.5} delay={0.15}>
            <p className={`${descriptionFontSize} leading-relaxed mb-5`} style={{ color: INK['85'] }}>
              {item.enrichment.description}
            </p>
          </SafeFadeIn>
        )}

        {/* Place details — tile grid */}
        {hydratedGoogle && (hydratedGoogle.address || hydratedGoogle.website || hydratedGoogle.phone || hydratedGoogle.placeId || hydratedGoogle.lat) && (() => {
          const g = hydratedGoogle as Record<string, unknown> & { placeId?: string; lat?: number; lng?: number; address?: string; website?: string; phone?: string };
          const mapsUrl = g.placeId
            ? `https://www.google.com/maps/place/?q=place_id:${g.placeId}`
            : g.lat && g.lng
              ? `https://www.google.com/maps/search/?api=1&query=${g.lat},${g.lng}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.name} ${item.location}`)}`;
          const tiles: React.ReactNode[] = [];
          if (g.address) tiles.push(<div key="addr" className="flex items-start gap-2.5 p-3.5 min-w-0"><PerriandIcon name="pin" size={13} color={INK['50']} /><span className="text-[11px] leading-snug" style={{ color: INK['75'] }}>{g.address}</span></div>);
          if (g.website) tiles.push(<div key="web" className="flex items-center gap-2.5 p-3.5 min-w-0"><PerriandIcon name="discover" size={13} color={INK['50']} /><a href={g.website} target="_blank" rel="noopener noreferrer" className="text-[11px] no-underline truncate" style={{ color: '#8a6a2a' }} onClick={(e) => e.stopPropagation()}>{g.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a></div>);
          if (g.phone) tiles.push(<div key="phone" className="flex items-center gap-2.5 p-3.5 min-w-0"><PerriandIcon name="sparkle" size={13} color={INK['50']} /><a href={`tel:${g.phone}`} className="text-[11px] no-underline" style={{ color: '#8a6a2a' }} onClick={(e) => e.stopPropagation()}>{g.phone}</a></div>);
          tiles.push(<div key="maps" className="flex items-center gap-2.5 p-3.5 min-w-0"><PerriandIcon name="maps" size={13} color={INK['50']} /><a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] no-underline" style={{ color: '#8a6a2a' }} onClick={(e) => e.stopPropagation()}>Google Maps</a></div>);
          return (
            <SafeFadeIn direction="up" distance={12} duration={0.5} delay={0.2}>
              <div className="mb-5 rounded-2xl overflow-hidden" style={{ display: 'grid', gridTemplateColumns: `repeat(${tiles.length >= 2 ? 2 : 1}, 1fr)`, gap: 1, background: INK['06'], border: `1px solid ${INK['04']}` }}>
                {tiles.map((tile, i) => (<div key={i} style={{ background: '#fffdf8' }}>{tile}</div>))}
              </div>
            </SafeFadeIn>
          );
        })()}

        {/* Enrichment warnings */}
        {item.enrichment?.closedDays && item.enrichment.closedDays.length > 0 && (
          <SafeFadeIn direction="up" distance={10} duration={0.4}>
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl mb-5" style={{ background: 'rgba(232,104,48,0.12)', border: '1px solid rgba(232,104,48,0.25)' }}>
              <PerriandIcon name="alert" size={14} color="#a04018" />
              <span className={`${isDesktop ? 'text-[12px]' : 'text-[11px]'} font-medium`} style={{ color: '#a04018' }}>Closed {item.enrichment.closedDays.join(', ')}s</span>
            </div>
          </SafeFadeIn>
        )}

        {/* What to order */}
        {item.whatToOrder && item.whatToOrder.length > 0 && (
          <FadeInSection delay={0.1} direction="up" distance={16}>
            <div className="mb-5">
              <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: INK['95'], fontFamily: FONT.mono, letterSpacing: '1px' }}>What to order</div>
              <StaggerContainer className="flex flex-wrap gap-1.5" staggerDelay={0.06}>
                {item.whatToOrder.map((tag, i) => (
                  <StaggerItem key={i}>
                    <div className={`px-2.5 py-1 rounded-lg ${whatToOrderTagFontSize}`} style={{ background: 'var(--t-linen)', color: 'var(--t-ink)' }}>{tag}</div>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            </div>
          </FadeInSection>
        )}

        {/* Tips */}
        {item.tips && item.tips.length > 0 && (
          <FadeInSection delay={0.1} direction="up" distance={16}>
            <div className="mb-5">
              <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: INK['95'], fontFamily: FONT.mono, letterSpacing: '1px' }}>Tips</div>
              <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--t-linen)' }}>
                {item.tips.map((tip, i) => (<div key={i} className={`${tipsFontSize} leading-relaxed`} style={{ color: 'var(--t-ink)' }}>{tip}</div>))}
              </div>
            </div>
          </FadeInSection>
        )}

        {/* Sibling places */}
        {siblingPlaces && siblingPlaces.length > 0 && (
          <FadeInSection delay={0.1} direction="up" distance={16}>
            <div className="mb-5">
              <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: INK['95'], fontFamily: FONT.mono, letterSpacing: '1px' }}>Also from this guide</div>
              <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {siblingPlaces.slice(0, 5).map(sibling => (
                  <div key={sibling.id} className={`${siblingCardWidth} rounded-2xl p-3 flex-shrink-0 card-hover`} style={{ background: 'white', border: '1px solid var(--t-linen)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <div className={`${siblingNameFontSize} font-semibold`} style={{ color: 'var(--t-ink)' }}>{sibling.name}</div>
                    <div className={`${siblingTypeFontSize} mt-0.5`} style={{ color: INK['70'] }}>{sibling.type.charAt(0).toUpperCase() + sibling.type.slice(1)} · {sibling.location.split(',')[0]}</div>
                  </div>
                ))}
              </div>
            </div>
          </FadeInSection>
        )}

        {/* Author's notes */}
        {hydratedTasteNote && (
          <FadeInSection delay={0.05} direction="up" distance={14}>
            <div className="mb-5" style={{ background: sourceStyle ? `${sourceStyle.color}14` : 'rgba(199,82,51,0.08)', borderLeft: `3px solid ${sourceStyle?.color || '#c75233'}`, padding: '14px 16px', borderRadius: '0 16px 16px 0' }}>
              <div className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: sourceStyle?.color || '#a8422a', fontFamily: FONT.mono }}>{item.source?.name ? `From ${item.source.name}` : 'Source note'}</div>
              <p className={`${tasteNoteFontSize} leading-relaxed`} style={{ color: 'var(--t-ink)' }}>{hydratedTasteNote}</p>
            </div>
          </FadeInSection>
        )}

        {/* Friend attribution */}
        {item.friendAttribution && (
          <FadeInSection delay={0.05} direction="up" distance={14}>
            <div className="mb-5" style={{ background: 'rgba(42,122,86,0.08)', borderLeft: '3px solid var(--t-verde)', padding: '14px 16px', borderRadius: '0 16px 16px 0' }}>
              <div className="text-[9px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1" style={{ color: 'var(--t-verde)', fontFamily: FONT.mono }}>
                <PerriandIcon name="friend" size={12} color="var(--t-verde)" />{item.friendAttribution.name}
              </div>
              {item.friendAttribution.note && <p className={`${friendAttributionFontSize} italic leading-relaxed`} style={{ color: 'var(--t-ink)' }}>&ldquo;{item.friendAttribution.note}&rdquo;</p>}
            </div>
          </FadeInSection>
        )}

        {/* Your notes */}
        {existingRating && ratingReaction && (existingRating.tags?.length || existingRating.personalNote || existingRating.contextTags?.length) && (
          <FadeInSection delay={0.05} direction="up" distance={14}>
            <div className="mb-5 px-4 py-3 rounded-2xl cursor-pointer" style={{ background: `${ratingReaction.color}06`, border: `1px solid ${ratingReaction.color}15` }} onClick={onEditRating || onRate} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (onEditRating || onRate)?.(); } }}>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: ratingReaction.color, fontFamily: FONT.mono }}>
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
          </FadeInSection>
        )}

        {/* Terrazzo Insights — polished card layout */}
        {item.terrazzoInsight && (
          <FadeInSection delay={0.1} direction="up" distance={16}>
            <div className="flex flex-col gap-3 mb-5">
              <div className="p-4 rounded-2xl" style={{ background: 'rgba(42,122,86,0.08)', border: '1px solid rgba(42,122,86,0.16)' }}>
                <h4 className="text-[10px] uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5" style={{ color: '#226848', fontFamily: FONT.mono }}>
                  <PerriandIcon name="terrazzo" size={12} color="#226848" />Why You&apos;ll Love It
                </h4>
                <p className={`${terrazzoParagraphFontSize} leading-relaxed`} style={{ color: 'var(--t-ink)' }}>{item.terrazzoInsight.why}</p>
              </div>
              {item.terrazzoInsight.caveat && (
                <div className="p-4 rounded-2xl" style={{ background: 'rgba(160,108,40,0.08)', border: '1px solid rgba(160,108,40,0.16)' }}>
                  <h4 className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: '#7a5518', fontFamily: FONT.mono }}>Heads Up</h4>
                  <p className={`${terrazzoParagraphFontSize} leading-relaxed`} style={{ color: 'var(--t-ink)' }}>{item.terrazzoInsight.caveat}</p>
                </div>
              )}
            </div>
          </FadeInSection>
        )}

        {/* Match score — show taste match for enrichable places, fallback for rentals/private listings */}
        {!isPrivateListing ? (
          <FadeInSection delay={0.15} direction="up" distance={18}>
            <div
              className="flex items-center gap-4 p-4 rounded-2xl mb-5"
              style={{
                background: 'linear-gradient(135deg, rgba(200,146,58,0.10), rgba(200,146,58,0.04))',
                border: '1px solid rgba(200,146,58,0.18)',
                cursor: onViewBriefing ? 'pointer' : 'default',
              }}
              onClick={onViewBriefing}
              role={onViewBriefing ? 'button' : undefined}
              tabIndex={onViewBriefing ? 0 : undefined}
              onKeyDown={onViewBriefing ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewBriefing(); } } : undefined}
            >
              <AnimatedScoreArc score={hydratedMatchScore} size={56} color="#8a6a2a" />
              <div className="flex-1 min-w-0">
                <div className={`${matchScoreLabelFontSize} font-semibold`} style={{ color: 'var(--t-ink)' }}>Taste match</div>
                {/* Signal resonance clusters — replaces basic domain chips */}
                {resolvedItem.matchExplanation?.topClusters && resolvedItem.matchExplanation.topClusters.length > 0 ? (
                  <div className="mt-1.5">
                    <SignalResonanceStrip
                      clusters={resolvedItem.matchExplanation.topClusters.map(c => ({
                        label: c.label,
                        domain: c.domain as TasteDomain,
                        score: c.score,
                        signals: c.signals,
                      }))}
                      variant="compact"
                      layout={isDesktop ? 'desktop' : 'mobile'}
                    />
                  </div>
                ) : hydratedBreakdown ? (() => {
                  const topDomains = TASTE_DOMAINS
                    .map(d => ({ domain: d, score: hydratedBreakdown[d] ?? 0 }))
                    .filter(d => d.score > 0.15)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 3);
                  return topDomains.length > 0 ? (
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {topDomains.map(({ domain, score }) => (
                        <span
                          key={domain}
                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1"
                          style={{ background: `${DOMAIN_COLORS[domain]}12`, color: DOMAIN_COLORS[domain], fontFamily: FONT.mono }}
                        >
                          <PerriandIcon name={DOMAIN_ICONS[domain]} size={9} color={DOMAIN_COLORS[domain]} />
                          {domain} {Math.round(score * 100)}
                        </span>
                      ))}
                    </div>
                  ) : null;
                })() : null}
                {isEnriching && (
                  intelData?.latestRun
                    ? <div className="mt-1.5"><PipelineProgress currentStage={intelData.latestRun.currentStage} stagesCompleted={intelData.latestRun.stagesCompleted} startedAt={intelData.latestRun.startedAt} compact /></div>
                    : <div className="mt-1.5"><span className={`${matchScoreSubFontSize}`} style={{ color: INK['40'], fontFamily: FONT.mono }}>Researching this place…</span></div>
                )}
                {onViewBriefing && googlePlaceId && (<button className={`${matchScoreSubFontSize} mt-1.5 block border-none bg-transparent p-0 cursor-pointer`} style={{ color: '#7a5a20', fontFamily: FONT.mono }} onClick={(e) => { e.stopPropagation(); onViewBriefing(); }}>View full briefing</button>)}
              </div>
            </div>
          </FadeInSection>
        ) : (
          <FadeInSection delay={0.15} direction="up" distance={18}>
            <div
              className="flex items-center gap-3.5 p-4 rounded-2xl mb-5"
              style={{
                background: INK['03'],
                border: `1px solid ${INK['06']}`,
              }}
            >
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: 44, height: 44, borderRadius: 12, background: INK['06'] }}
              >
                <PerriandIcon name="pin" size={20} color={INK['40']} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`${matchScoreLabelFontSize} font-semibold`} style={{ color: 'var(--t-ink)' }}>Private listing</div>
                <div className={`${matchScoreSubFontSize} mt-0.5`} style={{ color: INK['50'], fontFamily: FONT.mono }}>
                  Taste matching isn&apos;t available for private rentals and listings
                </div>
              </div>
            </div>
          </FadeInSection>
        )}

        {/* Taste Mosaic — overlap mosaic when user profile available, otherwise standard */}
        {!isPrivateListing && (
          <FadeInSection delay={0.1} direction="up" distance={16}>
            <div className="mb-5">
              <h3 className="text-[10px] uppercase tracking-wider mb-3 font-bold" style={{ color: INK['95'], fontFamily: FONT.mono }}>
                {userTasteProfile ? 'Taste Overlap' : 'Taste Mosaic'}
              </h3>
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
          </FadeInSection>
        )}

        {/* Full signal resonance — expanded cluster view with signals */}
        {!isPrivateListing && resolvedItem.matchExplanation?.topClusters && resolvedItem.matchExplanation.topClusters.length > 0 && (
          <FadeInSection delay={0.12} direction="up" distance={16}>
            <div className="mb-5">
              <h3 className="text-[10px] uppercase tracking-wider mb-3 font-bold" style={{ color: INK['95'], fontFamily: FONT.mono }}>Signal Resonance</h3>
              <SignalResonanceStrip
                clusters={resolvedItem.matchExplanation.topClusters.map(c => ({
                  label: c.label,
                  domain: c.domain as TasteDomain,
                  score: c.score,
                  signals: c.signals,
                }))}
                narrative={resolvedItem.matchExplanation.narrative}
                variant="full"
                layout={isDesktop ? 'desktop' : 'mobile'}
              />
            </div>
          </FadeInSection>
        )}

        {/* Deep match breakdown — for 93%+ matches with signal data */}
        {!isPrivateListing && hydratedMatchScore >= 93 && resolvedItem.matchExplanation?.topClusters && (
          <FadeInSection delay={0.14} direction="up" distance={18}>
            <div className="mb-5">
              <DeepMatchBreakdown
                match={{
                  name: item.name,
                  location: hydratedLocation || '',
                  score: hydratedMatchScore,
                  headline: resolvedItem.matchExplanation.narrative || '',
                  signalBreakdown: resolvedItem.matchExplanation.topClusters.slice(0, 4).map(c => ({
                    signal: c.label,
                    domain: c.domain as TasteDomain,
                    strength: c.score,
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
            <div className="mb-5">
              <h3 className="text-[10px] uppercase tracking-wider mb-3 font-bold" style={{ color: INK['95'], fontFamily: FONT.mono }}>Sustainability</h3>
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
                color: existingRating ? 'var(--t-ink)' : 'var(--t-cream)',
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

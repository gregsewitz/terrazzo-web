'use client';

import { useState } from 'react';
import { ImportedPlace, DOMAIN_COLORS, DOMAIN_ICONS, TasteDomain, REACTIONS, SOURCE_STYLES, GhostSourceType } from '@/types';
import { useSavedStore } from '@/stores/savedStore';

interface PlaceDetailSheetProps {
  item: ImportedPlace;
  onClose: () => void;
  onRate?: () => void;
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

export default function PlaceDetailSheet({ item, onClose, onRate }: PlaceDetailSheetProps) {
  const existingRating = item.rating;
  const ratingReaction = existingRating ? REACTIONS.find(r => r.id === existingRating.reaction) : null;
  const sourceStyle = item.ghostSource ? SOURCE_STYLES[item.ghostSource as GhostSourceType] : null;
  const addPlace = useSavedStore(s => s.addPlace);
  const myPlaces = useSavedStore(s => s.myPlaces);
  const [saved, setSaved] = useState(myPlaces.some(p => p.name === item.name));

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
        {/* Photo header — gradient placeholder like wireframe */}
        <div
          className="relative"
          style={{
            height: 200,
            background: getPhotoGradient(item.type),
          }}
        >
          {/* Back button */}
          <button
            onClick={onClose}
            className="absolute top-14 left-4 text-white text-base bg-transparent border-none cursor-pointer"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
          >
            ←
          </button>

          {/* Action buttons bottom-right */}
          <div className="absolute bottom-3 right-3 flex gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); handleSave(); }}
              className="px-2.5 py-1 rounded-lg text-[10px] border-none"
              style={{
                background: saved ? 'rgba(42,122,86,0.9)' : 'rgba(0,0,0,0.4)',
                color: 'white',
                cursor: saved ? 'default' : 'pointer',
              }}
            >
              {saved ? '♡ Saved' : '♡ Save'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRate?.(); }}
              className="px-2.5 py-1 rounded-lg text-[10px] font-semibold border-none cursor-pointer"
              style={{ background: 'rgba(200,146,58,0.9)', color: 'white' }}
            >
              ★ Rate
            </button>
          </div>
        </div>

        <div className="px-5 pb-8">
          {/* Name + meta */}
          <h2
            className="text-[22px] mt-4 mb-1 italic leading-tight"
            style={{ fontFamily: "'DM Serif Display', serif", color: 'var(--t-ink)' }}
          >
            {item.name}
          </h2>
          <p className="text-[11px]" style={{ color: 'rgba(28,26,23,0.5)' }}>
            {item.location} · {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
          </p>

          {/* Tags row */}
          <div className="flex gap-1 mt-2.5 flex-wrap">
            {sourceStyle && (
              <span
                className="text-[9px] font-semibold px-2 py-0.5 rounded-md"
                style={{ background: sourceStyle.bg, color: sourceStyle.color }}
              >
                {sourceStyle.icon} {item.source?.name || sourceStyle.label}
              </span>
            )}
            {item.google?.category && (
              <span
                className="text-[9px] font-semibold px-2 py-0.5 rounded-md"
                style={{ background: 'rgba(200,146,58,0.1)', color: 'var(--t-honey)' }}
              >
                {item.google.category}
              </span>
            )}
          </div>

          {/* Google Places Facts */}
          {item.google && (
            <div className="flex gap-2 mt-3 mb-4 flex-wrap">
              {item.google.rating && (
                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(28,26,23,0.04)' }}>
                  <span style={{ color: 'var(--t-chrome-yellow)' }}>★</span>
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--t-ink)' }}>{item.google.rating}</span>
                  {item.google.reviewCount && (
                    <span className="text-[10px]" style={{ color: 'rgba(28,26,23,0.4)' }}>
                      ({item.google.reviewCount.toLocaleString()})
                    </span>
                  )}
                </div>
              )}
              {item.google.priceLevel && (
                <div className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium" style={{ background: 'rgba(28,26,23,0.04)', color: 'var(--t-ink)' }}>
                  {'$'.repeat(item.google.priceLevel)}
                </div>
              )}
            </div>
          )}

          {/* Enrichment warnings */}
          {item.enrichment?.closedDays && item.enrichment.closedDays.length > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4"
              style={{ background: 'rgba(232,104,48,0.08)', border: '1px solid rgba(232,104,48,0.2)' }}
            >
              <span>⚠️</span>
              <span className="text-[11px]" style={{ color: 'var(--t-panton-orange)' }}>
                Closed {item.enrichment.closedDays.join(', ')}s
              </span>
            </div>
          )}

          {/* Author's notes callout — the gold, wireframe style */}
          {item.tasteNote && (
            <div
              className="mb-4"
              style={{
                background: sourceStyle ? `${sourceStyle.color}08` : 'rgba(199,82,51,0.04)',
                borderLeft: `3px solid ${sourceStyle?.color || '#c75233'}`,
                padding: '12px 14px',
                borderRadius: '0 12px 12px 0',
              }}
            >
              <div
                className="text-[9px] font-bold uppercase tracking-widest mb-1"
                style={{
                  color: sourceStyle?.color || '#c75233',
                  fontFamily: "'Space Mono', monospace",
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
                background: 'rgba(42,122,86,0.04)',
                borderLeft: '3px solid var(--t-verde)',
                padding: '12px 14px',
                borderRadius: '0 12px 12px 0',
              }}
            >
              <div
                className="text-[9px] font-bold uppercase tracking-widest mb-1"
                style={{ color: 'var(--t-verde)', fontFamily: "'Space Mono', monospace" }}
              >
                👤 {item.friendAttribution.name}
              </div>
              {item.friendAttribution.note && (
                <p className="text-[12px] italic leading-relaxed" style={{ color: 'var(--t-ink)' }}>
                  &ldquo;{item.friendAttribution.note}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* Taste Axes Breakdown */}
          <div className="mb-4">
            <h3
              className="text-[10px] uppercase tracking-wider mb-2.5 font-bold"
              style={{ color: 'rgba(28,26,23,0.5)', fontFamily: "'Space Mono', monospace" }}
            >
              Taste Axes
            </h3>
            <div className="flex flex-col gap-2">
              {TASTE_DOMAINS.map(domain => {
                const value = item.matchBreakdown?.[domain] ?? 0;
                return (
                  <div key={domain} className="flex items-center gap-2">
                    <span className="text-xs w-4 text-center" style={{ color: DOMAIN_COLORS[domain] }}>
                      {DOMAIN_ICONS[domain]}
                    </span>
                    <span
                      className="text-[10px] w-16 font-medium"
                      style={{ color: 'var(--t-ink)', fontFamily: "'Space Mono', monospace" }}
                    >
                      {domain}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(28,26,23,0.06)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${value * 100}%`, background: DOMAIN_COLORS[domain] }}
                      />
                    </div>
                    <span className="text-[10px] w-8 text-right" style={{ color: 'rgba(28,26,23,0.4)', fontFamily: "'Space Mono', monospace" }}>
                      {Math.round(value * 100)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Match score highlight */}
          <div
            className="flex items-center gap-3 p-3 rounded-xl mb-4"
            style={{ background: 'rgba(200,146,58,0.06)', border: '1px solid rgba(200,146,58,0.15)' }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-[14px] font-bold"
              style={{
                background: 'linear-gradient(135deg, rgba(200,146,58,0.2), rgba(200,146,58,0.1))',
                color: 'var(--t-honey)',
                fontFamily: "'Space Mono', monospace",
              }}
            >
              {item.matchScore}%
            </div>
            <div>
              <div className="text-[12px] font-semibold" style={{ color: 'var(--t-ink)' }}>
                Taste match
              </div>
              <div className="text-[10px]" style={{ color: 'rgba(28,26,23,0.5)' }}>
                Based on your profile preferences
              </div>
            </div>
          </div>

          {/* Existing rating display */}
          {existingRating && ratingReaction && (
            <div
              className="mb-4 p-3 rounded-xl cursor-pointer transition-all hover:scale-[1.01]"
              style={{
                background: `${ratingReaction.color}08`,
                border: `1.5px solid ${ratingReaction.color}30`,
              }}
              onClick={onRate}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span style={{ fontSize: '18px', color: ratingReaction.color }}>{ratingReaction.icon}</span>
                <span
                  className="text-[12px] font-semibold"
                  style={{ color: ratingReaction.color, fontFamily: "'Space Mono', monospace" }}
                >
                  {ratingReaction.label}
                </span>
                {existingRating.returnIntent === 'absolutely' && (
                  <span className="text-[10px] ml-auto" style={{ color: 'rgba(28,26,23,0.5)' }}>
                    Would return ✓
                  </span>
                )}
              </div>
              {existingRating.tags && existingRating.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {existingRating.tags.map(tag => (
                    <span
                      key={tag}
                      className="text-[9px] px-2 py-0.5 rounded-full"
                      style={{ background: `${ratingReaction.color}12`, color: ratingReaction.color }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {existingRating.personalNote && (
                <p className="text-[11px] italic mt-2" style={{ color: 'rgba(28,26,23,0.6)' }}>
                  &ldquo;{existingRating.personalNote}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* Terrazzo Insights */}
          {item.terrazzoInsight && (
            <div className="flex flex-col gap-3">
              {/* Why you'll love it */}
              <div
                className="p-3 rounded-xl"
                style={{ background: 'rgba(42,122,86,0.06)', border: '1px solid rgba(42,122,86,0.15)' }}
              >
                <h4
                  className="text-[10px] uppercase tracking-wider font-bold mb-1.5"
                  style={{ color: 'var(--t-verde)', fontFamily: "'Space Mono', monospace" }}
                >
                  ✦ Why You&apos;ll Love It
                </h4>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--t-ink)' }}>
                  {item.terrazzoInsight.why}
                </p>
              </div>

              {/* Heads up */}
              {item.terrazzoInsight.caveat && (
                <div
                  className="p-3 rounded-xl"
                  style={{ background: 'rgba(160,108,40,0.06)', border: '1px solid rgba(160,108,40,0.15)' }}
                >
                  <h4
                    className="text-[10px] uppercase tracking-wider font-bold mb-1.5"
                    style={{ color: 'var(--t-amber)', fontFamily: "'Space Mono', monospace" }}
                  >
                    ◈ Heads Up
                  </h4>
                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--t-ink)' }}>
                    {item.terrazzoInsight.caveat}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Rate this place button */}
          {onRate && (
            <button
              onClick={onRate}
              className="w-full mt-6 py-3.5 rounded-xl border-none cursor-pointer text-[13px] font-semibold transition-all hover:opacity-90"
              style={{
                background: existingRating ? 'rgba(28,26,23,0.06)' : 'var(--t-ink)',
                color: existingRating ? 'var(--t-ink)' : 'var(--t-cream)',
                fontFamily: "'DM Sans', sans-serif",
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

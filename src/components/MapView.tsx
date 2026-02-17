'use client';

import { useState } from 'react';
import { ImportedPlace, SOURCE_STYLES } from '@/types';

interface MapViewProps {
  dayNumber: number;
  destination?: string;
  placedItems: Array<{ name: string; type: string }>;
  ghostItems: Array<{ name: string; ghostSource?: string }>;
}

export default function MapView({
  dayNumber,
  destination = 'Destination',
  placedItems,
  ghostItems,
}: MapViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const mapHeight = isExpanded ? 400 : 220;

  // Generate pseudo-random positions for items (deterministic based on name)
  function getItemPosition(name: string, index: number) {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const x = ((hash + index * 13) % 80) + 10; // 10-90%
    const y = ((hash * 7 + index * 17) % 80) + 10; // 10-90%
    return { x, y };
  }

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-0">
        <div
          className="text-sm font-bold uppercase tracking-wider"
          style={{
            fontFamily: "'Space Mono', monospace",
            color: 'var(--t-ink)',
          }}
        >
          Day {dayNumber} · {destination}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-7 h-7 flex items-center justify-center rounded-full border-none cursor-pointer transition-transform"
          style={{
            background: 'rgba(28,26,23,0.06)',
            color: 'var(--t-ink)',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          ∧
        </button>
      </div>

      {/* Map container with grid background */}
      <div
        className="relative w-full rounded-lg overflow-hidden"
        style={{
          background: 'var(--t-cream)',
          border: '1px solid var(--t-linen)',
          height: mapHeight,
          backgroundImage:
            'linear-gradient(var(--t-linen) 0.5px, transparent 0.5px), linear-gradient(90deg, var(--t-linen) 0.5px, transparent 0.5px)',
          backgroundSize: '40px 40px',
          transition: 'height 0.3s ease-out',
        }}
      >
        {/* Placed items (solid dots) */}
        {placedItems.map((item, idx) => {
          const pos = getItemPosition(item.name, idx);
          const sourceStyle = SOURCE_STYLES.manual; // Default to manual for placed items

          return (
            <div
              key={`placed-${idx}`}
              className="absolute flex flex-col items-center"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {/* Solid dot */}
              <div
                className="rounded-full"
                style={{
                  width: 12,
                  height: 12,
                  background: sourceStyle.color,
                  boxShadow: `0 2px 8px rgba(28,26,23,0.15)`,
                }}
              />

              {/* Label below dot */}
              <div
                className="text-[9px] font-semibold mt-2 text-center max-w-[60px] leading-tight"
                style={{
                  fontFamily: "'Space Mono', monospace",
                  color: 'var(--t-ink)',
                }}
              >
                {item.name}
              </div>
            </div>
          );
        })}

        {/* Ghost items (dashed outline dots) */}
        {ghostItems.map((item, idx) => {
          const pos = getItemPosition(item.name, idx + placedItems.length);
          const ghostSource = item.ghostSource || 'ai';
          const sourceStyle = SOURCE_STYLES[ghostSource as keyof typeof SOURCE_STYLES] || SOURCE_STYLES.ai;

          return (
            <div
              key={`ghost-${idx}`}
              className="absolute flex flex-col items-center"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {/* Dashed outline dot */}
              <div
                className="rounded-full"
                style={{
                  width: 12,
                  height: 12,
                  border: `2px dashed ${sourceStyle.color}`,
                  background: 'transparent',
                  opacity: 0.6,
                }}
              />

              {/* Label below dot */}
              <div
                className="text-[9px] font-semibold mt-2 text-center max-w-[60px] leading-tight"
                style={{
                  fontFamily: "'Space Mono', monospace",
                  color: sourceStyle.color,
                  opacity: 0.7,
                }}
              >
                {item.name}
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {placedItems.length === 0 && ghostItems.length === 0 && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ color: 'rgba(28,26,23,0.3)' }}
          >
            <div className="text-center">
              <div className="text-xs font-medium" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                No places planned yet
              </div>
            </div>
          </div>
        )}
      </div>

      {/* View full map button */}
      <button
        className="mt-2 w-full py-2 text-xs font-medium rounded-lg border-none cursor-pointer transition-all"
        style={{
          background: 'rgba(28,26,23,0.04)',
          color: 'var(--t-ink)',
          fontFamily: "'DM Sans', sans-serif",
        }}
        onClick={() => {
          // TODO: Link to Google Maps when API is integrated
          console.log('View full map for', destination);
        }}
      >
        View full map →
      </button>
    </div>
  );
}

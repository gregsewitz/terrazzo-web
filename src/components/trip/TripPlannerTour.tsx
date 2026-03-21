'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FONT, TEXT, INK, COLOR } from '@/constants/theme';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';

// ─── Tour step definitions ───────────────────────────────────────────────────

export interface TourStep {
  /** data-tour attribute value to anchor to */
  target: string;
  /** Perriand icon for the step */
  icon: PerriandIconName;
  /** Short title */
  title: string;
  /** 1-2 sentence description */
  body: string;
  /** Preferred tooltip position relative to target */
  position: 'top' | 'bottom' | 'left' | 'right';
  /** Optional: offset from target center (px) */
  offset?: { x?: number; y?: number };
}

interface TourStepDef {
  target: string;
  icon: PerriandIconName;
  title: string;
  /** Desktop copy */
  body: string;
  /** Mobile copy — falls back to body if not set */
  mobileBody?: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  /** Position override on mobile (most things go bottom on a vertical layout) */
  mobilePosition?: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEP_DEFS: TourStepDef[] = [
  {
    target: 'day-columns',
    icon: 'plan',
    title: 'Your itinerary',
    body: 'Each column is a day. Six time slots per day — breakfast through evening. Click any empty cell to add a quick entry, or drag a place from the rail.',
    mobileBody: 'Six time slots per day — breakfast through evening. Tap any slot to add a place, or type a quick entry. Swipe left/right to change days.',
    position: 'bottom',
  },
  {
    target: 'picks-rail',
    icon: 'discover',
    title: 'Your saved places',
    body: 'Your saved places live here. Press and hold to drag them onto the grid. Places snap into the slot you drop them on. Drag them back here to unplace.',
    mobileBody: 'Your saved places live here at the bottom. Hold and drag up to place them on a time slot. Swipe up to browse the full list.',
    position: 'right',
    mobilePosition: 'top',
  },
  {
    target: 'day-header',
    icon: 'location',
    title: 'Days & destinations',
    body: 'Each day shows its date and destination. Hover the ⋯ menu to add or remove days, change destinations, duplicate a day, or clear it.',
    mobileBody: 'Tap a day to switch to it. Long-press or tap the ⋯ button to add or remove days, change destinations, or rearrange.',
    position: 'bottom',
  },
  {
    target: 'hotel-button',
    icon: 'hotel',
    title: 'Set your hotel',
    body: 'Click "+ Hotel" on any day to search and set where you\'re staying. It helps Terrazzo suggest places nearby.',
    mobileBody: 'Tap "+ Hotel" to search and set where you\'re staying. It helps Terrazzo suggest places nearby.',
    position: 'bottom',
  },
  {
    target: 'grid-cell',
    icon: 'restaurant',
    title: 'Time slots',
    body: 'Each cell is a time slot. Drop a place here, or click an empty cell to type a quick entry — "dinner at that place Maria mentioned" works fine. Terrazzo will try to resolve it.',
    mobileBody: 'Each row is a time slot. Tap to open it, or type a quick entry like "dinner at that place Maria mentioned" — Terrazzo will try to resolve it into a real place.',
    position: 'right',
    mobilePosition: 'bottom',
  },
  {
    target: 'ghost-card',
    icon: 'swap',
    title: 'Ghost suggestions',
    body: 'Dashed cards are Terrazzo\'s suggestions based on your taste profile. Click "Add" to keep one, or dismiss it. They refresh as you build out your trip.',
    mobileBody: 'Dashed cards are Terrazzo\'s suggestions based on your taste. Tap "Add" to keep one, or swipe to dismiss. They refresh as you plan.',
    position: 'right',
    mobilePosition: 'bottom',
  },
  {
    target: 'view-toggle',
    icon: 'discover',
    title: 'Switch views',
    body: 'Toggle between Overview (editorial briefing), Itinerary (this grid), and Map to see your places geographically.',
    position: 'bottom',
  },
  {
    target: 'ask-terrazzo',
    icon: 'chatBubble',
    title: 'Ask Terrazzo',
    body: 'Need restaurant ideas near your hotel? A rainy-day backup? Ask Terrazzo and it\'ll suggest places that match your taste — and can place them directly into your grid.',
    position: 'bottom',
    mobilePosition: 'top',
  },
];

/** Resolve step definitions into runtime TourSteps based on screen width */
function resolveSteps(isMobile: boolean): TourStep[] {
  return TOUR_STEP_DEFS.map(def => ({
    target: def.target,
    icon: def.icon,
    title: def.title,
    body: isMobile && def.mobileBody ? def.mobileBody : def.body,
    position: isMobile && def.mobilePosition ? def.mobilePosition : def.position,
  }));
}

// ─── Tour storage key ────────────────────────────────────────────────────────

const TOUR_SEEN_KEY = 'terrazzo:trip-planner-tour-seen';

function hasTourBeenSeen(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(TOUR_SEEN_KEY) === 'true';
}

function markTourSeen(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOUR_SEEN_KEY, 'true');
  }
}

// ─── Tooltip positioning ─────────────────────────────────────────────────────

interface TooltipPos {
  top: number;
  left: number;
  arrowSide: 'top' | 'bottom' | 'left' | 'right';
}

function computeTooltipPos(
  targetRect: DOMRect,
  step: TourStep,
  tooltipW: number,
  tooltipH: number,
): TooltipPos {
  const gap = 12;
  const ox = step.offset?.x ?? 0;
  const oy = step.offset?.y ?? 0;
  let top = 0;
  let left = 0;
  let arrowSide = step.position;

  switch (step.position) {
    case 'bottom':
      top = targetRect.bottom + gap + oy;
      left = targetRect.left + targetRect.width / 2 - tooltipW / 2 + ox;
      arrowSide = 'top';
      break;
    case 'top':
      top = targetRect.top - tooltipH - gap + oy;
      left = targetRect.left + targetRect.width / 2 - tooltipW / 2 + ox;
      arrowSide = 'bottom';
      break;
    case 'right':
      top = targetRect.top + targetRect.height / 2 - tooltipH / 2 + oy;
      left = targetRect.right + gap + ox;
      arrowSide = 'left';
      break;
    case 'left':
      top = targetRect.top + targetRect.height / 2 - tooltipH / 2 + oy;
      left = targetRect.left - tooltipW - gap + ox;
      arrowSide = 'right';
      break;
  }

  // Clamp to viewport
  const pad = 16;
  left = Math.max(pad, Math.min(left, window.innerWidth - tooltipW - pad));
  top = Math.max(pad, Math.min(top, window.innerHeight - tooltipH - pad));

  return { top, left, arrowSide };
}

// ─── Component ───────────────────────────────────────────────────────────────

interface TripPlannerTourProps {
  /** Force-show the tour even if it was previously dismissed (for "re-take tour" button) */
  forceShow?: boolean;
  /** Called when the tour completes or is dismissed */
  onComplete?: () => void;
}

export default function TripPlannerTour({ forceShow, onComplete }: TripPlannerTourProps) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const tooltipW = isMobile ? Math.min(280, window.innerWidth - 32) : 320;
  const [tooltipSize, setTooltipSize] = useState({ w: tooltipW, h: 180 });

  // Resolve steps for current screen size
  const TOUR_STEPS = resolveSteps(isMobile);

  // Auto-trigger on mount if tour hasn't been seen
  useEffect(() => {
    if (forceShow) {
      setActive(true);
      setStep(0);
      return;
    }
    // Delay slightly to let the grid render
    const timer = setTimeout(() => {
      if (!hasTourBeenSeen()) {
        setActive(true);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [forceShow]);

  // Find the target element for the current step
  const findTarget = useCallback(() => {
    if (!active) return null;
    const currentStep = TOUR_STEPS[step];
    if (!currentStep) return null;
    const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
    return el;
  }, [active, step]);

  // Update target rect when step changes
  useEffect(() => {
    if (!active) return;

    const updateRect = () => {
      const el = findTarget();
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };

    updateRect();
    // Re-measure on scroll/resize
    window.addEventListener('scroll', updateRect, { passive: true, capture: true });
    window.addEventListener('resize', updateRect);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [active, step, findTarget]);

  // Measure tooltip after render
  useEffect(() => {
    if (tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      setTooltipSize({ w: rect.width, h: rect.height });
    }
  }, [step, active]);

  const currentStep = TOUR_STEPS[step];
  const totalSteps = TOUR_STEPS.length;

  // Skip steps whose target doesn't exist in the DOM
  const advanceStep = useCallback((direction: 1 | -1) => {
    let next = step + direction;
    // Skip forward past missing targets
    while (next >= 0 && next < totalSteps) {
      const el = document.querySelector(`[data-tour="${TOUR_STEPS[next].target}"]`);
      if (el) break;
      next += direction;
    }
    if (next >= totalSteps) {
      // Tour complete
      markTourSeen();
      setActive(false);
      onComplete?.();
    } else if (next < 0) {
      // Can't go before first step
    } else {
      setStep(next);
    }
  }, [step, totalSteps, onComplete]);

  const dismiss = useCallback(() => {
    markTourSeen();
    setActive(false);
    onComplete?.();
  }, [onComplete]);

  // Keyboard navigation
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
      if (e.key === 'ArrowRight' || e.key === 'Enter') advanceStep(1);
      if (e.key === 'ArrowLeft') advanceStep(-1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, dismiss, advanceStep]);

  if (!active || !currentStep) return null;

  // Compute positions
  const pos = targetRect
    ? computeTooltipPos(targetRect, currentStep, tooltipSize.w, tooltipSize.h)
    : { top: window.innerHeight / 2 - tooltipSize.h / 2, left: window.innerWidth / 2 - tooltipSize.w / 2, arrowSide: 'top' as const };

  return (
    <>
      {/* Backdrop — semi-transparent with cutout for target */}
      <div
        className="fixed inset-0 z-[9990]"
        style={{ background: 'rgba(0,42,85,0.35)' }}
        onClick={dismiss}
      />

      {/* Spotlight cutout over target element */}
      {targetRect && (
        <div
          className="fixed z-[9991] pointer-events-none"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            borderRadius: 8,
            boxShadow: '0 0 0 9999px rgba(0,42,85,0.35)',
            background: 'transparent',
            transition: 'all 300ms ease',
          }}
        />
      )}

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          ref={tooltipRef}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="fixed z-[9992]"
          style={{
            top: pos.top,
            left: pos.left,
            width: tooltipW,
            background: 'white',
            borderRadius: 14,
            boxShadow: '0 12px 40px rgba(0,42,85,0.18), 0 2px 8px rgba(0,42,85,0.08)',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header bar */}
          <div
            className="flex items-center gap-2.5 px-5 py-3"
            style={{ background: 'rgba(58,128,136,0.06)', borderBottom: `1px solid ${INK['06']}` }}
          >
            <div
              className="flex items-center justify-center rounded-full flex-shrink-0"
              style={{ width: 28, height: 28, background: 'rgba(58,128,136,0.1)' }}
            >
              <PerriandIcon name={currentStep.icon} size={14} color={COLOR.darkTeal} />
            </div>
            <span
              style={{
                fontFamily: FONT.serif,
                fontStyle: 'italic',
                fontSize: 15,
                fontWeight: 600,
                color: TEXT.primary,
                flex: 1,
              }}
            >
              {currentStep.title}
            </span>
            <button
              onClick={dismiss}
              className="flex items-center justify-center rounded-full flex-shrink-0"
              style={{
                width: 24, height: 24,
                background: INK['06'],
                border: 'none',
                cursor: 'pointer',
              }}
              aria-label="Close tour"
            >
              <PerriandIcon name="close" size={10} color={TEXT.secondary} />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-3.5">
            <p
              style={{
                fontFamily: FONT.sans,
                fontSize: 13,
                lineHeight: 1.55,
                color: TEXT.secondary,
                margin: 0,
              }}
            >
              {currentStep.body}
            </p>
          </div>

          {/* Footer: progress + nav */}
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderTop: `1px solid ${INK['04']}` }}
          >
            {/* Step dots */}
            <div className="flex items-center gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full"
                  style={{
                    width: i === step ? 16 : 5,
                    height: 5,
                    background: i === step ? COLOR.darkTeal : INK['12'],
                    borderRadius: 3,
                    transition: 'all 200ms ease',
                  }}
                />
              ))}
            </div>

            {/* Nav buttons */}
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  onClick={() => advanceStep(-1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full cursor-pointer"
                  style={{
                    background: INK['04'],
                    border: `1px solid ${INK['08']}`,
                    fontFamily: FONT.sans,
                    fontSize: 11,
                    fontWeight: 600,
                    color: TEXT.secondary,
                  }}
                >
                  Back
                </button>
              )}
              <button
                onClick={() => advanceStep(1)}
                className="flex items-center gap-1 px-4 py-1.5 rounded-full cursor-pointer"
                style={{
                  background: COLOR.darkTeal,
                  border: 'none',
                  fontFamily: FONT.sans,
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'white',
                }}
              >
                {step === totalSteps - 1 ? 'Got it' : 'Next'}
                {step < totalSteps - 1 && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

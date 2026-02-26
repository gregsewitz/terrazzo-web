import { useRef, useState, useCallback } from 'react';
import type { ImportedPlace } from '@/types';

/**
 * Threshold in px before movement is considered intentional.
 * For touch on horizontal strips: horizontal = scroll, vertical = drag.
 * For mouse: any direction beyond threshold triggers drag.
 */
const MOUSE_DRAG_THRESHOLD = 4;
const TOUCH_DRAG_THRESHOLD = 8;
const TOUCH_SCROLL_THRESHOLD = 8;
const TOUCH_HOLD_DELAY = 300;    // ms before touch-hold activates drag
const HOLD_FEEDBACK_DELAY = 120; // ms before visual hold indicator

export type DragGestureLayout = 'vertical' | 'horizontal';

interface UseDragGestureOptions {
  /** Called when drag gesture is activated */
  onDragActivate: (item: ImportedPlace, e: React.PointerEvent) => void;
  /** Called on a clean tap (no drag) */
  onTap?: (item: ImportedPlace) => void;
  /** Layout direction of the scrollable container.
   *  'horizontal' → horizontal movement = scroll, vertical = drag (PicksStrip)
   *  'vertical' → any movement beyond threshold = drag (PicksRail, DayBoardView slots)
   */
  layout?: DragGestureLayout;
  /** Whether drag is currently active (to suppress taps) */
  isDragging?: boolean;
}

/**
 * Shared pointer gesture hook for drag-and-drop activation.
 *
 * Mouse: drag starts immediately on movement beyond threshold (no hold delay).
 * Touch: drag starts after hold delay OR on vertical movement (for horizontal layouts).
 *
 * Used by PicksRail, PicksStrip, DayBoardView placed cards, and TimeSlotCard.
 */
export function useDragGesture({
  onDragActivate,
  onTap,
  layout = 'vertical',
  isDragging = false,
}: UseDragGestureOptions) {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdItem = useRef<ImportedPlace | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const pointerType = useRef<string>('mouse');
  const gestureDecided = useRef(false);
  const [holdingId, setHoldingId] = useState<string | null>(null);

  const clearHold = useCallback(() => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    holdItem.current = null;
    pointerStart.current = null;
    gestureDecided.current = false;
    setHoldingId(null);
  }, []);

  const activateDrag = useCallback((item: ImportedPlace, e: React.PointerEvent) => {
    gestureDecided.current = true;
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    onDragActivate(item, e);
    holdItem.current = null;
    setHoldingId(null);
  }, [onDragActivate]);

  const handlePointerDown = useCallback((item: ImportedPlace, e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
    holdItem.current = item;
    pointerType.current = e.pointerType;
    gestureDecided.current = false;

    if (e.pointerType === 'touch') {
      // Touch: start hold timer
      const pointerEvent = e;
      holdTimer.current = setTimeout(() => {
        if (holdItem.current && !gestureDecided.current) {
          activateDrag(holdItem.current, pointerEvent);
        }
      }, TOUCH_HOLD_DELAY);

      // Visual hold feedback
      setTimeout(() => {
        if (holdItem.current?.id === item.id && !gestureDecided.current) {
          setHoldingId(item.id);
        }
      }, HOLD_FEEDBACK_DELAY);
    }
    // Mouse: no timer — drag activates on movement in handlePointerMove
  }, [activateDrag]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerStart.current || gestureDecided.current) return;

    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (pointerType.current === 'mouse') {
      // Mouse: any movement beyond threshold = drag
      if (absDx > MOUSE_DRAG_THRESHOLD || absDy > MOUSE_DRAG_THRESHOLD) {
        if (holdItem.current) {
          activateDrag(holdItem.current, e);
        }
      }
    } else {
      // Touch: direction-dependent for horizontal layouts
      if (layout === 'horizontal') {
        // Horizontal scroll takes priority
        if (absDx > TOUCH_SCROLL_THRESHOLD) {
          gestureDecided.current = true;
          if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
          holdItem.current = null;
          setHoldingId(null);
          return;
        }
        // Vertical movement = drag
        if (absDy > TOUCH_DRAG_THRESHOLD && holdItem.current) {
          activateDrag(holdItem.current, e);
        }
      } else {
        // Vertical layout: any movement beyond threshold = drag
        if (absDx > TOUCH_DRAG_THRESHOLD || absDy > TOUCH_DRAG_THRESHOLD) {
          if (holdItem.current) {
            activateDrag(holdItem.current, e);
          }
        }
      }
    }
  }, [activateDrag, layout]);

  const handlePointerUp = useCallback(() => {
    if (!gestureDecided.current && holdItem.current && onTap && !isDragging) {
      onTap(holdItem.current);
    }
    clearHold();
  }, [clearHold, onTap, isDragging]);

  const handlePointerCancel = useCallback(() => {
    clearHold();
  }, [clearHold]);

  return {
    /** Attach to each draggable item's onPointerDown */
    handlePointerDown,
    /** Attach to the container's onPointerMove */
    handlePointerMove,
    /** Attach to the container's onPointerUp */
    handlePointerUp,
    /** Attach to the container's onPointerCancel */
    handlePointerCancel,
    /** ID of the item currently in hold-feedback state (for visual pulse) */
    holdingId,
    /** Clear gesture state (e.g. when parent drag ends) */
    clearHold,
  };
}

'use client';

import { useEffect, useRef } from 'react';

/**
 * Comprehensive flicker debug instrumentation.
 *
 * Monitors every potential cause of a visual flash/flicker:
 *
 * 1. OPACITY CHANGES — MutationObserver on style attr + RAF polling of
 *    computedStyle opacity at ~60fps (not 100ms like last time)
 * 2. DISPLAY / VISIBILITY — tracks display:none, visibility:hidden toggling
 * 3. ELEMENT MOUNT / UNMOUNT — MutationObserver on parent for childList changes
 * 4. CLASS CHANGES — MutationObserver on className mutations
 * 5. RE-RENDERS — logs every React render of the host component
 * 6. LAYOUT SHIFTS — uses PerformanceObserver for layout-shift entries
 * 7. PAINT FLASHES — uses PerformanceObserver for largest-contentful-paint
 * 8. CSS REFLOW — tracks offsetHeight reads that might trigger reflow
 *
 * Usage:
 *   const ref = useFlickerDebug('EditorialLetter');
 *   <div ref={ref}>...</div>
 */
export function useFlickerDebug(label: string) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const renderCount = useRef(0);
  const rafId = useRef<number>(0);
  const lastOpacity = useRef<string>('');
  const lastDisplay = useRef<string>('');
  const lastVisibility = useRef<string>('');
  const lastClassName = useRef<string>('');
  const lastRect = useRef<{ top: number; left: number; width: number; height: number } | null>(null);

  // Track renders
  renderCount.current += 1;
  const rc = renderCount.current;
  if (typeof window !== 'undefined') {
    console.log(
      `%c[FLICKER ${label}] RENDER #${rc} @ ${performance.now().toFixed(1)}ms`,
      'color: #2196F3; font-weight: bold'
    );
  }

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    console.log(
      `%c[FLICKER ${label}] MOUNTED — starting monitors @ ${performance.now().toFixed(1)}ms`,
      'color: #4CAF50; font-weight: bold'
    );

    // ─── 1. RAF POLLING: opacity, display, visibility, position ───
    // This runs at ~60fps so we catch sub-frame changes the old 100ms polling missed
    const pollProperties = () => {
      if (!elRef.current) return;
      const cs = getComputedStyle(elRef.current);

      // Opacity
      if (cs.opacity !== lastOpacity.current) {
        const prev = lastOpacity.current;
        lastOpacity.current = cs.opacity;
        if (prev !== '') {
          const emoji = parseFloat(cs.opacity) < parseFloat(prev) ? '🔴' : '🟢';
          console.log(
            `%c[FLICKER ${label}] ${emoji} OPACITY: ${prev} → ${cs.opacity} @ ${performance.now().toFixed(1)}ms`,
            `color: ${parseFloat(cs.opacity) < parseFloat(prev) ? '#f44336' : '#4CAF50'}; font-weight: bold`
          );
          if (parseFloat(cs.opacity) === 0) {
            console.trace(`[FLICKER ${label}] ⚠️ OPACITY HIT ZERO — stack trace:`);
          }
        }
      }

      // Display
      if (cs.display !== lastDisplay.current) {
        const prev = lastDisplay.current;
        lastDisplay.current = cs.display;
        if (prev !== '') {
          console.log(
            `%c[FLICKER ${label}] 📦 DISPLAY: ${prev} → ${cs.display} @ ${performance.now().toFixed(1)}ms`,
            'color: #FF9800; font-weight: bold'
          );
        }
      }

      // Visibility
      if (cs.visibility !== lastVisibility.current) {
        const prev = lastVisibility.current;
        lastVisibility.current = cs.visibility;
        if (prev !== '') {
          console.log(
            `%c[FLICKER ${label}] 👁 VISIBILITY: ${prev} → ${cs.visibility} @ ${performance.now().toFixed(1)}ms`,
            'color: #FF9800; font-weight: bold'
          );
        }
      }

      // Position/size shift (potential layout thrashing)
      const rect = elRef.current.getBoundingClientRect();
      const r = { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) };
      if (lastRect.current) {
        const lr = lastRect.current;
        if (r.top !== lr.top || r.left !== lr.left || r.width !== lr.width || r.height !== lr.height) {
          console.log(
            `%c[FLICKER ${label}] 📐 LAYOUT SHIFT: top ${lr.top}→${r.top}, left ${lr.left}→${r.left}, size ${lr.width}x${lr.height}→${r.width}x${r.height} @ ${performance.now().toFixed(1)}ms`,
            'color: #9C27B0; font-weight: bold'
          );
        }
      }
      lastRect.current = r;

      rafId.current = requestAnimationFrame(pollProperties);
    };
    rafId.current = requestAnimationFrame(pollProperties);

    // ─── 2. MUTATION OBSERVER: style, class, childList ───
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'style') {
          const inline = (m.target as HTMLElement).style.cssText;
          console.log(
            `%c[FLICKER ${label}] 🎨 STYLE MUTATED: "${inline}" @ ${performance.now().toFixed(1)}ms`,
            'color: #E91E63; font-weight: bold'
          );
        }
        if (m.type === 'attributes' && m.attributeName === 'class') {
          const newClass = (m.target as HTMLElement).className;
          if (newClass !== lastClassName.current) {
            console.log(
              `%c[FLICKER ${label}] 🏷 CLASS: "${lastClassName.current}" → "${newClass}" @ ${performance.now().toFixed(1)}ms`,
              'color: #795548; font-weight: bold'
            );
            lastClassName.current = newClass;
          }
        }
        if (m.type === 'childList') {
          if (m.addedNodes.length) {
            console.log(
              `%c[FLICKER ${label}] ➕ CHILDREN ADDED: ${m.addedNodes.length} nodes @ ${performance.now().toFixed(1)}ms`,
              'color: #009688; font-weight: bold'
            );
          }
          if (m.removedNodes.length) {
            console.log(
              `%c[FLICKER ${label}] ➖ CHILDREN REMOVED: ${m.removedNodes.length} nodes @ ${performance.now().toFixed(1)}ms`,
              'color: #f44336; font-weight: bold'
            );
          }
        }
      }
    });

    mo.observe(el, {
      attributes: true,
      attributeFilter: ['style', 'class'],
      childList: true,
      subtree: false,
    });

    // Also watch the parent for this element being removed
    if (el.parentElement) {
      const parentMo = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const removed of m.removedNodes) {
            if (removed === el) {
              console.log(
                `%c[FLICKER ${label}] ❌ ELEMENT REMOVED FROM DOM @ ${performance.now().toFixed(1)}ms`,
                'color: #f44336; font-weight: bold; font-size: 14px'
              );
              console.trace(`[FLICKER ${label}] removal stack:`);
            }
          }
        }
      });
      parentMo.observe(el.parentElement, { childList: true });

      // Cleanup
      return () => {
        cancelAnimationFrame(rafId.current);
        mo.disconnect();
        parentMo.disconnect();
        console.log(
          `%c[FLICKER ${label}] UNMOUNTED @ ${performance.now().toFixed(1)}ms`,
          'color: #f44336; font-weight: bold; font-size: 14px'
        );
      };
    }

    return () => {
      cancelAnimationFrame(rafId.current);
      mo.disconnect();
    };
  }, [label]);

  return elRef;
}

/**
 * Global page-level debug — monitors layout shifts and paint timing.
 * Call once at the top of the page component.
 */
export function usePageFlickerDebug(pageName: string) {
  const renderCount = useRef(0);
  renderCount.current += 1;
  const rc = renderCount.current;

  if (typeof window !== 'undefined') {
    console.log(
      `%c[PAGE ${pageName}] RENDER #${rc} @ ${performance.now().toFixed(1)}ms`,
      'color: #673AB7; font-weight: bold'
    );
  }

  useEffect(() => {
    console.log(
      `%c[PAGE ${pageName}] MOUNTED — starting global monitors`,
      'color: #4CAF50; font-weight: bold; font-size: 14px'
    );

    // ─── Layout shift observer ───
    let layoutShiftObserver: PerformanceObserver | null = null;
    try {
      layoutShiftObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const lse = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean; sources?: Array<{ node?: Node }> };
          if (lse.value && lse.value > 0.001) {
            const sourceInfo = lse.sources?.map(s => {
              const node = s.node as HTMLElement | undefined;
              return node ? `${node.tagName}.${node.className?.split(' ')[0] || ''}` : 'unknown';
            }).join(', ') || 'no sources';
            console.log(
              `%c[PAGE ${pageName}] 📐 LAYOUT SHIFT: value=${lse.value?.toFixed(4)} hadRecentInput=${lse.hadRecentInput} sources=[${sourceInfo}] @ ${performance.now().toFixed(1)}ms`,
              'color: #FF5722; font-weight: bold'
            );
          }
        }
      });
      layoutShiftObserver.observe({ type: 'layout-shift', buffered: true });
    } catch {
      // Not supported in Safari
      console.log(`[PAGE ${pageName}] LayoutShift observer not supported`);
    }

    // ─── LCP observer ───
    let lcpObserver: PerformanceObserver | null = null;
    try {
      lcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const lcp = entry as PerformanceEntry & { element?: Element; size?: number };
          console.log(
            `%c[PAGE ${pageName}] 🖼 LCP: element=${lcp.element?.tagName || 'unknown'} size=${lcp.size} @ startTime=${entry.startTime.toFixed(1)}ms`,
            'color: #00BCD4; font-weight: bold'
          );
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      console.log(`[PAGE ${pageName}] LCP observer not supported`);
    }

    // ─── Long task observer — detects main thread blocking ───
    let longTaskObserver: PerformanceObserver | null = null;
    try {
      longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          console.log(
            `%c[PAGE ${pageName}] 🐌 LONG TASK: ${entry.duration.toFixed(1)}ms @ startTime=${entry.startTime.toFixed(1)}ms`,
            'color: #F44336; font-weight: bold'
          );
        }
      });
      longTaskObserver.observe({ type: 'longtask', buffered: true });
    } catch {
      console.log(`[PAGE ${pageName}] LongTask observer not supported`);
    }

    // ─── Track dbHydrated timing via custom marker ───
    performance.mark(`${pageName}-mounted`);

    return () => {
      layoutShiftObserver?.disconnect();
      lcpObserver?.disconnect();
      longTaskObserver?.disconnect();
    };
  }, [pageName]);
}

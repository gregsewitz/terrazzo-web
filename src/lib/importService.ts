/**
 * Import service — handles SSE streaming for place imports.
 * Pure async functions with no React dependency.
 * State updates are communicated via callbacks that connect to Zustand.
 */

import { ImportedPlace } from '@/types';

export interface ImportCallbacks {
  onProgress: (percent: number, label: string, placeNames?: string[]) => void;
  onPreview?: (places: ImportedPlace[]) => void;
  onResult: (places: ImportedPlace[]) => void;
  onError: (error: string) => void;
}

// Store active AbortController so we can cancel if needed
let activeController: AbortController | null = null;

export function cancelActiveImport() {
  if (activeController) {
    activeController.abort();
    activeController = null;
  }
}

/**
 * Stream import from /api/import (text + URL imports).
 * Handles SSE parsing, timeouts, and callbacks.
 */
export async function streamImport(
  input: string,
  callbacks: ImportCallbacks
): Promise<void> {
  cancelActiveImport();
  const controller = new AbortController();
  activeController = controller;
  const timeout = setTimeout(() => controller.abort(), 120000); // 2 min

  try {
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: input }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok || !res.body) throw new Error('Import failed');

    await parseSSEStream(res.body, callbacks);
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      callbacks.onError('Import timed out');
    } else {
      callbacks.onError((err as Error).message || 'Import failed');
    }
  } finally {
    clearTimeout(timeout);
    activeController = null;
  }
}

/**
 * Stream import from /api/import/maps-list (Google Maps saved list imports).
 * Handles preview + result events for lazy enrichment.
 */
export async function streamMapsImport(
  mapsUrl: string,
  callbacks: ImportCallbacks
): Promise<void> {
  cancelActiveImport();
  const controller = new AbortController();
  activeController = controller;
  const timeout = setTimeout(() => controller.abort(), 120000); // 2 min

  try {
    const res = await fetch('/api/import/maps-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: mapsUrl }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok || !res.body) throw new Error('Maps import failed');

    await parseSSEStream(res.body, callbacks);
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      callbacks.onError('Import timed out');
    } else {
      callbacks.onError((err as Error).message || 'Maps import failed');
    }
  } finally {
    clearTimeout(timeout);
    activeController = null;
  }
}

/**
 * Generic SSE stream parser — reads ReadableStream and dispatches events.
 */
async function parseSSEStream(
  body: ReadableStream<Uint8Array>,
  callbacks: ImportCallbacks
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event = JSON.parse(line.slice(6));

        if (event.type === 'progress') {
          callbacks.onProgress(
            event.percent || 0,
            event.label || '',
            event.placeNames
          );
        } else if (event.type === 'preview') {
          // Lazy enrichment: basic results available immediately
          if (event.places?.length) {
            callbacks.onPreview?.(event.places);
          }
        } else if (event.type === 'result') {
          if (event.places?.length) {
            callbacks.onResult(event.places);
          } else {
            callbacks.onError('No places found');
          }
        } else if (event.type === 'error') {
          callbacks.onError(event.error || 'Import failed');
        }
      } catch (parseErr) {
        // Skip malformed SSE lines
        if (parseErr instanceof SyntaxError) continue;
        throw parseErr;
      }
    }
  }
}

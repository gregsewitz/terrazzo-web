'use client';

import { apiFetch } from '@/lib/api-client';

// ═══════════════════════════════════════════
// Centralized DB save with retry + error tracking
// Replaces fire-and-forget pattern across all stores
// ═══════════════════════════════════════════

type SaveStatus = 'idle' | 'saving' | 'error' | 'retrying';

interface PendingSave {
  id: string;
  url: string;
  method: string;
  body?: unknown;
  retries: number;
  createdAt: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 8000]; // exponential-ish backoff
const listeners = new Set<(status: SaveStatus, pending: number, lastError?: string) => void>();

let _status: SaveStatus = 'idle';
let _pendingCount = 0;
let _lastError: string | undefined;
let _queue: PendingSave[] = [];
let _processing = false;

function notify() {
  listeners.forEach(fn => fn(_status, _pendingCount, _lastError));
}

/** Subscribe to save status changes. Returns unsubscribe function. */
export function onSaveStatus(fn: (status: SaveStatus, pending: number, lastError?: string) => void) {
  listeners.add(fn);
  // Immediately fire current state
  fn(_status, _pendingCount, _lastError);
  return () => listeners.delete(fn);
}

/** Get current save status */
export function getSaveStatus() {
  return { status: _status, pending: _pendingCount, lastError: _lastError };
}

async function processQueue() {
  if (_processing || _queue.length === 0) return;
  _processing = true;

  while (_queue.length > 0) {
    const save = _queue[0];

    try {
      _status = save.retries > 0 ? 'retrying' : 'saving';
      notify();

      await apiFetch(save.url, {
        method: save.method,
        ...(save.body !== undefined ? { body: JSON.stringify(save.body) } : {}),
      });

      // Success — remove from queue
      _queue.shift();
      _pendingCount = _queue.length;
      _lastError = undefined;

      if (_queue.length === 0) {
        _status = 'idle';
      }
      notify();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      console.error(`[dbSave] Failed (attempt ${save.retries + 1}/${MAX_RETRIES}):`, save.url, msg);

      if (save.retries < MAX_RETRIES - 1) {
        // Retry after delay
        save.retries++;
        const delay = RETRY_DELAYS[save.retries - 1] || 8000;
        _status = 'retrying';
        _lastError = `Retrying save... (${save.retries}/${MAX_RETRIES})`;
        notify();

        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Max retries exhausted — remove from queue, surface error
        _queue.shift();
        _pendingCount = _queue.length;
        _status = 'error';
        _lastError = `Failed to save: ${msg}. Some changes may not be persisted.`;
        notify();

        // Clear error status after 10 seconds if no other saves pending
        setTimeout(() => {
          if (_status === 'error' && _queue.length === 0) {
            _status = 'idle';
            _lastError = undefined;
            notify();
          }
        }, 10_000);
      }
    }
  }

  _processing = false;
}

/**
 * Queue a DB write with automatic retry.
 * Replaces all fire-and-forget patterns.
 *
 * Usage:
 *   dbSave('/api/profile/save', 'POST', { tasteProfile: data })
 *   dbSave('/api/places/abc', 'PATCH', { rating: { ... } })
 *   dbSave('/api/places/abc', 'DELETE')
 */
export function dbSave(url: string, method: string, body?: unknown) {
  const save: PendingSave = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    url,
    method,
    body,
    retries: 0,
    createdAt: Date.now(),
  };

  _queue.push(save);
  _pendingCount = _queue.length;
  notify();

  // Start processing (non-blocking)
  processQueue();
}

/**
 * Await all pending saves. Useful for critical transitions like "finish onboarding".
 * Returns true if all saved successfully, false if any failed.
 */
export async function flushSaves(): Promise<boolean> {
  if (_queue.length === 0) return true;

  return new Promise(resolve => {
    const check = () => {
      if (_queue.length === 0) {
        resolve(_status !== 'error');
      } else {
        setTimeout(check, 200);
      }
    };
    check();
  });
}

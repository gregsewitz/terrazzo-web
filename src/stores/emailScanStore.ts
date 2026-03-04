import { create } from 'zustand';
import { apiFetch } from '@/lib/api-client';

interface ScanProgress {
  scanId: string;
  emailsFound: number;
  emailsParsed: number;
  reservationsFound: number;
  status: 'idle' | 'scanning' | 'parsing' | 'done' | 'failed';
  error?: string;
}

interface EmailScanStore {
  // State
  progress: ScanProgress;
  /** Message IDs still waiting to be parsed */
  pendingMessageIds: string[];
  /** Whether the parse loop is currently running */
  isProcessing: boolean;

  // Actions
  startScan: () => Promise<void>;
  resumeIfNeeded: () => Promise<void>;
  reset: () => void;
  /** Internal: process message IDs in batches */
  _processBatches: () => Promise<void>;
}

const BATCH_SIZE = 15;

const INITIAL_PROGRESS: ScanProgress = {
  scanId: '',
  emailsFound: 0,
  emailsParsed: 0,
  reservationsFound: 0,
  status: 'idle',
};

export const useEmailScanStore = create<EmailScanStore>((set, get) => ({
  progress: INITIAL_PROGRESS,
  pendingMessageIds: [],
  isProcessing: false,

  startScan: async () => {
    if (get().isProcessing) return;

    set({
      progress: { ...INITIAL_PROGRESS, status: 'scanning' },
      pendingMessageIds: [],
    });

    try {
      const data = await apiFetch<{
        scanId: string;
        status: string;
        emailsFound: number;
        messageIds: string[];
      }>('/api/email/scan', {
        method: 'POST',
        body: JSON.stringify({ scanType: 'full' }),
      });

      console.log('[email-scan] Scan found', data.emailsFound, 'emails');

      if (data.emailsFound === 0) {
        set({
          progress: {
            scanId: data.scanId,
            emailsFound: 0,
            emailsParsed: 0,
            reservationsFound: 0,
            status: 'done',
          },
        });
        return;
      }

      set({
        progress: {
          scanId: data.scanId,
          emailsFound: data.emailsFound,
          emailsParsed: 0,
          reservationsFound: 0,
          status: 'parsing',
        },
        pendingMessageIds: data.messageIds,
      });

      // Start the parse loop
      get()._processBatches();
    } catch (err) {
      console.error('[email-scan] Scan failed:', err);
      set({
        progress: { ...get().progress, status: 'failed', error: 'Scan failed' },
      });
    }
  },

  /**
   * Called on page load — checks DB for an in-progress or completed scan
   * and restores UI state accordingly.
   */
  resumeIfNeeded: async () => {
    const { progress, isProcessing } = get();
    // Don't resume if already active
    if (isProcessing || progress.status === 'scanning' || progress.status === 'parsing') return;

    try {
      const data = await apiFetch<{
        scans: Array<{
          id: string;
          status: string;
          emailsFound: number;
          emailsParsed: number;
          reservationsFound: number;
        }>;
      }>('/api/email/scan');

      const latest = data.scans?.[0];
      if (!latest) return;

      const status = latest.status === 'completed' ? 'done'
        : latest.status === 'failed' ? 'failed'
        : latest.status as ScanProgress['status'];

      set({
        progress: {
          scanId: latest.id,
          emailsFound: latest.emailsFound,
          emailsParsed: latest.emailsParsed,
          reservationsFound: latest.reservationsFound,
          status,
        },
      });

      // If scan is stuck in parsing (server died), mark it done — the
      // partial results are already in the DB
      if (latest.status === 'parsing') {
        console.log('[email-scan] Found stale parsing scan, marking as done');
        set(s => ({
          progress: { ...s.progress, status: 'done' },
        }));
        // Also fix it in the DB
        await apiFetch(`/api/email/scan/${latest.id}/complete`, { method: 'POST' }).catch(() => {});
      }
    } catch {
      // No scan history — fine
    }
  },

  reset: () => {
    set({ progress: INITIAL_PROGRESS, pendingMessageIds: [], isProcessing: false });
  },

  /** Internal: process message IDs in batches */
  _processBatches: async () => {
    const state = get();
    if (state.isProcessing) return;

    set({ isProcessing: true });

    try {
      while (get().pendingMessageIds.length > 0) {
        const { pendingMessageIds, progress } = get();
        const batch = pendingMessageIds.slice(0, BATCH_SIZE);
        const remaining = pendingMessageIds.slice(BATCH_SIZE);

        try {
          const result = await apiFetch<{
            parsed: number;
            reservationsCreated: number;
          }>('/api/email/parse', {
            method: 'POST',
            body: JSON.stringify({
              scanId: progress.scanId,
              messageIds: batch,
            }),
          });

          set(s => ({
            pendingMessageIds: remaining,
            progress: {
              ...s.progress,
              emailsParsed: s.progress.emailsParsed + result.parsed,
              reservationsFound: s.progress.reservationsFound + result.reservationsCreated,
            },
          }));

          console.log(`[email-scan] Batch done: +${result.parsed} parsed, +${result.reservationsCreated} reservations (${remaining.length} left)`);
        } catch (err) {
          console.error('[email-scan] Batch failed, skipping:', err);
          // Skip this batch and continue
          set({ pendingMessageIds: remaining });
        }
      }

      // All done
      set(s => ({
        isProcessing: false,
        progress: { ...s.progress, status: 'done' },
      }));

      // Update DB scan status
      const { progress } = get();
      await apiFetch(`/api/email/scan/${progress.scanId}/complete`, {
        method: 'POST',
      }).catch(() => {});

      console.log('[email-scan] All batches complete');
    } catch (err) {
      console.error('[email-scan] Parse loop failed:', err);
      set(s => ({
        isProcessing: false,
        progress: { ...s.progress, status: 'failed', error: 'Parsing failed' },
      }));
    }
  },
}));

import Nylas from 'nylas';
import type { NylasEmailMessage, RESERVATION_SEARCH_QUERIES } from '@/types/email';

const nylas = new Nylas({
  apiKey: process.env.NYLAS_API_KEY || '',
});

// ─── Auth ──────────────────────────────────────────────────────────────────────

export function getNylasAuthUrl(redirectUri: string) {
  return nylas.auth.urlForOAuth2({
    clientId: process.env.NYLAS_CLIENT_ID || '',
    redirectUri,
    loginHint: '',
  });
}

export async function exchangeCodeForGrant(code: string, redirectUri: string) {
  const response = await nylas.auth.exchangeCodeForToken({
    clientId: process.env.NYLAS_CLIENT_ID || '',
    code,
    redirectUri,
  });
  return response;
}

// ─── Message Search ────────────────────────────────────────────────────────────

/**
 * Search emails using Gmail-native query syntax.
 * Wraps nylas.messages.list with searchQueryNative.
 */
export async function searchEmails(grantId: string, query: string, limit = 50) {
  const messages = await nylas.messages.list({
    identifier: grantId,
    queryParams: {
      limit,
      searchQueryNative: query,
    },
  });
  return messages;
}

/**
 * Search for confirmation/booking emails using multiple targeted queries.
 * Deduplicates by message ID across query results.
 */
export async function searchConfirmationEmails(
  grantId: string,
  queries: typeof RESERVATION_SEARCH_QUERIES,
  options: { limit?: number; receivedAfter?: number } = {}
): Promise<{ messages: NylasEmailMessage[]; queriesRun: number }> {
  const { limit = 25, receivedAfter } = options;
  const seen = new Set<string>();
  const allMessages: NylasEmailMessage[] = [];
  let queriesRun = 0;

  // Build a Gmail-native date filter (after:YYYY/MM/DD) instead of using
  // Nylas's receivedAfter param, which may conflict with searchQueryNative
  // on Google providers.
  const dateFilter = receivedAfter
    ? ` after:${new Date(receivedAfter * 1000).toISOString().slice(0, 10).replace(/-/g, '/')}`
    : '';

  for (const { label, query } of queries) {
    try {
      queriesRun++;
      const fullQuery = query + dateFilter;
      const queryParams: Record<string, unknown> = {
        limit,
        searchQueryNative: fullQuery,
      };

      const result = await nylas.messages.list({
        identifier: grantId,
        queryParams: queryParams as Parameters<typeof nylas.messages.list>[0]['queryParams'],
      });

      let newCount = 0;
      for (const msg of result.data) {
        if (!seen.has(msg.id)) {
          seen.add(msg.id);
          allMessages.push(mapNylasMessage(msg));
          newCount++;
        }
      }

      if (result.data.length > 0 || newCount > 0) {
        console.log(`[email-scan] "${label}": ${result.data.length} results, ${newCount} new`);
      }
    } catch (err) {
      // Log but don't fail the entire scan for one bad query
      console.warn(`[email-scan] FAILED "${label}" (${query}):`, err);
    }
  }

  console.log(`[email-scan] Scan complete: ${queriesRun} queries → ${allMessages.length} unique messages`);

  return { messages: allMessages, queriesRun };
}

/**
 * Fetch a single message by ID, including the full body.
 */
export async function fetchMessage(grantId: string, messageId: string): Promise<NylasEmailMessage> {
  const msg = await nylas.messages.find({
    identifier: grantId,
    messageId,
  });
  return mapNylasMessage(msg.data);
}

/**
 * Fetch full message bodies for a batch of message IDs.
 * Concurrency-limited to avoid Nylas rate limits.
 */
export async function fetchMessageBodies(
  grantId: string,
  messageIds: string[],
  concurrency = 5
): Promise<NylasEmailMessage[]> {
  const results: NylasEmailMessage[] = [];
  let idx = 0;

  async function worker() {
    while (idx < messageIds.length) {
      const i = idx++;
      try {
        const msg = await fetchMessage(grantId, messageIds[i]);
        results.push(msg);
      } catch (err) {
        console.warn(`Failed to fetch message ${messageIds[i]}:`, err);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, messageIds.length) }, () => worker())
  );

  return results;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapNylasMessage(msg: any): NylasEmailMessage {
  return {
    id: msg.id,
    grantId: msg.grantId || msg.grant_id || '',
    subject: msg.subject || '',
    from: (msg.from || []).map((f: any) => ({ name: f.name, email: f.email })),
    to: (msg.to || []).map((t: any) => ({ name: t.name, email: t.email })),
    date: msg.date || 0,
    body: msg.body || undefined,
    snippet: msg.snippet || undefined,
    threadId: msg.threadId || msg.thread_id || undefined,
    folders: msg.folders || undefined,
    labels: msg.labels || undefined,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default nylas;

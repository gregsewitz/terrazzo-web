/**
 * SSE stream consumer and sentence-splitting utilities.
 *
 * Pure functions (no React) for:
 * - Sentence splitting with abbreviation awareness
 * - Consuming Server-Sent Events from the onboarding respond endpoint
 *
 * Extracted from useConversationPhase.ts for testability and reuse.
 */

// ─── Sentence splitting ──────────────────────────────────────────────────────

/**
 * Common abbreviations that end with a period but don't end a sentence.
 * Used to prevent false sentence splits on "Mr. Smith loved it" → "Mr." + "Smith loved it"
 */
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'ave', 'blvd',
  'vs', 'etc', 'approx', 'dept', 'est', 'govt', 'inc', 'ltd', 'corp',
  // Two-letter abbreviations common in travel context
  'u.s', 'u.k', 'e.g', 'i.e', 'a.m', 'p.m',
]);

/**
 * Split text into complete sentences. Returns [completeSentences[], remainingFragment].
 * A sentence ends with . ! or ? followed by a space or end-of-string,
 * UNLESS the period follows a known abbreviation.
 */
export function splitSentences(text: string): [string[], string] {
  const sentences: string[] = [];
  // Match sentences ending with .!? followed by space or end-of-string.
  // We post-filter to reject abbreviation false-positives.
  const re = /([^.!?]*[.!?])(?:\s+|$)/g;
  let lastIndex = 0;
  let pendingFragment = '';
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const segment = match[1].trim();
    const combined = pendingFragment ? pendingFragment + ' ' + segment : segment;

    // Check if this ends with an abbreviation (e.g., "Mr." or "e.g.")
    // Extract the last word before the terminal punctuation
    const lastWordMatch = combined.match(/(\S+)[.]\s*$/);
    if (lastWordMatch) {
      const lastWord = lastWordMatch[1].replace(/\.$/, '').toLowerCase();
      if (ABBREVIATIONS.has(lastWord) || (lastWord.length <= 2 && /^[a-z]$/i.test(lastWord))) {
        // This is an abbreviation — don't split here, accumulate
        pendingFragment = combined;
        lastIndex = re.lastIndex;
        continue;
      }
    }

    if (combined.length > 0) sentences.push(combined);
    pendingFragment = '';
    lastIndex = re.lastIndex;
  }

  const remaining = text.slice(lastIndex).trim();
  const finalRemaining = pendingFragment
    ? (remaining ? pendingFragment + ' ' + remaining : pendingFragment)
    : remaining;

  return [sentences, finalRemaining];
}

// ─── SSE stream consumer ─────────────────────────────────────────────────────

export interface RespondStreamResult {
  followUp: string | null;
  phaseComplete: boolean;
  userRequestedSkip?: boolean;
  correctedTranscript?: string;
  expectedResponseType?: string;
}

/**
 * Parse the streaming SSE from /api/onboarding/respond.
 * Extracts the followUp value progressively and calls onSentence for each complete sentence.
 */
export async function consumeRespondStream(
  response: Response,
  onSentence: (sentence: string) => void,
): Promise<RespondStreamResult> {
  const reader = response.body?.getReader();
  if (!reader) {
    return { followUp: null, phaseComplete: false };
  }

  const decoder = new TextDecoder();
  let fullTokens = '';
  let followUpBuffer = '';
  let insideFollowUp = false;
  let followUpDone = false; // true once we've fully extracted the followUp value — prevents re-detection
  let sentFragment = ''; // un-sent partial sentence
  let doneResult: RespondStreamResult | null = null;
  const streamedSentences: string[] = []; // accumulate all sentences sent to TTS

  // Wrapper that sends to TTS AND records what was spoken
  const emitSentence = (s: string) => {
    streamedSentences.push(s);
    onSentence(s);
  };

  let sseBuffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    sseBuffer += decoder.decode(value, { stream: true });

    // Process complete SSE messages
    const lines = sseBuffer.split('\n');
    sseBuffer = lines.pop() || ''; // keep incomplete line

    for (const line of lines) {
      if (line.startsWith('event: done')) {
        // Next data line has the final result
        continue;
      }

      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);

          if (parsed.followUp !== undefined) {
            // This is the "done" event with the full parsed result
            doneResult = parsed;
          } else if (parsed.text !== undefined) {
            // This is a "token" event
            const token: string = parsed.text;
            fullTokens += token;

            // Track if we're inside the followUp string value in the JSON
            // We look for "followUp": " pattern to start capturing
            //
            // Three states:
            //   1. Searching (!insideFollowUp && !followUpDone) — looking for "followUp": "
            //   2. Tracking (insideFollowUp) — inside the value, accumulating until closing "
            //   3. Done (followUpDone) — ignore all subsequent tokens
            if (followUpDone) {
              // Already extracted followUp — ignore remaining JSON tokens
            } else if (insideFollowUp) {
              // We're inside the followUp value — accumulate tokens
              followUpBuffer += token;

              // Check if we've hit the closing quote (end of followUp string)
              // Must find an UNESCAPED quote — skip any \" sequences
              let searchFrom = 0;
              let closeQuoteIdx = -1;
              const combined = sentFragment + token;
              while (searchFrom < combined.length) {
                const idx = combined.indexOf('"', searchFrom);
                if (idx < 0) break;
                let backslashCount = 0;
                for (let i = idx - 1; i >= 0 && combined[i] === '\\'; i--) {
                  backslashCount++;
                }
                if (backslashCount % 2 === 0) {
                  closeQuoteIdx = idx;
                  break;
                }
                searchFrom = idx + 1;
              }

              if (closeQuoteIdx >= 0) {
                const lastBit = combined.slice(0, closeQuoteIdx);
                if (lastBit.trim().length > 0) {
                  emitSentence(lastBit.trim());
                }
                insideFollowUp = false;
                followUpDone = true;
                sentFragment = '';
              } else {
                sentFragment = combined;
                const [sentences, remaining] = splitSentences(sentFragment);
                for (const s of sentences) {
                  if (s.length > 0) emitSentence(s);
                }
                sentFragment = remaining;
              }
            } else {
              // Searching — look for the start of the followUp field
              const followUpStart = fullTokens.match(/"followUp"\s*:\s*"/);
              if (followUpStart) {
                const idx = fullTokens.indexOf(followUpStart[0]) + followUpStart[0].length;
                let chunk = fullTokens.slice(idx);

                // Check if the closing quote is already in this chunk
                let closingIdx = -1;
                let searchPos = 0;
                while (searchPos < chunk.length) {
                  const qi = chunk.indexOf('"', searchPos);
                  if (qi < 0) break;
                  let bs = 0;
                  for (let i = qi - 1; i >= 0 && chunk[i] === '\\'; i--) bs++;
                  if (bs % 2 === 0) { closingIdx = qi; break; }
                  searchPos = qi + 1;
                }

                if (closingIdx >= 0) {
                  // Entire followUp in one chunk
                  chunk = chunk.slice(0, closingIdx);
                  const [sentences, remaining] = splitSentences(chunk);
                  for (const s of sentences) {
                    if (s.length > 0) emitSentence(s);
                  }
                  if (remaining.trim().length > 0) emitSentence(remaining.trim());
                  followUpDone = true;
                } else {
                  // Still streaming — enter tracking mode
                  insideFollowUp = true;
                  followUpBuffer = chunk;
                  const [sentences, remaining] = splitSentences(followUpBuffer);
                  for (const s of sentences) {
                    if (s.length > 0) emitSentence(s);
                  }
                  sentFragment = remaining;
                }
              }
            }
          }
        } catch {
          // Ignore parse errors on partial data
        }
      }
    }
  }

  // Process any remaining data left in sseBuffer after the stream ended.
  // The last chunk may not end with \n, leaving the done event's data line stuck.
  if (sseBuffer.trim().length > 0) {
    for (const line of sseBuffer.split('\n')) {
      if (line.startsWith('data: ')) {
        try {
          const parsed = JSON.parse(line.slice(6));
          if (parsed.followUp !== undefined) {
            doneResult = parsed;
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  // If we have an unsent fragment and no done result yet, send it
  if (sentFragment.trim().length > 0 && insideFollowUp) {
    emitSentence(sentFragment.trim());
  }

  // Diagnostic: log what we got from each source
  if (!doneResult?.followUp) {
    console.warn('[conversation-phase] doneResult.followUp is null/missing.', {
      hasDoneResult: !!doneResult,
      streamedSentences: streamedSentences.length,
      fullTokensLen: fullTokens.length,
      followUpDone,
      insideFollowUp,
      sseBufferRemainder: sseBuffer.length,
    });
  }

  // Use the done result if available, otherwise try to parse from accumulated tokens
  if (doneResult) {
    // Belt-and-suspenders: if the done event lost the followUp (server parse error)
    // but we successfully streamed text to TTS, use the streamed text so the chat matches the voice.
    if (!doneResult.followUp && streamedSentences.length > 0) {
      console.warn('[conversation-phase] Substituting streamed text for lost followUp');
      doneResult.followUp = streamedSentences.join(' ');
    }
    return doneResult;
  }

  // Fallback: parse from full tokens
  const jsonMatch = fullTokens.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      // Same belt-and-suspenders: prefer streamed text over parsed followUp if it's null
      if (!parsed.followUp && streamedSentences.length > 0) {
        parsed.followUp = streamedSentences.join(' ');
      }
      return parsed;
    } catch {
      console.error('[conversation-phase] Failed to parse streamed JSON');
    }
  }

  // Last resort: if we streamed sentences to TTS, use them as the followUp
  if (streamedSentences.length > 0) {
    return { followUp: streamedSentences.join(' '), phaseComplete: false };
  }

  return { followUp: null, phaseComplete: false };
}

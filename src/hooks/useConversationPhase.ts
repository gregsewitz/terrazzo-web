'use client';

import { useState, useCallback, useRef } from 'react';
import type { ConversationMessage, PropertyAnchor } from '@/types';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { apiFetch } from '@/lib/api-client';

interface UseConversationPhaseOptions {
  phaseId: string;
  aiPrompt: string;
  followUps: string[];
  /** Called for each complete sentence as it arrives from streaming LLM */
  onSentence?: (sentence: string) => void;
  /** Called when the full AI response is complete (all sentences sent) */
  onResponseComplete?: () => void;
}

interface UseConversationPhaseReturn {
  messages: ConversationMessage[];
  isAnalyzing: boolean;
  isPhaseComplete: boolean;
  anchorsForReview: PropertyAnchor[];
  confirmAnchor: (googlePlaceId: string) => void;
  dismissAnchor: (googlePlaceId: string) => void;
  reResolvePlace: (name: string, originalSentiment: string) => void;
  sendMessage: (text: string) => Promise<void>;
  currentFollowUpIndex: number;
}

/**
 * Split text into complete sentences. Returns [completeSentences[], remainingFragment].
 * A sentence ends with . ! or ? followed by a space or end-of-string.
 */
function splitSentences(text: string): [string[], string] {
  const sentences: string[] = [];
  // Match sentences ending with .!? — but NOT abbreviations like "Mr." or "e.g."
  const re = /([^.!?]*[.!?])(?:\s+|$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    sentences.push(match[1].trim());
    lastIndex = re.lastIndex;
  }
  const remaining = text.slice(lastIndex).trim();
  return [sentences, remaining];
}

/**
 * Parse the streaming SSE from /api/onboarding/respond.
 * Extracts the followUp value progressively and calls onSentence for each complete sentence.
 */
async function consumeRespondStream(
  response: Response,
  onSentence: (sentence: string) => void,
): Promise<{ followUp: string | null; phaseComplete: boolean; userRequestedSkip?: boolean; correctedTranscript?: string }> {
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
  let doneResult: { followUp: string | null; phaseComplete: boolean; userRequestedSkip?: boolean; correctedTranscript?: string } | null = null;

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
                  onSentence(lastBit.trim());
                }
                insideFollowUp = false;
                followUpDone = true;
                sentFragment = '';
              } else {
                sentFragment = combined;
                const [sentences, remaining] = splitSentences(sentFragment);
                for (const s of sentences) {
                  if (s.length > 0) onSentence(s);
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
                    if (s.length > 0) onSentence(s);
                  }
                  if (remaining.trim().length > 0) onSentence(remaining.trim());
                  followUpDone = true;
                } else {
                  // Still streaming — enter tracking mode
                  insideFollowUp = true;
                  followUpBuffer = chunk;
                  const [sentences, remaining] = splitSentences(followUpBuffer);
                  for (const s of sentences) {
                    if (s.length > 0) onSentence(s);
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

  // If we have an unsent fragment and no done result yet, send it
  if (sentFragment.trim().length > 0 && insideFollowUp) {
    onSentence(sentFragment.trim());
  }

  // Use the done result if available, otherwise try to parse from accumulated tokens
  if (doneResult) return doneResult;

  // Fallback: parse from full tokens
  const jsonMatch = fullTokens.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      console.error('[conversation-phase] Failed to parse streamed JSON');
    }
  }

  return { followUp: null, phaseComplete: false };
}

export function useConversationPhase({
  phaseId,
  aiPrompt,
  followUps,
  onSentence,
  onResponseComplete,
}: UseConversationPhaseOptions): UseConversationPhaseReturn {
  const {
    certainties,
    updateCertainties,
    addSignals,
    addMessages,
    addContradictions,
    setLifeContext,
    addTrustedSource,
    setGoBackPlace,
    addPropertyAnchors,
    removePropertyAnchor,
    addPendingAnchors,
    flushPendingAnchors,
    setCurrentPhaseProgress,
    allMessages: storedMessages,
    completedPhaseIds,
    allSignals,
    lifeContext,
    goBackPlace,
    trustedSources,
  } = useOnboardingStore();

  const onSentenceRef = useRef(onSentence);
  onSentenceRef.current = onSentence;
  const onResponseCompleteRef = useRef(onResponseComplete);
  onResponseCompleteRef.current = onResponseComplete;

  const previousMessages = storedMessages.filter((m) => m.phaseId === phaseId);
  const hasPreviousMessages = previousMessages.length > 0;
  const wasAlreadyCompleted = completedPhaseIds.includes(phaseId);

  const [messages, setMessages] = useState<ConversationMessage[]>(() =>
    hasPreviousMessages
      ? previousMessages
      : [{ role: 'ai', text: aiPrompt, phaseId }]
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPhaseComplete, setIsPhaseComplete] = useState(wasAlreadyCompleted);
  const [anchorsForReview, setAnchorsForReview] = useState<PropertyAnchor[]>([]);
  const followUpIndex = useRef(0);
  const phaseCompleteRef = useRef(wasAlreadyCompleted); // tracks phase completion for async callbacks

  const sendMessage = useCallback(async (text: string) => {
    if (isAnalyzing || isPhaseComplete) return;

    const userMsg: ConversationMessage = { role: 'user', text, phaseId };
    setMessages((prev) => [...prev, userMsg]);
    setIsAnalyzing(true);

    try {
      const allMsgs = [...messages, userMsg];
      const userMessageCount = allMsgs.filter((m) => m.role === 'user').length;

      // Build cross-phase context
      const priorPhaseMessages = storedMessages.filter((m) => m.phaseId !== phaseId && m.role === 'user');
      const priorUserSummaries = priorPhaseMessages.length > 0
        ? priorPhaseMessages.slice(-15).map((m) => m.text)
        : undefined;
      const priorAiMessages = storedMessages.filter((m) => m.phaseId !== phaseId && m.role === 'ai');
      const priorAiQuestions = priorAiMessages.length > 0
        ? priorAiMessages.filter((m) => m.text.includes('?')).slice(-10).map((m) => m.text)
        : undefined;
      const currentPhaseAiQuestions = allMsgs
        .filter((m) => m.role === 'ai' && m.text.includes('?'))
        .map((m) => m.text);

      const crossPhaseContext = {
        completedPhases: completedPhaseIds,
        lifeContext: Object.keys(lifeContext).length > 1 ? lifeContext : undefined,
        keySignals: allSignals.length > 0
          ? allSignals.filter((s) => s.confidence >= 0.8).slice(-20).map((s) => `${s.tag} (${s.cat})`)
          : undefined,
        trustedSources: trustedSources.length > 0 ? trustedSources.map((s) => s.name) : undefined,
        goBackPlace: goBackPlace?.placeName || undefined,
        priorUserMessages: priorUserSummaries,
        priorAiQuestions,
        currentPhaseAiQuestions: currentPhaseAiQuestions.length > 0 ? currentPhaseAiQuestions : undefined,
      };

      const requestBody = {
        userText: text,
        conversationHistory: allMsgs,
        phaseId,
        certainties,
        userMessageCount,
        crossPhaseContext,
      };

      // ── STEP 1: Streaming conversational response ──
      const respondPromise = fetch('/api/onboarding/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      // ── STEP 2: Background signal extraction (fire-and-forget) ──
      const extractPromise = fetch('/api/onboarding/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }).then(async (res) => {
        if (!res.ok) {
          console.error('[conversation-phase] Extract API returned', res.status);
          return null;
        }
        return res.json();
      }).catch((err) => {
        console.warn('[conversation-phase] Extract failed (non-blocking):', err);
        return null;
      });

      const respondRes = await respondPromise;
      if (!respondRes.ok) {
        console.error('[conversation-phase] Respond API returned', respondRes.status);
        throw new Error(`Respond failed: ${respondRes.status}`);
      }

      // Consume the SSE stream — sentences are piped to TTS as they arrive
      const respondResult = await consumeRespondStream(
        respondRes,
        (sentence) => {
          onSentenceRef.current?.(sentence);
        }
      );

      // Signal that all sentences have been sent
      onResponseCompleteRef.current?.();

      // Correct garbled speech
      if (respondResult.correctedTranscript) {
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1 && m.role === 'user'
              ? { ...m, text: respondResult.correctedTranscript! }
              : m
          )
        );
        userMsg.text = respondResult.correctedTranscript;
      }

      // Exchange guards
      const MIN_EXCHANGES = 3;
      const MAX_EXCHANGES = 6;
      let phaseComplete = respondResult.phaseComplete;
      if (phaseComplete && userMessageCount < MIN_EXCHANGES && !respondResult.userRequestedSkip) {
        phaseComplete = false;
      }
      if (!phaseComplete && userMessageCount >= MAX_EXCHANGES) {
        phaseComplete = true;
      }

      const expectedExchanges = Math.max(followUps.length + 1, MIN_EXCHANGES);
      const progress = phaseComplete ? 1 : Math.min(0.95, userMessageCount / expectedExchanges);
      setCurrentPhaseProgress(progress);

      // Determine final AI message text
      let nextText: string;
      if (phaseComplete) {
        setIsPhaseComplete(true);
        phaseCompleteRef.current = true;
        const flushed = flushPendingAnchors();
        if (flushed.length > 0) setAnchorsForReview(flushed);

        let transitionText = respondResult.followUp || "That's really wonderful — I feel like I'm getting to know you. Let me take all of that in and we'll keep going.";
        const sentences = transitionText.match(/[^.!?]+[.!?]+/g) || [transitionText];
        const nonQuestions = sentences.filter(s => !s.trim().endsWith('?'));
        transitionText = nonQuestions.length > 0
          ? nonQuestions.join('').trim()
          : "That's really helpful — I'm picking up a lot from what you've shared.";
        nextText = transitionText;
      } else if (respondResult.followUp) {
        nextText = respondResult.followUp;
      } else if (followUpIndex.current < followUps.length) {
        console.warn('[conversation-phase] No followUp — using scripted fallback');
        // followUps contain "TOPIC:" directives for the AI — they're internal prompting
        // instructions, not user-facing text. Don't display them.
        // Instead use a generic warm transition and move to the next follow-up index.
        const warmTransitions = [
          "That's really interesting — tell me more about what stands out to you.",
          "I love hearing that. What else comes to mind when you think about it?",
          "That gives me a lot to work with. What's another detail that matters to you?",
          "Thanks for sharing that — I'm curious what else shaped that experience for you.",
        ];
        nextText = warmTransitions[followUpIndex.current % warmTransitions.length];
        followUpIndex.current += 1;
      } else {
        nextText = "This has been really revealing — I've picked up a lot from what you've shared. Let's keep the momentum going.";
        setIsPhaseComplete(true);
        phaseCompleteRef.current = true;
        const flushedFallback = flushPendingAnchors();
        if (flushedFallback.length > 0) setAnchorsForReview(flushedFallback);
      }

      const aiMsg: ConversationMessage = { role: 'ai', text: nextText, phaseId };
      setMessages((prev) => [...prev, aiMsg]);
      addMessages([userMsg, aiMsg]);

      // ── STEP 3: Process extraction results in background ──
      extractPromise.then((extractResult) => {
        if (!extractResult) return;

        if (extractResult.signals?.length) addSignals(extractResult.signals);
        if (extractResult.certainties) updateCertainties(extractResult.certainties);
        if (extractResult.contradictions?.length) addContradictions(extractResult.contradictions);
        if (extractResult.lifeContext && Object.keys(extractResult.lifeContext).length > 0) {
          setLifeContext(extractResult.lifeContext);
        }

        if (extractResult.trustedSources?.length) {
          extractResult.trustedSources.forEach((s: { type?: string; name?: string; context?: string; relationship?: string }) => {
            if (s.name) addTrustedSource({ type: (s.type as 'friend' | 'publication' | 'instagram' | 'newsletter') || 'friend', name: s.name, context: s.context, relationship: s.relationship });
          });
        } else if (extractResult.trustedSource?.name) {
          addTrustedSource({ type: extractResult.trustedSource.type || 'friend', name: extractResult.trustedSource.name, context: extractResult.trustedSource.context, relationship: extractResult.trustedSource.relationship });
        }

        if (extractResult.goBackPlace?.placeName) {
          setGoBackPlace({
            placeName: extractResult.goBackPlace.placeName,
            location: extractResult.goBackPlace.location,
            reason: extractResult.goBackPlace.reason,
            matchScore: undefined,
            calibrationStatus: 'confirmed',
          });
        }

        if (extractResult.contextModifiers?.length || extractResult.partnerTravelDynamic || extractResult.soloTravelIdentity) {
          const contextUpdate: Record<string, unknown> = {};
          if (extractResult.partnerTravelDynamic) contextUpdate.partnerTravelDynamic = extractResult.partnerTravelDynamic;
          if (extractResult.soloTravelIdentity) contextUpdate.soloTravelIdentity = extractResult.soloTravelIdentity;
          if (extractResult.contextModifiers?.length) contextUpdate.contextModifiers = extractResult.contextModifiers;
          if (Object.keys(contextUpdate).length > 0) setLifeContext(contextUpdate);
        }

        if (extractResult.emotionalDriverPrimary) {
          setLifeContext({ emotionalDriverPrimary: extractResult.emotionalDriverPrimary, emotionalDriverSecondary: extractResult.emotionalDriverSecondary || null });
        }

        if (extractResult.dreamDestinations?.length) {
          setLifeContext({ dreamDestinations: extractResult.dreamDestinations });
        }

        if (extractResult.mentionedPlaces?.length) {
          apiFetch<{ anchors: PropertyAnchor[] }>('/api/onboarding/resolve-places', {
            method: 'POST',
            body: JSON.stringify({ mentionedPlaces: extractResult.mentionedPlaces, phaseId }),
          })
            .then((data) => {
              if (data.anchors?.length) {
                addPendingAnchors(data.anchors);
                // If phase already completed (flush already happened), show late-arriving
                // anchors directly — they missed the flush window
                if (phaseCompleteRef.current) {
                  const lateFlushed = flushPendingAnchors();
                  if (lateFlushed.length > 0) {
                    setAnchorsForReview((prev) => {
                      const existingIds = new Set(prev.map((a) => a.googlePlaceId));
                      const newAnchors = lateFlushed.filter((a) => !existingIds.has(a.googlePlaceId));
                      return newAnchors.length > 0 ? [...prev, ...newAnchors] : prev;
                    });
                  }
                }
              }
            })
            .catch((err) => console.warn('[onboarding] Place resolution failed:', err));
        }
      });

    } catch (err) {
      console.error('[conversation-phase] API call failed:', err);
      let fallbackText: string;
      const acks = ["That's really interesting.", "I love that.", "Thanks for sharing that.", "That gives me a lot to work with."];
      const ack = acks[Math.floor(Math.random() * acks.length)];

      // followUps contain "TOPIC:" directives for the AI — internal prompting, not user-facing.
      // Use warm generic transitions instead, and advance the follow-up index.
      const errorTransitions = [
        `${ack} Tell me more about what stands out to you.`,
        `${ack} What else comes to mind?`,
        `${ack} What's another detail that matters to you?`,
        `${ack} I'm curious what else shaped that for you.`,
      ];
      if (followUpIndex.current < followUps.length) {
        fallbackText = errorTransitions[followUpIndex.current % errorTransitions.length];
        followUpIndex.current += 1;
      } else {
        fallbackText = "I think I've got what I need here — let's keep going.";
      }

      const aiMsg: ConversationMessage = { role: 'ai', text: fallbackText, phaseId };
      setMessages((prev) => [...prev, aiMsg]);
      addMessages([userMsg, aiMsg]);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, isPhaseComplete, messages, phaseId, certainties, followUps, addSignals, updateCertainties, addContradictions, addMessages, setLifeContext, addTrustedSource, setGoBackPlace, addPendingAnchors, flushPendingAnchors, setCurrentPhaseProgress, completedPhaseIds, allSignals, lifeContext, trustedSources, goBackPlace, storedMessages, addPropertyAnchors, removePropertyAnchor]);

  const confirmAnchor = useCallback((googlePlaceId: string) => {
    setAnchorsForReview((prev) => prev.filter((a) => a.googlePlaceId !== googlePlaceId));
  }, []);

  const dismissAnchor = useCallback((googlePlaceId: string) => {
    removePropertyAnchor(googlePlaceId);
    setAnchorsForReview((prev) => prev.filter((a) => a.googlePlaceId !== googlePlaceId));
  }, [removePropertyAnchor]);

  const reResolvePlace = useCallback((name: string, originalSentiment: string) => {
    apiFetch<{ anchors: PropertyAnchor[] }>('/api/onboarding/resolve-places', {
      method: 'POST',
      body: JSON.stringify({ mentionedPlaces: [{ name, sentiment: originalSentiment, confidence: 1.0 }], phaseId }),
    })
      .then((data) => {
        if (data.anchors?.length) {
          addPropertyAnchors(data.anchors);
          setAnchorsForReview((prev) => [...prev, ...data.anchors]);
        }
      })
      .catch((err) => console.warn('[onboarding] Re-resolve failed:', err));
  }, [phaseId, addPropertyAnchors]);

  return {
    messages,
    isAnalyzing,
    isPhaseComplete,
    anchorsForReview,
    confirmAnchor,
    dismissAnchor,
    reResolvePlace,
    sendMessage,
    currentFollowUpIndex: followUpIndex.current,
  };
}

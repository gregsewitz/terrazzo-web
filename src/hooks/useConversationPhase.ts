'use client';

import { useState, useCallback, useRef } from 'react';
import type { AnalysisResult, ConversationMessage, TasteSignal, TasteContradiction, MentionedPlace, PropertyAnchor } from '@/types';
import { useOnboardingStore } from '@/stores/onboardingStore';

interface UseConversationPhaseOptions {
  phaseId: string;
  aiPrompt: string;
  followUps: string[];
}

interface UseConversationPhaseReturn {
  messages: ConversationMessage[];
  isAnalyzing: boolean;
  isPhaseComplete: boolean;
  /** Anchors awaiting user verification at end of phase */
  anchorsForReview: PropertyAnchor[];
  /** Confirm one anchor (keeps it in store) */
  confirmAnchor: (googlePlaceId: string) => void;
  /** Dismiss one anchor and prompt user to type correct name */
  dismissAnchor: (googlePlaceId: string) => void;
  /** Re-resolve a dismissed place by name typed by user */
  reResolvePlace: (name: string, originalSentiment: string) => void;
  sendMessage: (text: string) => Promise<void>;
  currentFollowUpIndex: number;
}

export function useConversationPhase({
  phaseId,
  aiPrompt,
  followUps,
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
    removePendingAnchor,
    setCurrentPhaseProgress,
    allMessages: storedMessages,
    completedPhaseIds,
    allSignals,
    lifeContext,
    goBackPlace,
    trustedSources,
  } = useOnboardingStore();

  // Restore previous messages for this phase from persisted store (for resume)
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

  const sendMessage = useCallback(async (text: string) => {
    if (isAnalyzing || isPhaseComplete) return;

    const userMsg: ConversationMessage = { role: 'user', text, phaseId };
    setMessages((prev) => [...prev, userMsg]);
    setIsAnalyzing(true);

    try {
      // Count user messages (excluding AI opening) to enforce minimum exchanges
      const allMessages = [...messages, userMsg];
      const userMessageCount = allMessages.filter((m) => m.role === 'user').length;

      // Build condensed cross-phase context so Claude knows what the user has already shared
      // Include summaries of user messages from prior phases so Claude remembers specific
      // hotels, places, and details the user mentioned (not just abstract taste signals)
      const priorPhaseMessages = storedMessages.filter((m) => m.phaseId !== phaseId && m.role === 'user');
      const priorUserSummaries = priorPhaseMessages.length > 0
        ? priorPhaseMessages.slice(-15).map((m) => m.text) // last 15 user messages from prior phases
        : undefined;
      // Also include AI questions from prior phases so Claude knows what was already asked
      const priorAiMessages = storedMessages.filter((m) => m.phaseId !== phaseId && m.role === 'ai');
      const priorAiQuestions = priorAiMessages.length > 0
        ? priorAiMessages.filter((m) => m.text.includes('?')).slice(-10).map((m) => m.text)
        : undefined;

      // Also include AI questions from the CURRENT phase to prevent repeats within the same phase
      const currentPhaseAiQuestions = allMessages
        .filter((m) => m.role === 'ai' && m.text.includes('?'))
        .map((m) => m.text);

      const crossPhaseContext = {
        completedPhases: completedPhaseIds,
        lifeContext: Object.keys(lifeContext).length > 1 ? lifeContext : undefined, // skip if only default
        keySignals: allSignals.length > 0
          ? allSignals
              .filter((s) => s.confidence >= 0.8)
              .slice(-20) // most recent high-confidence signals
              .map((s) => `${s.tag} (${s.cat})`)
          : undefined,
        trustedSources: trustedSources.length > 0 ? trustedSources.map((s) => s.name) : undefined,
        goBackPlace: goBackPlace?.placeName || undefined,
        priorUserMessages: priorUserSummaries,
        priorAiQuestions,
        currentPhaseAiQuestions: currentPhaseAiQuestions.length > 0 ? currentPhaseAiQuestions : undefined,
      };

      const res = await fetch('/api/onboarding/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userText: text,
          conversationHistory: allMessages,
          phaseId,
          certainties,
          userMessageCount,
          crossPhaseContext,
        }),
      });

      if (!res.ok) {
        console.error('[conversation-phase] API returned', res.status, res.statusText);
        throw new Error(`Analysis failed: ${res.status}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: AnalysisResult & { lifeContext?: Record<string, any>; trustedSource?: any; trustedSources?: any[]; goBackPlace?: any; contextModifiers?: any[]; partnerTravelDynamic?: string; soloTravelIdentity?: string; emotionalDriverPrimary?: string; emotionalDriverSecondary?: string; correctedTranscript?: string; userRequestedSkip?: boolean; mentionedPlaces?: MentionedPlace[] } = await res.json();

      // If Claude corrected garbled speech-to-text (e.g. "I'm on Geary" → "Amangiri"),
      // update the user's message bubble to show the corrected version
      if (result.correctedTranscript) {
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1 && m.role === 'user'
              ? { ...m, text: result.correctedTranscript! }
              : m
          )
        );
        // Also update the userMsg reference for store persistence
        userMsg.text = result.correctedTranscript;
      }

      // Update store — core taste data
      if (result.signals?.length) addSignals(result.signals);
      if (result.certainties) updateCertainties(result.certainties);
      if (result.contradictions?.length) addContradictions(result.contradictions);
      if (result.lifeContext && Object.keys(result.lifeContext).length > 0) {
        setLifeContext(result.lifeContext);
      }

      // Phase-specific structured data extraction

      // Phase 5: Trusted Sources
      if (result.trustedSources?.length) {
        result.trustedSources.forEach((s: { type?: string; name?: string; context?: string; relationship?: string }) => {
          if (s.name) addTrustedSource({ type: (s.type as 'friend' | 'publication' | 'instagram' | 'newsletter') || 'friend', name: s.name, context: s.context, relationship: s.relationship });
        });
      } else if (result.trustedSource?.name) {
        addTrustedSource({ type: result.trustedSource.type || 'friend', name: result.trustedSource.name, context: result.trustedSource.context, relationship: result.trustedSource.relationship });
      }

      // Phase 6: Go-Back Place
      if (result.goBackPlace?.placeName) {
        setGoBackPlace({
          placeName: result.goBackPlace.placeName,
          location: result.goBackPlace.location,
          reason: result.goBackPlace.reason,
          matchScore: undefined,
          calibrationStatus: 'confirmed',
        });
      }

      // Phase 3: Context modifiers — store as life context extensions
      if (result.contextModifiers?.length || result.partnerTravelDynamic || result.soloTravelIdentity) {
        const contextUpdate: Record<string, unknown> = {};
        if (result.partnerTravelDynamic) contextUpdate.partnerTravelDynamic = result.partnerTravelDynamic;
        if (result.soloTravelIdentity) contextUpdate.soloTravelIdentity = result.soloTravelIdentity;
        if (result.contextModifiers?.length) contextUpdate.contextModifiers = result.contextModifiers;
        if (Object.keys(contextUpdate).length > 0) setLifeContext(contextUpdate);
      }

      // Phase 10: Emotional drivers — store as life context
      if (result.emotionalDriverPrimary) {
        setLifeContext({ emotionalDriverPrimary: result.emotionalDriverPrimary, emotionalDriverSecondary: result.emotionalDriverSecondary || null });
      }

      // Property anchors: resolve mentioned places to real properties
      // Accumulate silently — shown at end of phase for batch verification
      if (result.mentionedPlaces?.length) {
        fetch('/api/onboarding/resolve-places', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mentionedPlaces: result.mentionedPlaces,
            phaseId,
          }),
        })
          .then((r) => r.json())
          .then((data: { anchors: PropertyAnchor[] }) => {
            if (data.anchors?.length) {
              // Queue for end-of-phase verification instead of showing inline
              addPendingAnchors(data.anchors);
              console.log(`[onboarding] Queued ${data.anchors.length} anchor(s) for verification:`, data.anchors.map((a) => a.propertyName));
            }
          })
          .catch((err) => {
            console.warn('[onboarding] Place resolution failed (non-blocking):', err);
          });
      }

      // Exchange guards:
      // Floor: don't let Claude end too early (< 3 user messages) unless user asked to skip
      // Ceiling: force phase complete if user has sent 6+ messages — prevent over-interrogation
      const MIN_EXCHANGES = 3;
      const MAX_EXCHANGES = 6;
      if (result.phaseComplete && userMessageCount < MIN_EXCHANGES && !result.userRequestedSkip) {
        result.phaseComplete = false;
      }
      if (!result.phaseComplete && userMessageCount >= MAX_EXCHANGES) {
        result.phaseComplete = true;
      }

      // Update progress bar — progressive fill based on exchange count relative to expected max
      // Use the number of scripted follow-ups + 1 (for the opening) as the expected conversation length
      const expectedExchanges = Math.max(followUps.length + 1, MIN_EXCHANGES);
      const progress = result.phaseComplete ? 1 : Math.min(0.95, userMessageCount / expectedExchanges);
      setCurrentPhaseProgress(progress);

      // Determine next AI message
      let nextText: string;
      if (result.phaseComplete) {
        setIsPhaseComplete(true);
        // Surface any pending anchors for batch verification
        const flushed = flushPendingAnchors();
        if (flushed.length > 0) {
          setAnchorsForReview(flushed);
        }
        // The transition message should NEVER contain a question — the next phase's
        // opening prompt will serve as the first question. If Claude included a question
        // (e.g. forced-complete via MAX_EXCHANGES, or Claude ignored the prompt rule),
        // strip the question sentence(s) to avoid showing a question + Continue button.
        let transitionText = result.followUp || "That's really wonderful — I feel like I'm getting to know you. Let me take all of that in and we'll keep going.";
        // Split into sentences, drop any that end with '?'
        const sentences = transitionText.match(/[^.!?]+[.!?]+/g) || [transitionText];
        const nonQuestions = sentences.filter(s => !s.trim().endsWith('?'));
        if (nonQuestions.length > 0) {
          transitionText = nonQuestions.join('').trim();
        } else {
          // Entire message was questions — replace with a warm generic wrap
          transitionText = "That's really helpful — I'm picking up a lot from what you've shared.";
        }
        nextText = transitionText;
      } else if (result.followUp) {
        nextText = result.followUp;
      } else if (followUpIndex.current < followUps.length) {
        // API succeeded but returned no followUp — use scripted fallback with acknowledgment
        console.warn('[conversation-phase] API returned no followUp — using scripted fallback');
        const acks = ["That's really interesting.", "Thanks for sharing that.", "I appreciate you telling me that."];
        const ack = acks[Math.floor(Math.random() * acks.length)];
        nextText = `${ack} ${followUps[followUpIndex.current]}`;
        followUpIndex.current += 1;
      } else {
        // All scripted follow-ups exhausted — gracefully wrap up
        nextText = "This has been really revealing — I've picked up a lot from what you've shared. Let's keep the momentum going.";
        setIsPhaseComplete(true);
        const flushedFallback = flushPendingAnchors();
        if (flushedFallback.length > 0) setAnchorsForReview(flushedFallback);
      }

      const aiMsg: ConversationMessage = { role: 'ai', text: nextText, phaseId };
      setMessages((prev) => [...prev, aiMsg]);

      // Persist messages to store
      addMessages([userMsg, aiMsg]);
    } catch (err) {
      console.error('[conversation-phase] API call failed — falling back to scripted follow-up:', err);
      // Build a contextual fallback rather than using a blind scripted follow-up.
      // Prefix with a brief acknowledgment so the user feels heard, then ask the scripted question.
      let fallbackText: string;
      const acknowledgments = [
        "That's really interesting.",
        "I love that.",
        "Thanks for sharing that.",
        "That gives me a lot to work with.",
      ];
      const ack = acknowledgments[Math.floor(Math.random() * acknowledgments.length)];

      if (followUpIndex.current < followUps.length) {
        fallbackText = `${ack} ${followUps[followUpIndex.current]}`;
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
  }, [isAnalyzing, isPhaseComplete, messages, phaseId, certainties, followUps, addSignals, updateCertainties, addContradictions, addMessages, setLifeContext, addTrustedSource, setGoBackPlace, addPendingAnchors, flushPendingAnchors, setCurrentPhaseProgress, completedPhaseIds, allSignals, lifeContext, trustedSources, goBackPlace]);

  const confirmAnchor = useCallback((googlePlaceId: string) => {
    // Anchor is already in propertyAnchors from flushPendingAnchors — just remove from review list
    setAnchorsForReview((prev) => prev.filter((a) => a.googlePlaceId !== googlePlaceId));
  }, []);

  const dismissAnchor = useCallback((googlePlaceId: string) => {
    // Remove from both review list and store
    removePropertyAnchor(googlePlaceId);
    setAnchorsForReview((prev) => prev.filter((a) => a.googlePlaceId !== googlePlaceId));
  }, [removePropertyAnchor]);

  const reResolvePlace = useCallback((name: string, originalSentiment: string) => {
    fetch('/api/onboarding/resolve-places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mentionedPlaces: [{ name, sentiment: originalSentiment, confidence: 1.0 }],
        phaseId,
      }),
    })
      .then((r) => r.json())
      .then((data: { anchors: PropertyAnchor[] }) => {
        if (data.anchors?.length) {
          addPropertyAnchors(data.anchors);
          // Add to review list so user can verify the new match
          setAnchorsForReview((prev) => [...prev, ...data.anchors]);
        }
      })
      .catch((err) => {
        console.warn('[onboarding] Re-resolve failed:', err);
      });
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

# Terrazzo Conversation Pipeline Audit

## ✅ Current Architecture (Post-Implementation)

```
User speaks → Browser SpeechRecognition → hold-to-speak release → 50ms delay →
POST /api/onboarding/respond (SSE stream, Claude Sonnet, lightweight prompt) →
  ├─ Tokens stream as SSE events
  ├─ Sentence boundary detection (client-side)
  ├─ Each sentence → POST /api/tts (ElevenLabs Flash v2.5) → play immediately
  └─ Later sentences TTS fires in parallel while earlier plays
Meanwhile: POST /api/onboarding/extract (fire-and-forget, background signal extraction)
```

**Estimated total latency from user finishing speech to hearing AI response: ~500ms-1s.**

Previous: 4-8 seconds. Best-in-class (Vapi, ElevenLabs Agents, Sierra): 300-600ms.

---

## Issue Status

### 1. ✅ RESOLVED: No Streaming — Everything Was Batch
**Solution:** `/api/onboarding/respond` now streams via SSE (Server-Sent Events). Each LLM token is forwarded to the client as it arrives. Client extracts the `followUp` value progressively from the JSON stream, detects sentence boundaries, and fires TTS per sentence.

### 2. ✅ RESOLVED: Overloaded Prompt — Claude Did Too Much Per Turn
**Solution:** Split into two endpoints:
- `/api/onboarding/respond` — Lightweight streaming, focused system prompt (~200 tokens), `max_tokens: 200`. Only generates conversational followUp.
- `/api/onboarding/extract` — Background, non-blocking. Full signal extraction, certainty updates, place detection, life context, phase-specific data. User never waits for this.

### 3. ✅ RESOLVED: TTS Was Batch, Not Streaming
**Solution:** `useTTS` now has a sentence-level playback queue:
- `queueSentence(s)` — fires TTS request immediately (overlapping with LLM streaming), adds to sequential playback queue
- `finishQueue()` — signals end of input, `onDone` fires after last sentence plays
- TTS requests for sentence N+1 fire while sentence N is playing

### 4. ⏸️ DEFERRED: Hold-to-Speak UX
**Decision:** Keep hold-to-speak for now (web browser mic permissions are unreliable). VAD-based turn detection deferred to future iteration.
**Improvement:** Post-release delay reduced from 150ms to 50ms.

### 5. ✅ RESOLVED: OpenAI tts-1 Quality Was Mediocre
**Solution:** Switched primary TTS to ElevenLabs Flash v2.5 (voice "Sarah"). Falls back to OpenAI `tts-1-hd` (speed 1.05) if no ElevenLabs key. ElevenLabs provides both better quality AND lower latency (~75ms model time).

### 6. ✅ RESOLVED: Rate Limiter Was Shared
**Solution:** Separate rate limit keys per endpoint:
- `ip:respond` — 20/min
- `ip:extract` — 20/min
- `ip:tts` — 30/min (higher because sentence chunking fires multiple requests per exchange)
- `ip:analyze` — 20/min (legacy endpoint, still available)

### 7. ✅ RESOLVED: Barge-in Support
**Solution:** Holding mic during TTS immediately stops playback and clears the TTS queue. User's speech is processed as new input. Full barge-in within the hold-to-speak model.

---

## Implementation Summary

### Phase 1: Quick Wins ✅
1. ✅ Split analyze API into respond + extract
2. ✅ Reduced max_tokens from 1024 to 200 for response calls
3. ✅ Switched TTS to ElevenLabs Flash v2.5
4. ✅ Fixed rate limiter — separate keys, higher limits
5. ✅ Dropped TTS speed from 1.12 to 1.05 (OpenAI fallback)

### Phase 2: Streaming Pipeline ✅
1. ✅ Streaming LLM response via SSE
2. ✅ Sentence-level TTS chunking with progressive playback
3. ✅ Progressive audio — first sentence plays while second generates
4. ✅ Target: ~500ms-1s from user speech to first audio

### Phase 3: Natural Interaction (Partial)
1. ⏸️ VAD-based turn detection — Deferred (browser mic issues)
2. ✅ Barge-in support — Hold mic to interrupt, immediate TTS stop + new input processing
3. ✅ ElevenLabs integration — Done in Phase 1
4. ⏸️ Ambient listening mode — Deferred (tied to VAD)

---

## Architecture Diagram

```
                    ┌─────────────────────────────────────────┐
                    │            ConversationView              │
                    │  (hold-to-speak, text fallback)          │
                    └────┬───────────────────┬────────────────┘
                         │                   │
                    sendMessage()       onSentence()
                         │                   │
              ┌──────────▼────────┐   ┌──────▼──────────┐
              │ useConversationPhase│  │     useTTS       │
              │                    │  │ (sentence queue)  │
              │ 1. consumeSSE()    │──│ queueSentence()   │
              │ 2. splitSentences()│  │ finishQueue()     │
              └──┬────────────┬───┘  └─────────┬────────┘
                 │            │                 │
    ┌────────────▼──┐  ┌─────▼──────┐   ┌─────▼──────────┐
    │ /respond (SSE) │  │ /extract   │   │ /tts           │
    │ Claude Sonnet  │  │ Claude     │   │ ElevenLabs     │
    │ 200 max_tokens │  │ Background │   │ Flash v2.5     │
    │ ~400ms TTFT    │  │ Fire&forget│   │ ~75ms/sentence │
    └────────────────┘  └────────────┘   └────────────────┘
```

---

## Latency Budget

| Step | Original | Current | Best-in-Class |
|------|----------|---------|---------------|
| User finishes speaking | 150ms wait | 50ms | 0ms (VAD) |
| API call (LLM) | 2-4s batch | ~400ms TTFT (streaming) | 200-400ms |
| TTS generation | 1-2s batch | ~75ms first sentence (ElevenLabs) | 75-135ms |
| Audio download + play | 200ms | 0ms (streaming/queued) | 0ms |
| **Total** | **4-8s** | **~500ms-1s** | **300-600ms** |

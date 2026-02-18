'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTripStore } from '@/stores/tripStore';
import { TravelContext, TripStatus, GeoDestination } from '@/types';
import DestinationInput, { Destination } from '@/components/DestinationInput';

// ============================================================
// Companion options — matching the React Native app
// ============================================================
const COMPANION_OPTIONS: { label: string; icon: string; key: TravelContext }[] = [
  { label: 'Just me', icon: '◇', key: 'solo' },
  { label: 'With partner', icon: '♥', key: 'partner' },
  { label: 'With friends', icon: '★', key: 'friends' },
  { label: 'With family', icon: '⌂', key: 'family' },
];

// ============================================================
// Trip conversation phases — scripted demo for web prototype
// ============================================================
interface ConversationMessage {
  role: 'terrazzo' | 'user';
  text: string;
}

const TRIP_CONVERSATION_PROMPTS = [
  "Tell me about this trip — what's the story? Even if it's still just a feeling, I'd love to hear what's pulling you.",
  "And who's coming along? What does the group dynamic look like — is this a 'plan everything together' crew or more of a 'meet at dinner' situation?",
  "You tend to care about the feel of a place — the light, the materials, the way it's run. Does that hold for this trip, or is the vibe different?",
  "Last one: if I could only get one thing right about this trip — the one thing that would make or break it — what would it be?",
];

const DEMO_TRIP_SIGNALS = [
  'Trip context mapped',
  'Companion dynamics captured',
  'Profile shifts identified',
  'Non-negotiables locked',
];

// ============================================================
// Step 1: Seed Form
// ============================================================
interface SeedData {
  name: string;
  destinations: string[];
  geoDestinations: GeoDestination[];
  startDate: string;
  endDate: string;
  companion: TravelContext;
  groupSize?: number;
  status: TripStatus;
}

function TripSeedForm({ onStart }: {
  onStart: (seed: SeedData) => void;
}) {
  const [geoDestinations, setGeoDestinations] = useState<Destination[]>([]);
  const [tripName, setTripName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [companion, setCompanion] = useState<TravelContext | null>(null);
  const [groupSize, setGroupSize] = useState('');
  const [status, setStatus] = useState<TripStatus>('planning');

  const canStart = geoDestinations.length > 0;

  // Auto-generate trip name from destinations if not manually set
  const effectiveName = tripName.trim() || geoDestinations.map(d => d.name).join(' & ');
  const destinationNames = geoDestinations.map(d => d.name);

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ scrollbarWidth: 'none' }}
    >
      <div className="px-6 pt-6 pb-10 max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">✈</div>
          <h1
            className="text-3xl mb-2"
            style={{ fontFamily: "var(--font-dm-serif-display), 'DM Serif Display', serif", color: 'var(--t-ink)' }}
          >
            New Trip
          </h1>
          <p className="text-sm leading-relaxed max-w-xs mx-auto" style={{ color: 'rgba(28,26,23,0.95)' }}>
            Give us the basics, then we'll have a quick conversation to understand what you're really looking for.
          </p>
        </div>

        {/* Trip Name (optional) */}
        <div className="mb-6">
          <label
            className="block text-[9px] font-bold uppercase tracking-[2.5px] mb-2"
            style={{ fontFamily: "'Space Mono', monospace", color: 'rgba(28,26,23,0.9)' }}
          >
            TRIP NAME (optional)
          </label>
          <input
            type="text"
            value={tripName}
            onChange={e => setTripName(e.target.value)}
            placeholder="e.g. Japan 2026, Anniversary Trip..."
            className="w-full text-base pb-2.5 bg-transparent border-0 border-b outline-none"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              color: 'var(--t-ink)',
              borderColor: 'var(--t-linen)',
            }}
          />
        </div>

        {/* Destination */}
        <div className="mb-6">
          <label
            className="block text-[9px] font-bold uppercase tracking-[2.5px] mb-2"
            style={{ fontFamily: "'Space Mono', monospace", color: 'rgba(28,26,23,0.9)' }}
          >
            WHERE
          </label>
          <DestinationInput
            destinations={geoDestinations}
            onChange={setGeoDestinations}
            isDreaming={status === 'dreaming'}
          />
        </div>

        {/* Date Range */}
        <div className="mb-6">
          <label
            className="block text-[9px] font-bold uppercase tracking-[2.5px] mb-2"
            style={{ fontFamily: "'Space Mono', monospace", color: 'rgba(28,26,23,0.9)' }}
          >
            WHEN
          </label>
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full text-sm pb-2.5 bg-transparent border-0 border-b outline-none"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  color: startDate ? 'var(--t-ink)' : 'rgba(28,26,23,0.9)',
                  borderColor: 'var(--t-linen)',
                }}
              />
              <span className="text-[9px] mt-1 block" style={{ color: 'rgba(28,26,23,0.95)' }}>Start</span>
            </div>
            <div className="flex items-center text-xs" style={{ color: 'rgba(28,26,23,0.95)' }}>→</div>
            <div className="flex-1">
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                min={startDate || undefined}
                className="w-full text-sm pb-2.5 bg-transparent border-0 border-b outline-none"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  color: endDate ? 'var(--t-ink)' : 'rgba(28,26,23,0.9)',
                  borderColor: 'var(--t-linen)',
                }}
              />
              <span className="text-[9px] mt-1 block" style={{ color: 'rgba(28,26,23,0.95)' }}>End</span>
            </div>
          </div>
        </div>

        {/* Companions */}
        <div className="mb-6">
          <label
            className="block text-[9px] font-bold uppercase tracking-[2.5px] mb-2"
            style={{ fontFamily: "'Space Mono', monospace", color: 'rgba(28,26,23,0.9)' }}
          >
            WHO'S COMING
          </label>
          <div className="flex flex-wrap gap-2">
            {COMPANION_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setCompanion(opt.key)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-full border cursor-pointer transition-all text-[12px]"
                style={{
                  background: companion === opt.key ? 'var(--t-ink)' : 'white',
                  color: companion === opt.key ? 'white' : 'var(--t-ink)',
                  borderColor: companion === opt.key ? 'var(--t-ink)' : 'var(--t-linen)',
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                }}
              >
                <span className="text-sm">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
          {(companion === 'friends' || companion === 'family') && (
            <div className="mt-3">
              <input
                type="number"
                min="2"
                max="20"
                value={groupSize}
                onChange={e => setGroupSize(e.target.value)}
                placeholder="How many people?"
                className="w-40 text-sm pb-2 bg-transparent border-0 border-b outline-none"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  color: 'var(--t-ink)',
                  borderColor: 'var(--t-linen)',
                }}
              />
            </div>
          )}
        </div>

        {/* Status */}
        <div className="mb-8">
          <label
            className="block text-[9px] font-bold uppercase tracking-[2.5px] mb-2"
            style={{ fontFamily: "'Space Mono', monospace", color: 'rgba(28,26,23,0.9)' }}
          >
            TRIP STATUS
          </label>
          <div className="flex gap-2">
            {([
              { key: 'planning' as TripStatus, label: 'Planning', icon: '●', desc: 'Dates committed, ready to build' },
              { key: 'dreaming' as TripStatus, label: 'Dreaming', icon: '◯', desc: 'Still taking shape' },
            ]).map(opt => (
              <button
                key={opt.key}
                onClick={() => setStatus(opt.key)}
                className="flex-1 flex flex-col items-start gap-1 p-3 rounded-xl border cursor-pointer transition-all"
                style={{
                  background: status === opt.key ? 'rgba(28,26,23,0.03)' : 'white',
                  borderColor: status === opt.key ? 'var(--t-ink)' : 'var(--t-linen)',
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[10px]"
                    style={{ color: status === opt.key ? 'var(--t-verde)' : 'rgba(28,26,23,0.9)' }}
                  >
                    {opt.icon}
                  </span>
                  <span
                    className="text-[12px] font-medium"
                    style={{ color: 'var(--t-ink)', fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {opt.label}
                  </span>
                </div>
                <span className="text-[10px]" style={{ color: 'rgba(28,26,23,0.9)' }}>
                  {opt.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => canStart && onStart({
            name: effectiveName,
            destinations: destinationNames,
            geoDestinations: geoDestinations as GeoDestination[],
            startDate: startDate || new Date().toISOString().split('T')[0],
            endDate: endDate || (() => {
              const d = new Date();
              d.setDate(d.getDate() + 5);
              return d.toISOString().split('T')[0];
            })(),
            companion: companion || 'solo',
            groupSize: groupSize ? parseInt(groupSize) : undefined,
            status,
          })}
          disabled={!canStart}
          className="w-full py-4 rounded-full border-none cursor-pointer text-[15px] font-semibold transition-all disabled:opacity-30"
          style={{
            background: 'var(--t-ink)',
            color: 'white',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Start Conversation
        </button>

        <p className="text-center text-[11px] mt-4" style={{ color: 'rgba(28,26,23,0.95)' }}>
          ~3 minutes · text or voice · we'll use your taste profile
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Step 2: Trip Conversation
// ============================================================
function TripConversation({
  seed,
  onComplete,
}: {
  seed: {
    name: string;
    destinations: string[];
    companion: TravelContext;
  };
  onComplete: () => void;
}) {
  const [messages, setMessages] = useState<ConversationMessage[]>([
    { role: 'terrazzo', text: TRIP_CONVERSATION_PROMPTS[0] },
  ]);
  const [promptIndex, setPromptIndex] = useState(0);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [signalsRevealed, setSignalsRevealed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const userText = input;
    setInput('');

    // Add user message
    setMessages(prev => [...prev, { role: 'user', text: userText }]);

    // Simulate Terrazzo typing
    setIsTyping(true);
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
    setIsTyping(false);

    const nextIdx = promptIndex + 1;

    if (nextIdx < TRIP_CONVERSATION_PROMPTS.length) {
      setMessages(prev => [...prev, { role: 'terrazzo', text: TRIP_CONVERSATION_PROMPTS[nextIdx] }]);
      setPromptIndex(nextIdx);
      setSignalsRevealed(prev => Math.min(prev + 1, DEMO_TRIP_SIGNALS.length));
    } else {
      // Conversation complete
      setMessages(prev => [...prev, {
        role: 'terrazzo',
        text: `Got it. I've mapped your trip context onto your taste profile — your ${seed.destinations[0]} recommendations will reflect everything we just discussed. Ready to build your trip.`,
      }]);
      setSignalsRevealed(DEMO_TRIP_SIGNALS.length);
      setIsDone(true);
    }

    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSkip = () => {
    setSignalsRevealed(DEMO_TRIP_SIGNALS.length);
    setIsDone(true);
    setMessages(prev => [...prev, {
      role: 'terrazzo',
      text: `No problem — we'll work with what we know. Your ${seed.destinations[0]} trip is ready to start building.`,
    }]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Trip context header */}
      <div
        className="px-5 py-3 border-b"
        style={{ borderColor: 'var(--t-linen)' }}
      >
        <div className="flex items-center justify-between mb-1">
          <h2
            className="text-lg"
            style={{ fontFamily: "var(--font-dm-serif-display), 'DM Serif Display', serif", color: 'var(--t-ink)' }}
          >
            Trip Conversation
          </h2>
          <span
            className="text-[8px] font-bold uppercase tracking-[1.5px] px-2.5 py-1 rounded-full"
            style={{ background: '#2d4a3a', color: 'white', fontFamily: "'Space Mono', monospace" }}
          >
            Trip Context
          </span>
        </div>
        <p className="text-[12px]" style={{ color: 'rgba(28,26,23,0.95)' }}>
          {seed.destinations.join(' → ')} · {seed.companion}
        </p>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-4"
        style={{ scrollbarWidth: 'none' }}
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className="max-w-[85%] px-4 py-3 rounded-2xl text-[13px] leading-relaxed"
              style={{
                background: msg.role === 'user' ? 'var(--t-ink)' : 'white',
                color: msg.role === 'user' ? 'white' : 'var(--t-ink)',
                fontFamily: "'DM Sans', sans-serif",
                borderBottomRightRadius: msg.role === 'user' ? 4 : undefined,
                borderBottomLeftRadius: msg.role === 'terrazzo' ? 4 : undefined,
                border: msg.role === 'terrazzo' ? '1px solid var(--t-linen)' : undefined,
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-2 items-center py-2 px-1">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--t-honey)' }} />
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--t-honey)', animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--t-honey)', animationDelay: '300ms' }} />
            </div>
            <span className="text-[12px] italic" style={{ color: 'rgba(28,26,23,0.9)' }}>Thinking...</span>
          </div>
        )}

        {/* Trip signals */}
        {signalsRevealed > 0 && (
          <div
            className="mt-3 p-3 rounded-xl border-l-[3px]"
            style={{ background: 'rgba(42,122,86,0.04)', borderLeftColor: 'var(--t-verde)' }}
          >
            <div
              className="text-[8px] font-bold uppercase tracking-[1.5px] mb-2"
              style={{ fontFamily: "'Space Mono', monospace", color: 'rgba(28,26,23,0.9)' }}
            >
              {signalsRevealed} trip signal{signalsRevealed !== 1 ? 's' : ''}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DEMO_TRIP_SIGNALS.slice(0, signalsRevealed).map((signal, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-1 rounded-full"
                  style={{ background: 'rgba(42,122,86,0.08)', color: 'var(--t-verde)' }}
                >
                  {signal}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div
        className="px-5 py-3 border-t"
        style={{ borderColor: 'var(--t-linen)' }}
      >
        {!isDone ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                placeholder={isTyping ? 'Thinking...' : 'Type your response...'}
                disabled={isTyping}
                autoFocus
                className="flex-1 px-3.5 py-2.5 rounded-xl border text-[13px] outline-none disabled:opacity-50"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  color: 'var(--t-ink)',
                  borderColor: 'var(--t-linen)',
                  background: 'white',
                }}
              />
              {input.trim() && (
                <button
                  onClick={handleSend}
                  disabled={isTyping}
                  className="px-4 py-2.5 rounded-xl border-none cursor-pointer text-[13px] font-semibold disabled:opacity-50"
                  style={{ background: 'var(--t-ink)', color: 'white' }}
                >
                  Send
                </button>
              )}
            </div>
            <button
              onClick={handleSkip}
              className="text-[12px] bg-transparent border-none cursor-pointer self-center py-1"
              style={{ color: 'rgba(28,26,23,0.9)' }}
            >
              Skip to trip →
            </button>
          </div>
        ) : (
          <button
            onClick={onComplete}
            className="w-full py-4 rounded-full border-none cursor-pointer text-[15px] font-semibold"
            style={{ background: 'var(--t-ink)', color: 'white', fontFamily: "'DM Sans', sans-serif" }}
          >
            Build My Trip
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Step 3: Trip Complete
// ============================================================
function TripComplete({ seed, onDone }: {
  seed: { name: string; destinations: string[] };
  onDone: () => void;
}) {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    setTimeout(() => setShowContent(true), 300);
  }, []);

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center px-8 transition-all duration-500"
      style={{ opacity: showContent ? 1 : 0, transform: showContent ? 'translateY(0)' : 'translateY(20px)' }}
    >
      <div className="text-5xl mb-4" style={{ color: 'var(--t-verde)' }}>✓</div>
      <h2
        className="text-3xl mb-3"
        style={{ fontFamily: "var(--font-dm-serif-display), 'DM Serif Display', serif", color: 'var(--t-ink)' }}
      >
        Trip Profile Built
      </h2>
      <p className="text-sm text-center leading-relaxed mb-8 max-w-xs" style={{ color: 'rgba(28,26,23,0.95)' }}>
        We've layered your trip context onto your base taste profile. Your {seed.destinations[0]} recommendations will
        reflect the specific energy, companions, and priorities for this journey.
      </p>

      <div
        className="w-full max-w-sm p-5 rounded-2xl mb-8 border"
        style={{ background: 'white', borderColor: 'var(--t-linen)' }}
      >
        <div className="text-[13px] font-semibold mb-3" style={{ color: 'var(--t-ink)' }}>
          What happens next
        </div>
        <div className="flex flex-col gap-1.5">
          {[
            'Places scored against your trip-adjusted profile',
            'Each destination gets its own curated shortlist',
            'Stretch picks that push your boundaries thoughtfully',
          ].map((item, i) => (
            <div key={i} className="text-[12px] leading-relaxed" style={{ color: 'rgba(28,26,23,0.95)' }}>
              • {item}
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onDone}
        className="px-10 py-4 rounded-full border-none cursor-pointer text-[15px] font-semibold"
        style={{ background: 'var(--t-ink)', color: 'white', fontFamily: "'DM Sans', sans-serif" }}
      >
        Go to Trip
      </button>
    </div>
  );
}

// ============================================================
// Main Page — 3 steps: seed → conversation → complete
// ============================================================
export default function NewTripPage() {
  const router = useRouter();
  const createTrip = useTripStore(s => s.createTrip);
  const [step, setStep] = useState<'seed' | 'conversation' | 'complete'>('seed');
  const [seed, setSeed] = useState<SeedData | null>(null);
  const [createdTripId, setCreatedTripId] = useState<string | null>(null);

  const handleSeedComplete = (s: SeedData) => {
    setSeed(s);
    setStep('conversation');
  };

  const handleConversationComplete = () => {
    if (!seed) return;

    // Actually create the trip in the store
    const tripId = createTrip({
      name: seed.name,
      destinations: seed.destinations,
      geoDestinations: seed.geoDestinations,
      startDate: seed.startDate,
      endDate: seed.endDate,
      travelContext: seed.companion,
      groupSize: seed.groupSize,
      status: seed.status,
    });

    setCreatedTripId(tripId);
    setStep('complete');
  };

  const handleDone = () => {
    if (createdTripId) {
      router.push(`/trips/${createdTripId}`);
    } else {
      router.push('/trips');
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--t-cream)', maxWidth: 480, margin: '0 auto' }}
    >
      {/* Back button */}
      <div className="flex items-center px-5 pt-3 pb-1">
        <button
          onClick={() => router.push('/trips')}
          className="w-10 h-10 flex items-center justify-center bg-transparent border-none cursor-pointer text-xl"
          style={{ color: 'var(--t-ink)' }}
        >
          ←
        </button>
        {step === 'conversation' && (
          <span
            className="text-base ml-1"
            style={{ fontFamily: "var(--font-dm-serif-display), 'DM Serif Display', serif", color: 'var(--t-ink)' }}
          >
            Trip Conversation
          </span>
        )}
      </div>

      {step === 'seed' && <TripSeedForm onStart={handleSeedComplete} />}
      {step === 'conversation' && seed && (
        <TripConversation
          seed={{ name: seed.name, destinations: seed.destinations, companion: seed.companion }}
          onComplete={handleConversationComplete}
        />
      )}
      {step === 'complete' && seed && (
        <TripComplete seed={{ name: seed.name, destinations: seed.destinations }} onDone={handleDone} />
      )}
    </div>
  );
}

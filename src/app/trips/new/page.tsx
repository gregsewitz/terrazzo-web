'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTripStore } from '@/stores/tripStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { TravelContext, TripStatus, GeoDestination } from '@/types';
import DestinationInput, { Destination } from '@/components/DestinationInput';
import { PerriandIcon, type PerriandIconName } from '@/components/icons/PerriandIcons';
import DesktopNav from '@/components/DesktopNav';
import DestinationAllocator from '@/components/DestinationAllocator';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import { FONT, INK } from '@/constants/theme';
import { SafeFadeIn } from '@/components/animations/SafeFadeIn';


// ============================================================
// Framer Motion Animation Constants
// ============================================================
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
const stepVariants = {
  enter: { opacity: 0, x: 40, scale: 0.98 },
  center: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.45, ease: EASE_OUT_EXPO } },
  exit: { opacity: 0, x: -40, scale: 0.98, transition: { duration: 0.25 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT_EXPO } },
};
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

// ============================================================
// Companion options — matching the React Native app
// ============================================================
const COMPANION_OPTIONS: { label: string; iconName: PerriandIconName; key: TravelContext }[] = [
  { label: 'Just me', iconName: 'profile', key: 'solo' },
  { label: 'With partner', iconName: 'heart', key: 'partner' },
  { label: 'With friends', iconName: 'friend', key: 'friends' },
  { label: 'With family', iconName: 'star', key: 'family' },
];

// ============================================================
// Trip conversation — live Claude AI with scripted fallback
// ============================================================
interface ConversationMessage {
  role: 'terrazzo' | 'user';
  text: string;
}

const FALLBACK_PROMPTS = [
  "Tell me about this trip — what's the story? Even if it's still just a feeling, I'd love to hear what's pulling you.",
  "And who's coming along? What does the group dynamic look like — is this a 'plan everything together' crew or more of a 'meet at dinner' situation?",
  "You tend to care about the feel of a place — the light, the materials, the way it's run. Does that hold for this trip, or is the vibe different?",
  "Last one: if I could only get one thing right about this trip — the one thing that would make or break it — what would it be?",
];

const FALLBACK_SIGNALS = [
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
  flexibleDates?: boolean;
  numDays?: number;
  companion: TravelContext;
  groupSize?: number;
  status: TripStatus;
  dayAllocation?: Record<string, number>;
}

function TripSeedForm({ onStart, initialSeed }: {
  onStart: (seed: SeedData) => void;
  initialSeed?: SeedData | null;
}) {
  const [geoDestinations, setGeoDestinations] = useState<Destination[]>(
    initialSeed?.geoDestinations || []
  );
  const [tripName, setTripName] = useState(initialSeed?.name || '');
  const [flexibleDates, setFlexibleDates] = useState(initialSeed?.flexibleDates || false);
  const [numDays, setNumDays] = useState(String(initialSeed?.numDays || 5));
  const [startDate, setStartDate] = useState(initialSeed?.startDate || '');
  const [endDate, setEndDate] = useState(initialSeed?.endDate || '');
  const [companion, setCompanion] = useState<TravelContext | null>(initialSeed?.companion || null);
  const [groupSize, setGroupSize] = useState(initialSeed?.groupSize ? String(initialSeed.groupSize) : '');
  const [status, setStatus] = useState<TripStatus>(initialSeed?.status || 'planning');

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
          <SafeFadeIn delay={0.1} direction="up" distance={12}>
            <div className="text-5xl mb-4">
              ✈
            </div>
          </SafeFadeIn>
          <SafeFadeIn delay={0.16} direction="up" distance={12}>
            <h1
              className="text-3xl mb-2"
              style={{ fontFamily: "var(--font-dm-serif-display), 'DM Serif Display', serif", color: 'var(--t-ink)' }}
            >
              New Trip
            </h1>
          </SafeFadeIn>
          <SafeFadeIn delay={0.22} direction="up" distance={12}>
            <p
              className="text-sm leading-relaxed max-w-xs mx-auto"
              style={{ color: INK['95'] }}
            >
              Give us the basics, then we'll have a quick conversation to understand what you're really looking for.
            </p>
          </SafeFadeIn>
        </div>

        {/* Trip Name (optional) */}
        <div className="mb-6">
          <label
            className="block text-[9px] font-bold uppercase tracking-[2.5px] mb-2"
            style={{ fontFamily: FONT.mono, color: INK['90'] }}
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
              fontFamily: FONT.sans,
              color: 'var(--t-ink)',
              borderColor: 'var(--t-linen)',
            }}
          />
        </div>

        {/* Destination */}
        <div className="mb-6">
          <label
            className="block text-[9px] font-bold uppercase tracking-[2.5px] mb-2"
            style={{ fontFamily: FONT.mono, color: INK['90'] }}
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
            style={{ fontFamily: FONT.mono, color: INK['90'] }}
          >
            WHEN
          </label>

          {/* Flexible toggle */}
          <div className="flex gap-2 mb-3">
            {([
              { key: false, label: 'Specific dates' },
              { key: true, label: 'Flexible / undecided' },
            ] as const).map(opt => (
              <motion.button
                key={String(opt.key)}
                whileTap={{ scale: 0.95 }}
                onClick={() => setFlexibleDates(opt.key)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border cursor-pointer transition-all text-[11px]"
                style={{
                  background: flexibleDates === opt.key ? 'var(--t-ink)' : 'white',
                  color: flexibleDates === opt.key ? 'white' : 'var(--t-ink)',
                  borderColor: flexibleDates === opt.key ? 'var(--t-ink)' : 'var(--t-linen)',
                  fontFamily: FONT.sans,
                  fontWeight: 500,
                }}
              >
                {opt.label}
              </motion.button>
            ))}
          </div>

          {flexibleDates ? (
            /* Flexible: just ask how many nights */
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="60"
                value={numDays}
                onChange={e => setNumDays(e.target.value)}
                className="w-20 text-center text-sm pb-2.5 bg-transparent border-0 border-b outline-none"
                style={{
                  fontFamily: FONT.sans,
                  color: 'var(--t-ink)',
                  borderColor: 'var(--t-linen)',
                }}
              />
              <span className="text-[12px]" style={{ color: INK['90'], fontFamily: FONT.sans }}>
                nights
              </span>
            </div>
          ) : (
            /* Specific dates: existing date pickers */
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => {
                    const newStart = e.target.value;
                    setStartDate(newStart);
                    // Auto-set end date to day after start if end is empty or before new start
                    if (newStart && (!endDate || endDate <= newStart)) {
                      const next = new Date(newStart + 'T00:00:00');
                      next.setDate(next.getDate() + 1);
                      setEndDate(next.toISOString().split('T')[0]);
                    }
                  }}
                  className="w-full text-sm pb-2.5 bg-transparent border-0 border-b outline-none"
                  style={{
                    fontFamily: FONT.sans,
                    color: startDate ? 'var(--t-ink)' : INK['90'],
                    borderColor: 'var(--t-linen)',
                  }}
                />
                <span className="text-[9px] mt-1 block" style={{ color: INK['95'] }}>Start</span>
              </div>
              <div className="flex items-center text-xs" style={{ color: INK['95'] }}>→</div>
              <div className="flex-1">
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  min={startDate || undefined}
                  className="w-full text-sm pb-2.5 bg-transparent border-0 border-b outline-none"
                  style={{
                    fontFamily: FONT.sans,
                    color: endDate ? 'var(--t-ink)' : INK['90'],
                    borderColor: 'var(--t-linen)',
                  }}
                />
                <span className="text-[9px] mt-1 block" style={{ color: INK['95'] }}>End</span>
              </div>
            </div>
          )}
        </div>

        {/* Companions */}
        <div className="mb-6">
          <label
            className="block text-[9px] font-bold uppercase tracking-[2.5px] mb-2"
            style={{ fontFamily: FONT.mono, color: INK['90'] }}
          >
            WHO'S COMING
          </label>
          <div className="flex flex-wrap gap-2">
            {COMPANION_OPTIONS.map(opt => (
              <motion.button
                key={opt.key}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCompanion(opt.key)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-full border cursor-pointer transition-all text-[12px]"
                style={{
                  background: companion === opt.key ? 'var(--t-ink)' : 'white',
                  color: companion === opt.key ? 'white' : 'var(--t-ink)',
                  borderColor: companion === opt.key ? 'var(--t-ink)' : 'var(--t-linen)',
                  fontFamily: FONT.sans,
                  fontWeight: 500,
                }}
              >
                <PerriandIcon name={opt.iconName} size={16} color={companion === opt.key ? 'white' : 'var(--t-ink)'} />
                {opt.label}
              </motion.button>
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
                  fontFamily: FONT.sans,
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
            style={{ fontFamily: FONT.mono, color: INK['90'] }}
          >
            TRIP STATUS
          </label>
          <div className="flex gap-2">
            {([
              { key: 'planning' as TripStatus, label: 'Planning', iconName: 'pin' as PerriandIconName, desc: 'Dates committed, ready to build' },
              { key: 'dreaming' as TripStatus, label: 'Dreaming', iconName: 'star' as PerriandIconName, desc: 'Still taking shape' },
            ]).map(opt => (
              <button
                key={opt.key}
                onClick={() => setStatus(opt.key)}
                className="flex-1 flex flex-col items-start gap-1 p-3 rounded-xl border cursor-pointer transition-all"
                style={{
                  background: status === opt.key ? INK['03'] : 'white',
                  borderColor: status === opt.key ? 'var(--t-ink)' : 'var(--t-linen)',
                }}
              >
                <div className="flex items-center gap-1.5">
                  <PerriandIcon
                    name={opt.iconName}
                    size={14}
                    color={status === opt.key ? 'var(--t-verde)' : INK['90']}
                  />
                  <span
                    className="text-[12px] font-medium"
                    style={{ color: 'var(--t-ink)', fontFamily: FONT.sans }}
                  >
                    {opt.label}
                  </span>
                </div>
                <span className="text-[10px]" style={{ color: INK['90'] }}>
                  {opt.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* CTA */}
        <motion.button
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => canStart && onStart({
            name: effectiveName,
            destinations: destinationNames,
            geoDestinations: geoDestinations as GeoDestination[],
            flexibleDates: flexibleDates || undefined,
            numDays: flexibleDates ? Math.max(1, parseInt(numDays) || 5) : undefined,
            startDate: flexibleDates ? '' : (startDate || new Date().toISOString().split('T')[0]),
            endDate: flexibleDates ? '' : (endDate || (() => {
              const d = new Date();
              d.setDate(d.getDate() + 5);
              return d.toISOString().split('T')[0];
            })()),
            companion: companion || 'solo',
            groupSize: groupSize ? parseInt(groupSize) : undefined,
            status,
          })}
          disabled={!canStart}
          className="w-full py-4 rounded-full border-none cursor-pointer text-[15px] font-semibold transition-all disabled:opacity-30"
          style={{
            background: 'var(--t-ink)',
            color: 'white',
            fontFamily: FONT.sans,
          }}
        >
          Start Conversation
        </motion.button>

        <p className="text-center text-[11px] mt-4" style={{ color: INK['95'] }}>
          ~3 minutes · text or voice · we'll use your taste profile
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Step 1b: Destination Day Allocator (multi-city only)
// ============================================================
function DestinationAllocationStep({
  seed,
  onComplete,
  onBack,
}: {
  seed: SeedData;
  onComplete: (allocation: Record<string, number>) => void;
  onBack: () => void;
}) {
  // Calculate total nights from dates or numDays
  // March 1–3 = 2 nights (check-in Mar 1, check-in Mar 2, depart Mar 3)
  const totalNights = seed.flexibleDates
    ? (seed.numDays || 5)
    : (() => {
        const start = new Date(seed.startDate + 'T00:00:00');
        const end = new Date(seed.endDate + 'T00:00:00');
        return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      })();

  // Initialize allocation: use existing if available, otherwise even split
  const [allocation, setAllocation] = useState<Record<string, number>>(() => {
    if (seed.dayAllocation && Object.keys(seed.dayAllocation).length > 0) {
      return seed.dayAllocation;
    }
    const perDest = Math.floor(totalNights / seed.destinations.length);
    const remainder = totalNights - perDest * seed.destinations.length;
    const alloc: Record<string, number> = {};
    seed.destinations.forEach((dest, i) => {
      alloc[dest] = perDest + (i < remainder ? 1 : 0);
    });
    return alloc;
  });

  return (
    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
      <div className="px-6 pt-6 pb-10 max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">
            <PerriandIcon name="location" size={40} color="var(--t-verde)" />
          </div>
          <h1
            className="text-2xl mb-2"
            style={{ fontFamily: "var(--font-dm-serif-display), 'DM Serif Display', serif", color: 'var(--t-ink)' }}
          >
            How many nights in each place?
          </h1>
          <p className="text-sm leading-relaxed max-w-xs mx-auto" style={{ color: INK['60'] }}>
            You have {totalNights} night{totalNights !== 1 ? 's' : ''} across {seed.destinations.length} destinations.
            Your last destination includes your departure day.
          </p>
        </div>

        <DestinationAllocator
          destinations={seed.destinations}
          totalNights={totalNights}
          allocation={allocation}
          onChange={setAllocation}
        />

        {/* CTA */}
        {(() => {
          const currentTotal = seed.destinations.reduce((sum, dest) => sum + (allocation[dest] || 1), 0);
          const isBalanced = currentTotal === totalNights;
          return (
            <button
              onClick={() => isBalanced && onComplete(allocation)}
              disabled={!isBalanced}
              className="w-full py-4 rounded-full border-none cursor-pointer text-[15px] font-semibold transition-all disabled:opacity-30"
              style={{
                background: 'var(--t-ink)',
                color: 'white',
                fontFamily: FONT.sans,
              }}
            >
              Looks Good
            </button>
          );
        })()}

        <button
          onClick={onBack}
          className="w-full text-center text-[12px] bg-transparent border-none cursor-pointer py-3 mt-1"
          style={{ color: INK['50'] }}
        >
          ← Back to details
        </button>
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
  seed: SeedData;
  onComplete: () => void;
}) {
  const generatedProfile = useOnboardingStore(s => s.generatedProfile);
  const [messages, setMessages] = useState<ConversationMessage[]>([
    { role: 'terrazzo', text: FALLBACK_PROMPTS[0] },
  ]);
  const [userMessageCount, setUserMessageCount] = useState(0);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [signals, setSignals] = useState<string[]>([]);
  const fallbackIndex = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const userText = input;
    setInput('');
    const nextCount = userMessageCount + 1;
    setUserMessageCount(nextCount);

    // Add user message
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsTyping(true);

    try {
      const res = await fetch('/api/trips/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: userText,
          conversationHistory: [...messages, { role: 'user', text: userText }],
          messageCount: nextCount,
          tripContext: {
            name: seed.name,
            destinations: seed.destinations,
            startDate: seed.startDate,
            endDate: seed.endDate,
            companion: seed.companion,
            groupSize: seed.groupSize,
            status: seed.status,
          },
          userProfile: generatedProfile || undefined,
        }),
      });

      const data = await res.json();
      setIsTyping(false);

      if (data.response) {
        setMessages(prev => [...prev, { role: 'terrazzo', text: data.response }]);
      }
      if (data.signals?.length) {
        setSignals(data.signals);
      }
      if (data.isComplete) {
        setSignals(prev => prev.length >= 4 ? prev : FALLBACK_SIGNALS);
        setIsDone(true);
      }
    } catch {
      // Fallback to scripted prompts on API failure
      setIsTyping(false);
      fallbackIndex.current += 1;
      const idx = fallbackIndex.current;

      if (idx < FALLBACK_PROMPTS.length) {
        setMessages(prev => [...prev, { role: 'terrazzo', text: FALLBACK_PROMPTS[idx] }]);
        setSignals(FALLBACK_SIGNALS.slice(0, idx));
      } else {
        setMessages(prev => [...prev, {
          role: 'terrazzo',
          text: `Got it. I've mapped your trip context — your ${seed.destinations[0]} recommendations are ready. Let's build your trip.`,
        }]);
        setSignals(FALLBACK_SIGNALS);
        setIsDone(true);
      }
    }

    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSkip = () => {
    setSignals(FALLBACK_SIGNALS);
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
            style={{ background: '#2d4a3a', color: 'white', fontFamily: FONT.mono }}
          >
            Trip Context
          </span>
        </div>
        <p className="text-[12px]" style={{ color: INK['95'] }}>
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
          <SafeFadeIn
            key={idx}
            direction={msg.role === "user" ? "right" : "left"}
            distance={msg.role === "user" ? 20 : 20}
            scale={0.95}
            duration={0.35}
            className={`mb-3 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className="max-w-[85%] px-4 py-3 rounded-2xl text-[13px] leading-relaxed"
              style={{
                background: msg.role === 'user' ? 'var(--t-ink)' : 'white',
                color: msg.role === 'user' ? 'white' : 'var(--t-ink)',
                fontFamily: FONT.sans,
                borderBottomRightRadius: msg.role === 'user' ? 4 : undefined,
                borderBottomLeftRadius: msg.role === 'terrazzo' ? 4 : undefined,
                border: msg.role === 'terrazzo' ? '1px solid var(--t-linen)' : undefined,
              }}
            >
              {msg.text}
            </div>
          </SafeFadeIn>
        ))}

        {isTyping && (
          <div className="flex gap-2 items-center py-2 px-1">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span 
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.15 }}
                  style={{ background: 'var(--t-honey)' }}
                />
              ))}
            </div>
            <span className="text-[12px] italic" style={{ color: INK['90'] }}>Thinking...</span>
          </div>
        )}

        {/* Trip signals */}
        {signals.length > 0 && (
          <SafeFadeIn direction="up" distance={10} duration={0.45}>
            <div
              className="mt-3 p-3 rounded-xl border-l-[3px]"
              style={{ background: 'rgba(42,122,86,0.04)', borderLeftColor: 'var(--t-verde)' }}
            >
              <div
                className="text-[8px] font-bold uppercase tracking-[1.5px] mb-2"
                style={{ fontFamily: FONT.mono, color: INK['90'] }}
              >
                {signals.length} trip signal{signals.length !== 1 ? 's' : ''}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {signals.map((signal, i) => (
                  <SafeFadeIn
                    key={i}
                    delay={0.06 * i}
                    direction="up"
                    distance={8}
                    duration={0.4}
                  >
                    <span
                      className="text-[10px] px-2 py-1 rounded-full"
                      style={{ background: 'rgba(42,122,86,0.08)', color: 'var(--t-verde)' }}
                    >
                      {signal}
                    </span>
                  </SafeFadeIn>
                ))}
              </div>
            </div>
          </SafeFadeIn>
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
                  fontFamily: FONT.sans,
                  color: 'var(--t-ink)',
                  borderColor: 'var(--t-linen)',
                  background: 'white',
                }}
              />
              {input.trim() && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSend}
                  disabled={isTyping}
                  className="px-4 py-2.5 rounded-xl border-none cursor-pointer text-[13px] font-semibold disabled:opacity-50"
                  style={{ background: 'var(--t-ink)', color: 'white' }}
                >
                  Send
                </motion.button>
              )}
            </div>
            <button
              onClick={handleSkip}
              className="text-[12px] bg-transparent border-none cursor-pointer self-center py-1"
              style={{ color: INK['90'] }}
            >
              Skip to trip →
            </button>
          </div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={onComplete}
            className="w-full py-4 rounded-full border-none cursor-pointer text-[15px] font-semibold"
            style={{ background: 'var(--t-ink)', color: 'white', fontFamily: FONT.sans }}
          >
            Build My Trip
          </motion.button>
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
  return (
    <SafeFadeIn direction="up" distance={20} duration={0.45} className="flex-1 flex flex-col items-center justify-center px-8">
      <SafeFadeIn
        delay={0}
        scale={0.8}
        direction="none"
        duration={0.5}
        className="text-5xl mb-4 flex justify-center"
      >
        <PerriandIcon name="check" size={48} color="var(--t-verde)" />
      </SafeFadeIn>
      <SafeFadeIn
        delay={0.1}
        direction="up"
        distance={10}
        duration={0.4}
        className="text-3xl mb-3"
        style={{ fontFamily: "var(--font-dm-serif-display), 'DM Serif Display', serif", color: 'var(--t-ink)' }}
      >
        Trip Profile Built
      </SafeFadeIn>
      <SafeFadeIn
        delay={0.15}
        direction="up"
        distance={10}
        duration={0.4}
        className="text-sm text-center leading-relaxed mb-8 max-w-xs"
        style={{ color: INK['95'] }}
      >
        We've layered your trip context onto your base taste profile. Your {seed.destinations[0]} recommendations will
        reflect the specific energy, companions, and priorities for this journey.
      </SafeFadeIn>

      <SafeFadeIn
        delay={0.2}
        direction="up"
        distance={10}
        duration={0.4}
        className="w-full max-w-sm p-5 rounded-2xl mb-8 border"
        style={{ background: 'white', borderColor: 'var(--t-linen)' }}
      >
        <div className="text-[13px] font-semibold mb-3" style={{ color: 'var(--t-ink)' }}>
          What happens next
        </div>
        <div className="flex flex-col gap-1.5">
          {[
            'Places scored against your trip-adjusted profile',
            'Each destination gets its own curated collection',
            'Stretch picks that push your boundaries thoughtfully',
          ].map((item, i) => (
            <SafeFadeIn
              key={i}
              delay={0.2 + 0.06 * i}
              direction="up"
              distance={8}
              duration={0.4}
              className="text-[12px] leading-relaxed"
              style={{ color: INK['95'] }}
            >
              • {item}
            </SafeFadeIn>
          ))}
        </div>
      </SafeFadeIn>

      <motion.button
        onClick={onDone}
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.98 }}
        className="px-10 py-4 rounded-full border-none cursor-pointer text-[15px] font-semibold"
        style={{ background: 'var(--t-ink)', color: 'white', fontFamily: FONT.sans }}
      >
        Go to Trip
      </motion.button>
    </SafeFadeIn>
  );
}
// ============================================================
// Main Page — steps: seed → [allocate] → conversation → complete
// ============================================================
export default function NewTripPage() {
  const router = useRouter();
  const createTripAsync = useTripStore(s => s.createTripAsync);
  const isDesktop = useIsDesktop();
  const [step, setStep] = useState<'seed' | 'allocate' | 'conversation' | 'complete'>('seed');
  const [seed, setSeed] = useState<SeedData | null>(null);
  const [createdTripId, setCreatedTripId] = useState<string | null>(null);

  const handleSeedComplete = (s: SeedData) => {
    setSeed(s);
    // If multi-destination + planning (has dates), show allocator
    if (s.destinations.length > 1 && s.status === 'planning') {
      setStep('allocate');
    } else {
      setStep('conversation');
    }
  };

  const handleAllocationComplete = (allocation: Record<string, number>) => {
    if (!seed) return;
    setSeed({ ...seed, dayAllocation: allocation });
    setStep('conversation');
  };

  const handleConversationComplete = async () => {
    if (!seed) return;

    // Actually create the trip in the store and wait for server ID
    const tripId = await createTripAsync({
      name: seed.name,
      destinations: seed.destinations,
      geoDestinations: seed.geoDestinations,
      flexibleDates: seed.flexibleDates,
      numDays: seed.numDays,
      startDate: seed.startDate,
      endDate: seed.endDate,
      travelContext: seed.companion,
      groupSize: seed.groupSize,
      status: seed.status,
      dayAllocation: seed.dayAllocation,
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
      style={{ background: 'var(--t-cream)' }}
    >
      {isDesktop ? (
        <>
          <DesktopNav />
          <div style={{ maxWidth: 720, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column', padding: '0 24px' }}>
            {/* Back button */}
            <div className="flex items-center pt-6 pb-2">
              <button
                onClick={() => router.push('/trips')}
                className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer link-hover"
                style={{ color: 'var(--t-verde)', fontFamily: FONT.sans, fontSize: 13, padding: 0 }}
              >
                ← Back to Trips
              </button>
              {step === 'conversation' && (
                <span
                  className="text-base ml-4"
                  style={{ fontFamily: "var(--font-dm-serif-display), 'DM Serif Display', serif", color: 'var(--t-ink)' }}
                >
                  Trip Conversation
                </span>
              )}
            </div>

            <AnimatePresence mode="wait">
              {step === 'seed' && (
                <motion.div key="seed" variants={stepVariants} initial="enter" animate="center" exit="exit">
                  <TripSeedForm onStart={handleSeedComplete} initialSeed={seed} />
                </motion.div>
              )}
              {step === 'allocate' && seed && (
                <motion.div key="allocate" variants={stepVariants} initial="enter" animate="center" exit="exit">
                  <DestinationAllocationStep
                    seed={seed}
                    onComplete={handleAllocationComplete}
                    onBack={() => setStep('seed')}
                  />
                </motion.div>
              )}
              {step === 'conversation' && seed && (
                <motion.div key="conversation" variants={stepVariants} initial="enter" animate="center" exit="exit">
                  <TripConversation
                    seed={seed}
                    onComplete={handleConversationComplete}
                  />
                </motion.div>
              )}
              {step === 'complete' && seed && (
                <motion.div key="complete" variants={stepVariants} initial="enter" animate="center" exit="exit">
                  <TripComplete seed={{ name: seed.name, destinations: seed.destinations }} onDone={handleDone} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      ) : (
        <div style={{ maxWidth: 480, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Back button */}
          <div className="flex items-center px-5 pt-4 pb-1">
            <button
              onClick={() => router.push('/trips')}
              className="flex items-center gap-1 bg-transparent border-none cursor-pointer"
              style={{ color: INK['60'], fontFamily: FONT.sans, fontSize: 13, padding: 0 }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 3L5 8L10 13" />
              </svg>
              Trips
            </button>
            {(step === 'conversation' || step === 'allocate') && (
              <span
                className="text-base ml-1"
                style={{ fontFamily: "var(--font-dm-serif-display), 'DM Serif Display', serif", color: 'var(--t-ink)' }}
              >
                {step === 'allocate' ? 'Day Allocation' : 'Trip Conversation'}
              </span>
            )}
          </div>

          <AnimatePresence mode="wait">
            {step === 'seed' && (
              <motion.div key="seed" variants={stepVariants} initial="enter" animate="center" exit="exit">
                <TripSeedForm onStart={handleSeedComplete} />
              </motion.div>
            )}
            {step === 'allocate' && seed && (
              <motion.div key="allocate" variants={stepVariants} initial="enter" animate="center" exit="exit">
                <DestinationAllocationStep
                  seed={seed}
                  onComplete={handleAllocationComplete}
                  onBack={() => setStep('seed')}
                />
              </motion.div>
            )}
            {step === 'conversation' && seed && (
              <motion.div key="conversation" variants={stepVariants} initial="enter" animate="center" exit="exit">
                <TripConversation
                  seed={seed}
                  onComplete={handleConversationComplete}
                />
              </motion.div>
            )}
            {step === 'complete' && seed && (
              <motion.div key="complete" variants={stepVariants} initial="enter" animate="center" exit="exit">
                <TripComplete seed={{ name: seed.name, destinations: seed.destinations }} onDone={handleDone} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

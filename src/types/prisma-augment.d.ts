/**
 * Type augmentation for Prisma Client
 * Provides type stubs when the Prisma client generator is unavailable
 * This file re-exports types based on the Prisma schema
 */

declare module '@prisma/client' {
  // ──────────────────────────────────────────────
  // Model Types
  // ──────────────────────────────────────────────

  export interface User {
    id: string;
    supabaseId: string;
    email: string;
    name: string | null;
    authProvider: string;
    tasteProfile: any;
    lifeContext: any;
    /** @deprecated TasteNode table is now the canonical signal store. Use /api/signals/mine or prisma.tasteNode instead. */
    allSignals: any;
    allContradictions: any;
    seedTrips: any;
    trustedSources: any;
    mosaicData: any;
    propertyAnchors: any;
    tasteStructure: any;
    isOnboardingComplete: boolean;
    onboardingDepth: string | null;
    completedPhaseIds: string[];
    onboardingRouting: any;
    tasteTrajectoryDirection: string | null;
    tasteTrajectoryDescription: string | null;
    tasteVectorUpdatedAt: Date | null;
    tasteVectorV3: any;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface SavedPlace {
    id: string;
    userId: string;
    googlePlaceId: string | null;
    name: string;
    type: string;
    location: string | null;
    source: any;
    userContext: string | null;
    timing: string | null;
    travelWith: string | null;
    intentStatus: string | null;
    importBatchId: string | null;
    importSources: any;
    rating: any;
    isFavorited: boolean;
    enrichment: any;
    whatToOrder: any;
    tips: any;
    alsoKnownAs: string | null;
    matchScore: number | null;
    matchBreakdown: any;
    matchExplanation: any;
    tasteNote: string | null;
    terrazzoInsight: any;
    googleData: any;
    sustainabilityScore: number | null;
    reliabilityScore: number | null;
    rhythmTempo: string | null;
    bestMonths: string[];
    formalityLevel: string | null;
    cuisineStyle: string | null;
    signalCount: number | null;
    antiSignalCount: number | null;
    heritageHighlight: string | null;
    yearEstablished: string | null;
    placeIntelligenceId: string | null;
    resolveAttempts: number;
    lastResolveAt: Date | null;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface Shortlist {
    id: string;
    userId: string;
    name: string;
    description: string | null;
    emoji: string;
    isDefault: boolean;
    isSmartCollection: boolean;
    query: string | null;
    filterTags: any;
    placeIds: any;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface Trip {
    id: string;
    userId: string;
    name: string;
    location: string;
    destinations: any;
    startDate: Date | null;
    endDate: Date | null;
    groupSize: number | null;
    groupType: string | null;
    vibe: string | null;
    days: any;
    pool: any;
    conversationHistory: any;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }

  // Stub all other models as any to avoid property errors
  export interface NylasGrant { [key: string]: any; }
  export interface EmailScan { [key: string]: any; }
  export interface EmailReservation { [key: string]: any; }
  export interface CollectionPlace { [key: string]: any; }
  export interface Place { [key: string]: any; }
  export interface ShareLink { [key: string]: any; }
  export interface TripCollaborator { [key: string]: any; }
  export interface TripSuggestion { [key: string]: any; }
  export interface TripReaction { [key: string]: any; }
  export interface SlotNote { [key: string]: any; }
  export interface TripActivity { [key: string]: any; }
  export interface WaitlistEntry { [key: string]: any; }
  export interface PlaceCache { [key: string]: any; }
  export interface PlaceIntelligence { [key: string]: any; }
  export interface PipelineRun { [key: string]: any; }
  export interface PipelineStageResult { [key: string]: any; }
  export interface TasteNode { [key: string]: any; }
  export interface TasteEdge { [key: string]: any; }
  export interface ContradictionNode { [key: string]: any; }
  export interface ContextModifier { [key: string]: any; }
  export interface SustainabilitySignal { [key: string]: any; }
  export interface TasteTrajectoryShift { [key: string]: any; }

  // ──────────────────────────────────────────────
  // Prisma Namespace
  // ──────────────────────────────────────────────

  export namespace Prisma {
    type JsonValue = any;
    type InputJsonValue = any;
    type NullableJsonNullValueInput = null | { DbNull: true } | { JsonNull: true };
    type JsonNullValueInput = { DbNull: true } | { JsonNull: true };

    const DbNull: { DbNull: true };
    const JsonNull: { JsonNull: true };

    interface UserDelegate {}
    interface SavedPlaceDelegate {}
    interface ShortlistDelegate {}
    interface TripDelegate {}
    interface NylasGrantDelegate {}
    interface EmailScanDelegate {}
    interface EmailReservationDelegate {}
    interface CollectionPlaceDelegate {}
    interface PlaceDelegate {}
    interface ShareLinkDelegate {}
    interface TripCollaboratorDelegate {}
    interface TripSuggestionDelegate {}
    interface TripReactionDelegate {}
    interface SlotNoteDelegate {}
    interface TripActivityDelegate {}
    interface WaitlistEntryDelegate {}
    interface PlaceCacheDelegate {}
    interface PlaceIntelligenceDelegate {}
    interface PipelineRunDelegate {}
    interface PipelineStageResultDelegate {}
    interface TasteNodeDelegate {}
    interface TasteEdgeDelegate {}
    interface ContradictionNodeDelegate {}
    interface ContextModifierDelegate {}
    interface SustainabilitySignalDelegate {}
    interface TasteTrajectoryShiftDelegate {}

    class PrismaClientRustPanicError extends Error {
      clientVersion: string;
    }

    interface ErrorWithBatchIndex extends PrismaClientRustPanicError {
      batchRequestIndex: number;
    }
  }

  // ──────────────────────────────────────────────
  // PrismaClient Class
  // ──────────────────────────────────────────────

  export class PrismaClient {
    constructor(options?: any);

    // Model accessors
    user: any;
    nylasGrant: any;
    emailScan: any;
    emailReservation: any;
    savedPlace: any;
    shortlist: any;
    collectionPlace: any;
    trip: any;
    place: any;
    shareLink: any;
    tripCollaborator: any;
    tripSuggestion: any;
    tripReaction: any;
    slotNote: any;
    tripActivity: any;
    waitlistEntry: any;
    placeCache: any;
    placeIntelligence: any;
    pipelineRun: any;
    pipelineStageResult: any;
    tasteNode: any;
    tasteEdge: any;
    contradictionNode: any;
    contextModifier: any;
    sustainabilitySignal: any;
    tasteTrajectoryShift: any;

    // Methods
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    $transaction<T>(callback: (tx: PrismaClient) => Promise<T>): Promise<T>;
    $transaction<T>(queries: any[], options?: any): Promise<T>;
    $on(event: 'beforeExit', callback: () => Promise<void>): void;
    $on(event: 'query', callback: (event: { query: string; params: string; duration: number; target: string }) => void): void;
    $queryRaw<T = unknown>(query: TemplateStringsArray | string, ...values: any[]): Promise<T>;
    $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Promise<T>;
    $executeRaw<T = unknown>(query: TemplateStringsArray | string, ...values: any[]): Promise<number>;
    $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Promise<number>;
  }

  export const Prisma: {
    PrismaClientRustPanicError: typeof Prisma.PrismaClientRustPanicError;
  };
}

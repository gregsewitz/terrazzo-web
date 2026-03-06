// ─── Interaction Event Schema ───────────────────────────────────────────────
//
// PURPOSE: Track every user×property interaction for eventual collaborative
// filtering. Content-based vectors (the 400-dim taste vector) are the primary
// recommendation signal today. This interaction log becomes the training data
// for a hybrid model once we have ~500-1000 active users with interaction history.
//
// AGGREGATION STRATEGY (future):
//   For each (user, property) pair, compute:
//     raw_score = Σ( signal_weight × exp(-age_days / 90) )
//   Normalize via tanh to [-1, 1]. This gives a time-decayed interaction
//   matrix suitable for ALS/SVD matrix factorization.
//
// HYBRID BLENDING (future):
//   final_score = α × content_similarity + (1-α) × collaborative_score
//   Start α=0.8, drift toward 0.5 as interaction data grows.
//
// ────────────────────────────────────────────────────────────────────────────

// ─── Event Types ───
// These map 1:1 to actions a user can actually take in the current product.

export type InteractionEventType =
  // ── Strong positive (0.5 – 1.0) ──
  | 'save_to_library'        // Added to personal library (addPlace)
  | 'add_to_collection'      // Curated into a named collection (addPlaceToCollection)
  | 'rate_love'              // Rated as "loved" or "myPlace" — strongest organic signal
  | 'rate_enjoy'             // Rated as "enjoyed" — solid positive

  // ── Medium positive (0.2 – 0.5) ──
  | 'add_to_trip'            // Placed into a trip day slot
  | 'return_visit'           // Opened the same place detail page again (2nd+ view)
  | 'property_dwell'         // Spent >30s on place detail page
  | 'save_from_shared'       // Saved a place from a shared collection/trip link
  | 'discover_tap'           // Tapped a recommendation card in the discover feed

  // ── Weak positive (0.05 – 0.2) ──
  | 'property_view'          // Opened place detail page (base impression)
  | 'map_pin_tap'            // Tapped a property pin on the trip/collection map

  // ── Negative (−0.1 – −0.5) ──
  | 'rate_skip'              // Rated as "skip" or "pass" — mild negative
  | 'rate_not_me'            // Rated as "notMe" — strong negative
  | 'remove_from_trip'       // Removed from a trip day slot
  | 'remove_from_collection' // Removed from a collection
  | 'remove_from_library'    // Deleted from library entirely
  | 'ghost_dismiss';         // Dismissed a ghost suggestion on the trip map

// ─── Signal Weights ───
// Pre-computed weight for each event type. Positive = affinity, negative = aversion.

export const INTERACTION_WEIGHTS: Record<InteractionEventType, number> = {
  // Strong positive
  save_to_library:        0.7,
  add_to_collection:      0.6,
  rate_love:              0.8,
  rate_enjoy:             0.5,

  // Medium positive
  add_to_trip:            0.5,
  return_visit:           0.4,
  property_dwell:         0.25,
  save_from_shared:       0.4,
  discover_tap:           0.3,

  // Weak positive
  property_view:          0.1,
  map_pin_tap:            0.05,

  // Negative
  rate_skip:             -0.15,
  rate_not_me:           -0.5,
  remove_from_trip:      -0.2,
  remove_from_collection:-0.3,
  remove_from_library:   -0.4,
  ghost_dismiss:         -0.3,
};

// ─── Surface / Context ───
// Where in the app the interaction happened. Maps to actual navigation surfaces.

export type InteractionSurface =
  | 'library'           // /saved — My Library view
  | 'collection'        // /saved/collections/[id] — inside a collection
  | 'trip'              // /trips/[id] — trip planner (day planner, board, map)
  | 'discover'          // /profile — discover feed (recommendations, editorial)
  | 'place_detail'      // /places/[googlePlaceId] — place detail page
  | 'shared'            // /shared/[token] — shared collection/trip
  | 'onboarding'        // /onboarding — property reactions during onboarding
  | 'trip_map';         // Trip map view (ghost suggestions, pin taps)

// ─── Event Shape ───

export interface InteractionEvent {
  id?: string;                      // UUID, auto-generated
  userId: string;                   // Prisma User.id (cuid)
  googlePlaceId: string;            // Property identifier (Google Places ID)
  eventType: InteractionEventType;
  signalWeight: number;             // Pre-computed from eventType
  surface: InteractionSurface;
  sessionId?: string;               // Group events within a browsing session
  metadata?: InteractionMetadata;
  createdAt?: string;               // ISO 8601, auto-generated
}

// ─── Event-Specific Metadata ───

export interface InteractionMetadata {
  // For rating events — the specific reaction chosen
  reaction?: 'myPlace' | 'enjoyed' | 'mixed' | 'notMe';
  ratingTags?: string[];            // Tags selected during rating
  returnIntent?: 'absolutely' | 'maybe' | 'probably_not';

  // For property_dwell
  dwellSeconds?: number;

  // For discover_tap — which card type drove the tap
  discoverCardType?: 'deep_match' | 'stretch_pick' | 'context_rec' | 'signal_thread' | 'taste_tension' | 'weekly_collection';

  // For add_to_collection / remove_from_collection
  collectionId?: string;
  collectionName?: string;

  // For trip context (add_to_trip, remove_from_trip, ghost_dismiss)
  tripId?: string;
  tripDay?: number;
  slotId?: string;

  // For save_from_shared
  shareToken?: string;              // Which shared link they came from
  sharedByUserId?: string;          // Who shared it

  // For return_visit
  visitCount?: number;              // Total visits to this property

  // Content-based bridge: taste domains this property covers
  // Populated from PlaceIntelligence.signals when available
  propertyDomains?: string[];

  // Place type for filtering analytics
  placeType?: string;               // 'hotel' | 'restaurant' | 'activity' | etc.
}

// ─── Aggregation Types (for future collaborative filtering) ───

export interface UserPropertyScore {
  userId: string;
  googlePlaceId: string;
  rawScore: number;         // Σ(weight × time_decay)
  normalizedScore: number;  // tanh(rawScore), range [-1, 1]
  eventCount: number;
  lastInteraction: string;  // ISO 8601
}

export interface UserEmbedding {
  userId: string;
  embedding: number[];      // k-dimensional (k ≈ 50-100)
  archetypeId?: string;     // Cluster assignment, once discovered
  archetypeName?: string;   // Human-readable cluster name
  updatedAt: string;
}

export interface PropertyEmbedding {
  googlePlaceId: string;
  embedding: number[];      // k-dimensional, same space as user embeddings
  updatedAt: string;
}

// ─── Archetype (future — discovered from clustering user embeddings) ───

export interface TasteArchetype {
  id: string;
  name: string;             // e.g. "Design Pilgrim", "Quiet Luxury Seeker"
  description: string;
  centroid: number[];        // Center of this cluster in embedding space
  memberCount: number;
  topProperties: string[];   // googlePlaceIds most loved by this archetype
  dominantSignals: string[]; // Taste signals that define this archetype
}

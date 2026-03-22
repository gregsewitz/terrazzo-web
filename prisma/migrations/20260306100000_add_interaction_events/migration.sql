-- Interaction Events: user×property interaction log for collaborative filtering
-- Every interaction is a row. Aggregated into an interaction matrix for
-- matrix factorization once we have enough users (~500-1000).

CREATE TABLE IF NOT EXISTS interaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  google_place_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  signal_weight REAL NOT NULL,
  surface TEXT NOT NULL,
  session_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for user-centric queries: "show me all interactions for user X"
CREATE INDEX idx_interaction_events_user
  ON interaction_events (user_id, created_at DESC);

-- Index for property-centric queries: "who interacted with property Y"
CREATE INDEX idx_interaction_events_property
  ON interaction_events (google_place_id, created_at DESC);

-- Index for building the interaction matrix: (user, property) pairs
CREATE INDEX idx_interaction_events_matrix
  ON interaction_events (user_id, google_place_id);

-- Index for event type filtering
CREATE INDEX idx_interaction_events_type
  ON interaction_events (event_type, created_at DESC);

-- RLS: users can only read their own interactions
ALTER TABLE interaction_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY interaction_events_user_read
  ON interaction_events FOR SELECT
  USING (user_id = (SELECT id FROM "User" WHERE "supabaseId" = auth.uid()::text));

CREATE POLICY interaction_events_user_insert
  ON interaction_events FOR INSERT
  WITH CHECK (user_id = (SELECT id FROM "User" WHERE "supabaseId" = auth.uid()::text));

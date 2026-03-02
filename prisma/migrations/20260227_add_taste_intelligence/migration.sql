-- Taste Intelligence: graph tables, v2 signal decay columns, sustainability, trajectory

-- Enable pgvector if not already enabled
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ──────────────────────────────────────────────
-- Core taste-graph tables (idempotent)
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "TasteNode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "signal" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "source" TEXT NOT NULL DEFAULT 'onboarding',
    "category" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TasteNode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TasteEdge" (
    "id" TEXT NOT NULL,
    "edgeType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TasteEdge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ContradictionNode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stated" TEXT NOT NULL,
    "revealed" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "matchRule" TEXT NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContradictionNode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ContextModifier" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "shifts" TEXT NOT NULL,
    "domainDeltas" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContextModifier_pkey" PRIMARY KEY ("id")
);

-- ──────────────────────────────────────────────
-- User taste vector columns (idempotent)
-- ──────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='User' AND column_name='tasteVector') THEN
    ALTER TABLE "User" ADD COLUMN "tasteVector" vector(34);
  ELSE
    -- Resize from vector(32) to vector(34) if it already exists
    ALTER TABLE "User" ALTER COLUMN "tasteVector" TYPE vector(34);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='User' AND column_name='tasteVectorUpdatedAt') THEN
    ALTER TABLE "User" ADD COLUMN "tasteVectorUpdatedAt" TIMESTAMP(3);
  END IF;
END $$;

-- ──────────────────────────────────────────────
-- Foreign keys for taste-graph (idempotent)
-- ──────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TasteNode_userId_fkey') THEN
    ALTER TABLE "TasteNode" ADD CONSTRAINT "TasteNode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContradictionNode_userId_fkey') THEN
    ALTER TABLE "ContradictionNode" ADD CONSTRAINT "ContradictionNode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContextModifier_userId_fkey') THEN
    ALTER TABLE "ContextModifier" ADD CONSTRAINT "ContextModifier_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ──────────────────────────────────────────────
-- Indexes for taste-graph (idempotent)
-- ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "TasteNode_userId_idx" ON "TasteNode"("userId");
CREATE INDEX IF NOT EXISTS "TasteNode_domain_idx" ON "TasteNode"("domain");
CREATE INDEX IF NOT EXISTS "TasteNode_userId_domain_idx" ON "TasteNode"("userId", "domain");
CREATE INDEX IF NOT EXISTS "TasteEdge_sourceId_idx" ON "TasteEdge"("sourceId");
CREATE INDEX IF NOT EXISTS "TasteEdge_targetId_idx" ON "TasteEdge"("targetId");
CREATE INDEX IF NOT EXISTS "TasteEdge_edgeType_idx" ON "TasteEdge"("edgeType");
CREATE INDEX IF NOT EXISTS "ContradictionNode_userId_idx" ON "ContradictionNode"("userId");
CREATE INDEX IF NOT EXISTS "ContextModifier_userId_idx" ON "ContextModifier"("userId");

-- ══════════════════════════════════════════════
-- V2: Signal decay columns on TasteNode
-- ══════════════════════════════════════════════

ALTER TABLE "TasteNode" ADD COLUMN IF NOT EXISTS "extractedAt" TIMESTAMP(3);
ALTER TABLE "TasteNode" ADD COLUMN IF NOT EXISTS "sourcePhaseId" TEXT;
ALTER TABLE "TasteNode" ADD COLUMN IF NOT EXISTS "sourceModality" TEXT;
ALTER TABLE "TasteNode" ADD COLUMN IF NOT EXISTS "decayedConfidence" DOUBLE PRECISION;
ALTER TABLE "TasteNode" ADD COLUMN IF NOT EXISTS "ageInDays" INTEGER;
ALTER TABLE "TasteNode" ADD COLUMN IF NOT EXISTS "supersededBy" TEXT;

-- ══════════════════════════════════════════════
-- V2: Sustainability Signals
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "SustainabilitySignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "dimension" TEXT NOT NULL,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SustainabilitySignal_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SustainabilitySignal_userId_fkey') THEN
    ALTER TABLE "SustainabilitySignal" ADD CONSTRAINT "SustainabilitySignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "SustainabilitySignal_userId_idx" ON "SustainabilitySignal"("userId");
CREATE INDEX IF NOT EXISTS "SustainabilitySignal_dimension_idx" ON "SustainabilitySignal"("dimension");

-- ══════════════════════════════════════════════
-- V2: Taste Trajectory Shifts
-- ══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "TasteTrajectoryShift" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "fromPattern" TEXT NOT NULL,
    "toPattern" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TasteTrajectoryShift_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TasteTrajectoryShift_userId_fkey') THEN
    ALTER TABLE "TasteTrajectoryShift" ADD CONSTRAINT "TasteTrajectoryShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "TasteTrajectoryShift_userId_idx" ON "TasteTrajectoryShift"("userId");
CREATE INDEX IF NOT EXISTS "TasteTrajectoryShift_domain_idx" ON "TasteTrajectoryShift"("domain");

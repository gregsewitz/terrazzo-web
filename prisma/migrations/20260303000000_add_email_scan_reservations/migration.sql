-- Email Scanning & Reservation Staging
-- Adds tables for Gmail integration via Nylas: scan history and parsed reservation inbox.

-- ── Update NylasGrant with new columns ─────────────────────────────────────

ALTER TABLE "NylasGrant"
  ADD COLUMN IF NOT EXISTS "scopes" TEXT[] DEFAULT ARRAY['https://www.googleapis.com/auth/gmail.readonly'],
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ── EmailScan ──────────────────────────────────────────────────────────────

CREATE TABLE "EmailScan" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "nylasGrantId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "scanType" TEXT NOT NULL DEFAULT 'full',
  "emailsFound" INTEGER NOT NULL DEFAULT 0,
  "emailsParsed" INTEGER NOT NULL DEFAULT 0,
  "reservationsFound" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "scanFrom" TIMESTAMP(3),
  "scanTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "EmailScan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailScan_userId_idx" ON "EmailScan"("userId");
CREATE INDEX "EmailScan_nylasGrantId_idx" ON "EmailScan"("nylasGrantId");

ALTER TABLE "EmailScan"
  ADD CONSTRAINT "EmailScan_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailScan"
  ADD CONSTRAINT "EmailScan_nylasGrantId_fkey"
  FOREIGN KEY ("nylasGrantId") REFERENCES "NylasGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── EmailReservation ───────────────────────────────────────────────────────

CREATE TABLE "EmailReservation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emailScanId" TEXT NOT NULL,

  -- Staging status
  "status" TEXT NOT NULL DEFAULT 'pending',
  "reviewedAt" TIMESTAMP(3),

  -- Email provenance
  "nylasMessageId" TEXT NOT NULL,
  "emailSubject" TEXT NOT NULL,
  "emailFrom" TEXT NOT NULL,
  "emailFromName" TEXT,
  "emailDate" TIMESTAMP(3) NOT NULL,

  -- Parsed reservation data
  "placeName" TEXT NOT NULL,
  "placeType" TEXT NOT NULL,
  "location" TEXT,
  "googlePlaceId" TEXT,

  -- Booking details
  "reservationDate" TIMESTAMP(3),
  "reservationTime" TEXT,
  "partySize" INTEGER,
  "confirmationNumber" TEXT,
  "provider" TEXT,

  -- Flight-specific
  "flightNumber" TEXT,
  "departureAirport" TEXT,
  "arrivalAirport" TEXT,
  "departureTime" TEXT,
  "arrivalTime" TEXT,

  -- Hotel-specific
  "checkInDate" TIMESTAMP(3),
  "checkOutDate" TIMESTAMP(3),

  -- Activity-specific
  "activityDetails" TEXT,

  -- Confidence & raw data
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "rawExtraction" JSONB,

  -- Trip matching
  "matchedTripId" TEXT,
  "matchedTripName" TEXT,
  "suggestedDayNumber" INTEGER,
  "suggestedSlotId" TEXT,

  -- Library link
  "savedPlaceId" TEXT,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailReservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailReservation_userId_idx" ON "EmailReservation"("userId");
CREATE INDEX "EmailReservation_emailScanId_idx" ON "EmailReservation"("emailScanId");
CREATE INDEX "EmailReservation_status_idx" ON "EmailReservation"("status");
CREATE INDEX "EmailReservation_reservationDate_idx" ON "EmailReservation"("reservationDate");

ALTER TABLE "EmailReservation"
  ADD CONSTRAINT "EmailReservation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailReservation"
  ADD CONSTRAINT "EmailReservation_emailScanId_fkey"
  FOREIGN KEY ("emailScanId") REFERENCES "EmailScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

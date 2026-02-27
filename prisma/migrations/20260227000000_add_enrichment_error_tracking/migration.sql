-- AlterTable
ALTER TABLE "PlaceIntelligence" ADD COLUMN "lastError" TEXT;
ALTER TABLE "PlaceIntelligence" ADD COLUMN "errorCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlaceIntelligence" ADD COLUMN "lastErrorAt" TIMESTAMP(3);
ALTER TABLE "PlaceIntelligence" ADD COLUMN "lastTriggeredBy" TEXT;

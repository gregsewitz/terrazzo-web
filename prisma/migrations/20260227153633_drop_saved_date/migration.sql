/*
  Warnings:

  - You are about to drop the column `savedDate` on the `SavedPlace` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SavedPlace" DROP COLUMN "savedDate";

-- AlterTable
ALTER TABLE "TripSuggestion" ADD COLUMN     "googlePlaceId" TEXT;

-- CreateTable
CREATE TABLE "CollectionPlace" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionPlace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectionPlace_placeId_idx" ON "CollectionPlace"("placeId");

-- CreateIndex
CREATE INDEX "CollectionPlace_collectionId_idx" ON "CollectionPlace"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionPlace_collectionId_placeId_key" ON "CollectionPlace"("collectionId", "placeId");

-- CreateIndex
CREATE INDEX "SavedPlace_type_idx" ON "SavedPlace"("type");

-- CreateIndex
CREATE INDEX "SavedPlace_matchScore_idx" ON "SavedPlace"("matchScore");

-- AddForeignKey
ALTER TABLE "CollectionPlace" ADD CONSTRAINT "CollectionPlace_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Shortlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionPlace" ADD CONSTRAINT "CollectionPlace_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "SavedPlace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

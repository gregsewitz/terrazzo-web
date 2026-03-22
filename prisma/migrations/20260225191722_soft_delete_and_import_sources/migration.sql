-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "addedByName" TEXT,
ADD COLUMN     "addedByUserId" TEXT,
ADD COLUMN     "libraryPlaceId" TEXT;

-- CreateIndex
CREATE INDEX "Place_libraryPlaceId_idx" ON "Place"("libraryPlaceId");

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_libraryPlaceId_fkey" FOREIGN KEY ("libraryPlaceId") REFERENCES "SavedPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

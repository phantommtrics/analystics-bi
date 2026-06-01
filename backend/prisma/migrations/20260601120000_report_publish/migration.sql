-- AlterTable
ALTER TABLE "SavedReport" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SavedReport" ADD COLUMN "publishedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "SavedReport_isPublished_idx" ON "SavedReport"("isPublished");

-- AlterTable
ALTER TABLE "Dashboard" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Dashboard" ADD COLUMN "publishedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Dashboard_isPublished_idx" ON "Dashboard"("isPublished");

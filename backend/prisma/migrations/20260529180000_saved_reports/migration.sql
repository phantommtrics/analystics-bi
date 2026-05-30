-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('FINANCIAL', 'OPERATIONAL', 'COMPLIANCE', 'AGENT', 'GENERAL');

-- CreateEnum
CREATE TYPE "ReportVisualization" AS ENUM ('BAR_CHART', 'LINE_CHART', 'PIE_CHART', 'TABLE_ONLY');

-- CreateTable
CREATE TABLE "SavedReport" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "ReportCategory" NOT NULL DEFAULT 'GENERAL',
    "sql" TEXT NOT NULL,
    "visualization" "ReportVisualization" NOT NULL DEFAULT 'BAR_CHART',
    "dataSourceId" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedReport_deletedAt_idx" ON "SavedReport"("deletedAt");

-- CreateIndex
CREATE INDEX "SavedReport_name_idx" ON "SavedReport"("name");

-- CreateIndex
CREATE INDEX "SavedReport_category_idx" ON "SavedReport"("category");

-- AddForeignKey
ALTER TABLE "SavedReport" ADD CONSTRAINT "SavedReport_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedReport" ADD CONSTRAINT "SavedReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedReport" ADD CONSTRAINT "SavedReport_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterEnum
ALTER TYPE "ReportCategory" ADD VALUE 'AGENTS';
ALTER TYPE "ReportCategory" ADD VALUE 'BALANCE';
ALTER TYPE "ReportCategory" ADD VALUE 'CUSTOMERS';
ALTER TYPE "ReportCategory" ADD VALUE 'BANKS';
ALTER TYPE "ReportCategory" ADD VALUE 'REMITTANCE';
ALTER TYPE "ReportCategory" ADD VALUE 'AML';
ALTER TYPE "ReportCategory" ADD VALUE 'RECONCILIATION';

-- AlterTable
ALTER TABLE "SavedReport" ADD COLUMN "showInSidebarMenu" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "SavedReport_showInSidebarMenu_idx" ON "SavedReport"("showInSidebarMenu");

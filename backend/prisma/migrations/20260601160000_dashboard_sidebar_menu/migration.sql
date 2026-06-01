-- AlterTable
ALTER TABLE "Dashboard" ADD COLUMN "showInSidebarMenu" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Dashboard" ADD COLUMN "sidebarCategory" "ReportCategory";

-- CreateIndex
CREATE INDEX "Dashboard_showInSidebarMenu_idx" ON "Dashboard"("showInSidebarMenu");
CREATE INDEX "Dashboard_sidebarCategory_idx" ON "Dashboard"("sidebarCategory");

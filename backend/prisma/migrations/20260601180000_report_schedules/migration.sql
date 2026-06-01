-- CreateEnum
CREATE TYPE "ReportScheduleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "ReportSchedule" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "ReportScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportSchedule_status_scheduledAt_idx" ON "ReportSchedule"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "ReportSchedule_reportId_idx" ON "ReportSchedule"("reportId");

-- CreateIndex
CREATE INDEX "ReportSchedule_groupId_idx" ON "ReportSchedule"("groupId");

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "SavedReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "UserGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

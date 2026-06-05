-- CreateTable
CREATE TABLE "StatementSchedule" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "recurrence" "ReportScheduleRecurrence" NOT NULL DEFAULT 'ONCE',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "timeMinutes" INTEGER,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "timezoneOffsetMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" "ReportScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatementSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatementSchedule_status_scheduledAt_idx" ON "StatementSchedule"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "StatementSchedule_statementId_idx" ON "StatementSchedule"("statementId");

-- CreateIndex
CREATE INDEX "StatementSchedule_groupId_idx" ON "StatementSchedule"("groupId");

-- AddForeignKey
ALTER TABLE "StatementSchedule" ADD CONSTRAINT "StatementSchedule_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "Statement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementSchedule" ADD CONSTRAINT "StatementSchedule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "UserGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementSchedule" ADD CONSTRAINT "StatementSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

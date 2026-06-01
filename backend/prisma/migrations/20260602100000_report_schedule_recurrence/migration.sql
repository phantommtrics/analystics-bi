-- CreateEnum
CREATE TYPE "ReportScheduleRecurrence" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "ReportSchedule" ADD COLUMN "recurrence" "ReportScheduleRecurrence" NOT NULL DEFAULT 'ONCE';
ALTER TABLE "ReportSchedule" ADD COLUMN "timeMinutes" INTEGER;
ALTER TABLE "ReportSchedule" ADD COLUMN "dayOfWeek" INTEGER;
ALTER TABLE "ReportSchedule" ADD COLUMN "dayOfMonth" INTEGER;
ALTER TABLE "ReportSchedule" ADD COLUMN "timezoneOffsetMinutes" INTEGER NOT NULL DEFAULT 0;

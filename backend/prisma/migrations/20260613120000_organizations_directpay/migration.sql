-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "industry" TEXT,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "billingOwnerEmail" TEXT,
    "billingOwnerName" TEXT,
    "directPayBusinessId" TEXT,
    "directPaySlug" TEXT,
    "directPaySubscriptionId" TEXT,
    "subscriptionStatus" TEXT,
    "subscriptionPeriodEnd" TIMESTAMP(3),
    "subscriptionPlanCode" TEXT,
    "subscriptionSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- Default organization for existing data
INSERT INTO "Organization" ("id", "name", "slug", "status", "createdAt", "updatedAt")
VALUES ('default-org', 'Default Organization', 'default', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable User
ALTER TABLE "User" ADD COLUMN "organizationId" TEXT;
UPDATE "User" SET "organizationId" = 'default-org';
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable DataSource
ALTER TABLE "DataSource" ADD COLUMN "organizationId" TEXT;
UPDATE "DataSource" SET "organizationId" = 'default-org';
ALTER TABLE "DataSource" ALTER COLUMN "organizationId" SET NOT NULL;
DROP INDEX IF EXISTS "DataSource_name_key";
CREATE UNIQUE INDEX "DataSource_organizationId_name_key" ON "DataSource"("organizationId", "name");
CREATE INDEX "DataSource_organizationId_idx" ON "DataSource"("organizationId");
ALTER TABLE "DataSource" ADD CONSTRAINT "DataSource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable UserGroup
ALTER TABLE "UserGroup" ADD COLUMN "organizationId" TEXT;
UPDATE "UserGroup" SET "organizationId" = 'default-org';
ALTER TABLE "UserGroup" ALTER COLUMN "organizationId" SET NOT NULL;
DROP INDEX IF EXISTS "UserGroup_name_key";
CREATE UNIQUE INDEX "UserGroup_organizationId_name_key" ON "UserGroup"("organizationId", "name");
CREATE INDEX "UserGroup_organizationId_idx" ON "UserGroup"("organizationId");
ALTER TABLE "UserGroup" ADD CONSTRAINT "UserGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable SavedReport
ALTER TABLE "SavedReport" ADD COLUMN "organizationId" TEXT;
UPDATE "SavedReport" SET "organizationId" = 'default-org';
ALTER TABLE "SavedReport" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "SavedReport_organizationId_idx" ON "SavedReport"("organizationId");
ALTER TABLE "SavedReport" ADD CONSTRAINT "SavedReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable Dashboard
ALTER TABLE "Dashboard" ADD COLUMN "organizationId" TEXT;
UPDATE "Dashboard" SET "organizationId" = 'default-org';
ALTER TABLE "Dashboard" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Dashboard_organizationId_idx" ON "Dashboard"("organizationId");
ALTER TABLE "Dashboard" ADD CONSTRAINT "Dashboard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable Statement
ALTER TABLE "Statement" ADD COLUMN "organizationId" TEXT;
UPDATE "Statement" SET "organizationId" = 'default-org';
ALTER TABLE "Statement" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Statement_organizationId_idx" ON "Statement"("organizationId");
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "Organization_directPayBusinessId_key" ON "Organization"("directPayBusinessId");

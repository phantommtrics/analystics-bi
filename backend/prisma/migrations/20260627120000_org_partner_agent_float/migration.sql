-- CreateTable
CREATE TABLE "OrganizationPartnerAgentFloat" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "apiUrl" TEXT,
    "apiKeyEncrypted" TEXT,
    "hmacSecretEncrypted" TEXT,
    "encryptionKeyEncrypted" TEXT,
    "intervalMs" INTEGER NOT NULL DEFAULT 300000,
    "requestTimeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationPartnerAgentFloat_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "PartnerAgentFloatDelivery" ADD COLUMN "organizationId" TEXT;

-- Backfill existing deliveries to default org (or first org)
UPDATE "PartnerAgentFloatDelivery" d
SET "organizationId" = (
  SELECT o.id FROM "Organization" o
  ORDER BY o."isDefault" DESC, o."createdAt" ASC
  LIMIT 1
)
WHERE d."organizationId" IS NULL;

ALTER TABLE "PartnerAgentFloatDelivery" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationPartnerAgentFloat_organizationId_key" ON "OrganizationPartnerAgentFloat"("organizationId");

-- CreateIndex
CREATE INDEX "PartnerAgentFloatDelivery_organizationId_createdAt_idx" ON "PartnerAgentFloatDelivery"("organizationId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "OrganizationPartnerAgentFloat" ADD CONSTRAINT "OrganizationPartnerAgentFloat_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerAgentFloatDelivery" ADD CONSTRAINT "PartnerAgentFloatDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

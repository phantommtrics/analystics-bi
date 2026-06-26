-- CreateEnum
CREATE TYPE "PartnerAgentFloatDeliveryStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "PartnerAgentFloatDelivery" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "status" "PartnerAgentFloatDeliveryStatus" NOT NULL,
    "httpStatus" INTEGER,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerAgentFloatDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerAgentFloatDelivery_deliveryId_key" ON "PartnerAgentFloatDelivery"("deliveryId");

-- CreateIndex
CREATE INDEX "PartnerAgentFloatDelivery_createdAt_idx" ON "PartnerAgentFloatDelivery"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "PartnerAgentFloatDelivery_status_idx" ON "PartnerAgentFloatDelivery"("status");

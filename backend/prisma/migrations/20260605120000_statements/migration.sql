-- CreateEnum
CREATE TYPE "StatementType" AS ENUM ('FINANCIAL_PL', 'BANK_STATEMENT', 'LEDGER_BALANCE');

-- CreateTable
CREATE TABLE "Statement" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "StatementType" NOT NULL,
    "category" "ReportCategory" NOT NULL DEFAULT 'GENERAL',
    "config" JSONB NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Statement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Statement_deletedAt_idx" ON "Statement"("deletedAt");

-- CreateIndex
CREATE INDEX "Statement_name_idx" ON "Statement"("name");

-- CreateIndex
CREATE INDEX "Statement_category_idx" ON "Statement"("category");

-- CreateIndex
CREATE INDEX "Statement_type_idx" ON "Statement"("type");

-- CreateIndex
CREATE INDEX "Statement_isPublished_idx" ON "Statement"("isPublished");

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

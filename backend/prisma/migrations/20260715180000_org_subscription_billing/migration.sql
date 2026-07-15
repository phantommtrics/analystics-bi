-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "subscriptionBillingAssigned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "subscriptionBillingTemplateId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "subscriptionBillingTemplateName" TEXT;
ALTER TABLE "Organization" ADD COLUMN "subscriptionBillingAmount" TEXT;
ALTER TABLE "Organization" ADD COLUMN "subscriptionBillingCurrency" TEXT;

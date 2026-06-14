ALTER TABLE "Organization" ADD COLUMN "subscriptionPeriodStart" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "subscriptionBillingInterval" TEXT;
ALTER TABLE "Organization" ADD COLUMN "subscriptionReminderLastSentAt" TIMESTAMP(3);

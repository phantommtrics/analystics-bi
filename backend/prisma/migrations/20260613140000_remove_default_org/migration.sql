-- Unlink users from the seeded default organization
UPDATE "User" SET "organizationId" = NULL WHERE "organizationId" = 'default-org';

-- Schedules reference UserGroup with ON DELETE RESTRICT; remove before org cascade
DELETE FROM "ReportSchedule"
WHERE "groupId" IN (SELECT id FROM "UserGroup" WHERE "organizationId" = 'default-org');

DELETE FROM "StatementSchedule"
WHERE "groupId" IN (SELECT id FROM "UserGroup" WHERE "organizationId" = 'default-org');

-- Remove default organization (cascades org-scoped content)
DELETE FROM "Organization" WHERE id = 'default-org';

ALTER TABLE "Organization" ADD COLUMN "subscriptionPayUrl" TEXT;

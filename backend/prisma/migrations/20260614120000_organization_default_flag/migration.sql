ALTER TABLE "Organization" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Mark the earliest organization as default when none is set
UPDATE "Organization"
SET "isDefault" = true
WHERE id = (
  SELECT id FROM "Organization"
  ORDER BY "createdAt" ASC
  LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM "Organization" WHERE "isDefault" = true);

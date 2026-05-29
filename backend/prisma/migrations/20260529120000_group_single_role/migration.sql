-- Assign each group the first linked role before dropping GroupRole
ALTER TABLE "UserGroup" ADD COLUMN "roleId" TEXT;

UPDATE "UserGroup" g
SET "roleId" = (
  SELECT gr."roleId"
  FROM "GroupRole" gr
  WHERE gr."groupId" = g."id"
  LIMIT 1
);

-- Fallback: attach Owner role for any group still missing a role
UPDATE "UserGroup" g
SET "roleId" = (SELECT id FROM "Role" WHERE name = 'Owner' LIMIT 1)
WHERE "roleId" IS NULL;

ALTER TABLE "UserGroup" ALTER COLUMN "roleId" SET NOT NULL;

ALTER TABLE "UserGroup" ADD CONSTRAINT "UserGroup_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TABLE "GroupRole";

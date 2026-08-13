-- AlterTable
ALTER TABLE "Role" ADD COLUMN "organizationId" TEXT;

-- Clone roles that are used by groups in more than one org
DO $$
DECLARE
  r RECORD;
  org RECORD;
  keep_org TEXT;
  new_id TEXT;
BEGIN
  FOR r IN
    SELECT role.id, role.name, role.description
    FROM "Role" role
    WHERE role.name <> 'Owner'
      AND (
        SELECT COUNT(DISTINCT ug."organizationId")
        FROM "UserGroup" ug
        WHERE ug."roleId" = role.id
      ) > 1
  LOOP
    SELECT MIN(ug."organizationId") INTO keep_org
    FROM "UserGroup" ug
    WHERE ug."roleId" = r.id;

    UPDATE "Role" SET "organizationId" = keep_org WHERE id = r.id;

    FOR org IN
      SELECT DISTINCT ug."organizationId" AS id
      FROM "UserGroup" ug
      WHERE ug."roleId" = r.id AND ug."organizationId" <> keep_org
    LOOP
      new_id := replace(gen_random_uuid()::text, '-', '');

      INSERT INTO "Role" (id, name, description, "organizationId", "createdAt", "updatedAt")
      VALUES (new_id, r.name, r.description, org.id, NOW(), NOW());

      INSERT INTO "RolePermission" ("roleId", "permissionId", "assignedAt")
      SELECT new_id, rp."permissionId", NOW()
      FROM "RolePermission" rp
      WHERE rp."roleId" = r.id;

      UPDATE "UserGroup"
      SET "roleId" = new_id
      WHERE "roleId" = r.id AND "organizationId" = org.id;
    END LOOP;
  END LOOP;
END $$;

-- Roles used by groups in a single org
UPDATE "Role" r
SET "organizationId" = g.org_id
FROM (
  SELECT "roleId", MIN("organizationId") AS org_id
  FROM "UserGroup"
  GROUP BY "roleId"
  HAVING COUNT(DISTINCT "organizationId") = 1
) g
WHERE r.id = g."roleId"
  AND r.name <> 'Owner'
  AND r."organizationId" IS NULL;

-- Remaining non-Owner roles belong to the default (or oldest) organization
UPDATE "Role"
SET "organizationId" = (
  SELECT id FROM "Organization" ORDER BY "isDefault" DESC, "createdAt" ASC LIMIT 1
)
WHERE name <> 'Owner' AND "organizationId" IS NULL;

-- CreateIndex
DROP INDEX "Role_name_key";
CREATE UNIQUE INDEX "Role_organizationId_name_key" ON "Role"("organizationId", "name");
CREATE INDEX "Role_organizationId_idx" ON "Role"("organizationId");

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

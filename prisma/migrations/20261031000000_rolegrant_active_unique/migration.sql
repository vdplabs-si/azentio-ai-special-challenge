-- At most one active (unrevoked) grant per user and platform role.
-- Partial unique indexes can't be expressed in schema.prisma, so this lives in SQL only.
CREATE UNIQUE INDEX "RoleGrant_userId_role_active_key" ON "RoleGrant"("userId", "role") WHERE "revokedAt" IS NULL;

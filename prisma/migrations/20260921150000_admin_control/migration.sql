-- Admin control: organization status and limit overrides, admin login
-- lockout and 2FA, an audit log of admin actions, and persisted system
-- settings.
--
-- Every existing organization becomes ACTIVE with no overrides, which is
-- exactly how it behaves today. Nothing reads the new admin columns until an
-- admin enables 2FA or fails a login.
-- Idempotent and production-safe.

DO $$ BEGIN
  CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'READ_ONLY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "statusReason" TEXT,
  ADD COLUMN IF NOT EXISTS "statusChangedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "statusChangedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "limitOverrides" JSONB;

CREATE INDEX IF NOT EXISTS "Organization_status_idx" ON "Organization"("status");

ALTER TABLE "AdminUser"
  ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "otpSecret" TEXT,
  ADD COLUMN IF NOT EXISTS "otpEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
  "id"             TEXT NOT NULL,
  "adminId"        TEXT,
  "adminEmail"     TEXT,
  "action"         TEXT NOT NULL,
  "method"         TEXT NOT NULL,
  "path"           TEXT NOT NULL,
  "targetType"     TEXT,
  "targetId"       TEXT,
  "organizationId" TEXT,
  "reason"         TEXT,
  "requestBody"    JSONB,
  "statusCode"     INTEGER NOT NULL,
  "ip"             TEXT,
  "userAgent"      TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminAuditLog_adminId_createdAt_idx"        ON "AdminAuditLog"("adminId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_targetType_targetId_idx"      ON "AdminAuditLog"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_organizationId_createdAt_idx" ON "AdminAuditLog"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx"                ON "AdminAuditLog"("createdAt");

CREATE TABLE IF NOT EXISTS "SystemSetting" (
  "key"       TEXT NOT NULL,
  "value"     JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" TEXT,

  CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

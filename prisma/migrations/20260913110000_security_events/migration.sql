-- Security events. Until now the only record of a failed login was a console
-- line in Render's log stream, so "was this account attacked?" had no answer.
-- Never write passwords, tokens or secrets into these rows.
-- Idempotent and production-safe.

CREATE TABLE IF NOT EXISTS "SecurityEvent" (
  "id"             TEXT NOT NULL,
  "type"           TEXT NOT NULL,
  "email"          TEXT,
  "userId"         TEXT,
  "organizationId" TEXT,
  "ip"             TEXT,
  "userAgent"      TEXT,
  "detail"         JSONB NOT NULL DEFAULT '{}',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SecurityEvent_type_createdAt_idx"  ON "SecurityEvent"("type", "createdAt");
CREATE INDEX IF NOT EXISTS "SecurityEvent_email_createdAt_idx" ON "SecurityEvent"("email", "createdAt");
CREATE INDEX IF NOT EXISTS "SecurityEvent_userId_idx"          ON "SecurityEvent"("userId");
CREATE INDEX IF NOT EXISTS "SecurityEvent_organizationId_idx"  ON "SecurityEvent"("organizationId");
CREATE INDEX IF NOT EXISTS "SecurityEvent_createdAt_idx"       ON "SecurityEvent"("createdAt");

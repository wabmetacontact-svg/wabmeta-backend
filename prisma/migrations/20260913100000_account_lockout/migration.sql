-- Per-account login lockout. IP rate limiting alone never stopped a spread-out
-- brute force: rotate the source address and every attempt is a fresh bucket.
-- The counter lives here rather than in the in-memory store so a restart or a
-- deploy does not hand every attacker a clean slate.
-- Idempotent and production-safe.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastFailedLoginAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

-- Lockout lookups sit on the hot login path.
CREATE INDEX IF NOT EXISTS "User_lockedUntil_idx" ON "User"("lockedUntil");

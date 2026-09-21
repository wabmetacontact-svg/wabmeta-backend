-- Admin operations: internal notes and tags on organizations,
-- announcements to customers, and checkout coupons.
--
-- Everything is new and empty; nothing existing reads it. Every existing
-- organization gets an empty tag list.
-- Idempotent and production-safe.

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "adminTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE IF NOT EXISTS "OrganizationNote" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "adminId"        TEXT,
  "adminEmail"     TEXT,
  "body"           TEXT NOT NULL,
  "pinned"         BOOLEAN NOT NULL DEFAULT false,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrganizationNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OrganizationNote_organizationId_createdAt_idx"
  ON "OrganizationNote"("organizationId", "createdAt");

CREATE TABLE IF NOT EXISTS "Announcement" (
  "id"              TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "message"         TEXT NOT NULL,
  "level"           TEXT NOT NULL DEFAULT 'INFO',
  "audience"        TEXT NOT NULL DEFAULT 'ALL',
  "planTypes"       TEXT[] DEFAULT ARRAY[]::TEXT[],
  "organizationIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "startsAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt"          TIMESTAMP(3),
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "notifiedAt"      TIMESTAMP(3),
  "createdBy"       TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Announcement_isActive_startsAt_idx" ON "Announcement"("isActive", "startsAt");

CREATE TABLE IF NOT EXISTS "Coupon" (
  "id"             TEXT NOT NULL,
  "code"           TEXT NOT NULL,
  "description"    TEXT,
  "discountType"   TEXT NOT NULL DEFAULT 'PERCENT',
  "value"          INTEGER NOT NULL,
  "maxRedemptions" INTEGER,
  "redeemedCount"  INTEGER NOT NULL DEFAULT 0,
  "onePerOrg"      BOOLEAN NOT NULL DEFAULT true,
  "planTypes"      TEXT[] DEFAULT ARRAY[]::TEXT[],
  "validFrom"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil"     TIMESTAMP(3),
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "createdBy"      TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_code_key" ON "Coupon"("code");

CREATE TABLE IF NOT EXISTS "CouponRedemption" (
  "id"              TEXT NOT NULL,
  "couponId"        TEXT NOT NULL,
  "organizationId"  TEXT NOT NULL,
  "razorpayOrderId" TEXT NOT NULL,
  "originalPaise"   INTEGER NOT NULL,
  "discountPaise"   INTEGER NOT NULL,
  "paidPaise"       INTEGER NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CouponRedemption_razorpayOrderId_key" ON "CouponRedemption"("razorpayOrderId");
CREATE INDEX IF NOT EXISTS "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");
CREATE INDEX IF NOT EXISTS "CouponRedemption_organizationId_idx" ON "CouponRedemption"("organizationId");

DO $$ BEGIN
  ALTER TABLE "CouponRedemption"
    ADD CONSTRAINT "CouponRedemption_couponId_fkey"
    FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

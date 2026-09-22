-- How much of each Razorpay payment has been refunded, so revenue can
-- subtract it. Every existing payment starts at 0, which is what the
-- revenue figures already assumed.
-- Idempotent and production-safe.

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "refundedAmount" INTEGER NOT NULL DEFAULT 0;

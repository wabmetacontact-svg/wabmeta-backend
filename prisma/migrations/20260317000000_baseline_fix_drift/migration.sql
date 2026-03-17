-- Baseline drift fix
-- These elements are already in the DB but missing from migrations history

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "planId" TEXT,
    "planName" TEXT,
    "billingCycle" TEXT,
    "description" TEXT,
    "receipt" TEXT,
    "notes" JSONB,
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- AlterTable
DO $$ BEGIN
    ALTER TABLE "Template" ADD COLUMN "headerMediaId" TEXT;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- AlterTable
DO $$ BEGIN
    ALTER TABLE "WhatsAppAccount" ADD COLUMN "connectionType" TEXT NOT NULL DEFAULT 'CLOUD_API';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_razorpayOrderId_key" ON "Payment"("razorpayOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_razorpayPaymentId_key" ON "Payment"("razorpayPaymentId");
CREATE INDEX IF NOT EXISTS "Payment_organizationId_idx" ON "Payment"("organizationId");
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status");
CREATE INDEX IF NOT EXISTS "Payment_razorpayOrderId_idx" ON "Payment"("razorpayOrderId");
CREATE INDEX IF NOT EXISTS "Payment_razorpayPaymentId_idx" ON "Payment"("razorpayPaymentId");
CREATE INDEX IF NOT EXISTS "Payment_createdAt_idx" ON "Payment"("createdAt");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

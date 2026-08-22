-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "IgAccountStatus" AS ENUM ('PENDING', 'CONNECTED', 'DISCONNECTED', 'TOKEN_EXPIRED', 'ERROR');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "IgTriggerType" AS ENUM ('KEYWORD', 'DM_RECEIVED', 'STORY_REPLY', 'COMMENT_TO_DM', 'ICE_BREAKER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterEnum
ALTER TYPE "ContactStatus" ADD VALUE IF NOT EXISTS 'DELETED';

-- DropIndex
DROP INDEX IF EXISTS "Notification_userId_idx";

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;

-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "metadata" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "featureAutomationLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "featureCampaignsLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "featureChatbotLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "featureInboxLocked" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "customLabels" SET NOT NULL;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN IF NOT EXISTS "headerMediaLastVerified" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "headerMediaUploadedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ExpoPushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "deviceId" TEXT,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpoPushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InstagramAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "igUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "biography" TEXT,
    "profilePicUrl" TEXT,
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "followingCount" INTEGER NOT NULL DEFAULT 0,
    "mediaCount" INTEGER NOT NULL DEFAULT 0,
    "accessToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "pageId" TEXT,
    "wabaId" TEXT,
    "status" "IgAccountStatus" NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstagramAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IgDmAutomation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "igAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerType" "IgTriggerType" NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matchType" TEXT NOT NULL DEFAULT 'contains',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "responseType" TEXT NOT NULL DEFAULT 'text',
    "responseText" TEXT,
    "responseFlow" JSONB,
    "iceBreaker" BOOLEAN NOT NULL DEFAULT false,
    "storyReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "repliesCount" INTEGER NOT NULL DEFAULT 0,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IgDmAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IgCommentRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "igAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "postIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "action" TEXT NOT NULL DEFAULT 'reply',
    "commentReply" TEXT,
    "dmMessage" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "triggeredCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IgCommentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IgStoryRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "igAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL DEFAULT 'mention',
    "replyMessage" TEXT,
    "dmMessage" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "triggeredCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IgStoryRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IgMessage" (
    "id" TEXT NOT NULL,
    "igAccountId" TEXT NOT NULL,
    "igMessageId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderUsername" TEXT,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "content" TEXT,
    "mediaUrl" TEXT,
    "storyId" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "isAutomated" BOOLEAN NOT NULL DEFAULT false,
    "automationId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IgMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IgAnalytics" (
    "id" TEXT NOT NULL,
    "igAccountId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "followersGain" INTEGER NOT NULL DEFAULT 0,
    "profileViews" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "dmsSent" INTEGER NOT NULL DEFAULT 0,
    "dmsReceived" INTEGER NOT NULL DEFAULT 0,
    "commentsReplied" INTEGER NOT NULL DEFAULT 0,
    "automationReplies" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IgAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WalletAccessRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "additionalInfo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "planVerified" BOOLEAN NOT NULL DEFAULT false,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Wallet" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "accessGrantedAt" TIMESTAMP(3),
    "accessGrantedBy" TEXT,
    "balancePaise" INTEGER NOT NULL DEFAULT 0,
    "reservedPaise" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "creditEnabled" BOOLEAN NOT NULL DEFAULT false,
    "creditLimitPaise" INTEGER NOT NULL DEFAULT 0,
    "creditUsedPaise" INTEGER NOT NULL DEFAULT 0,
    "maxTopUpPaise" INTEGER NOT NULL DEFAULT 5000000,
    "maxMonthlyPaise" INTEGER NOT NULL DEFAULT 20000000,
    "currentMonthPaise" INTEGER NOT NULL DEFAULT 0,
    "monthResetDate" TIMESTAMP(3) NOT NULL,
    "lowThresholdPaise" INTEGER NOT NULL DEFAULT 50000,
    "lowAlertSent" BOOLEAN NOT NULL DEFAULT false,
    "lastAlertSentAt" TIMESTAMP(3),
    "totalCreditedPaise" INTEGER NOT NULL DEFAULT 0,
    "totalDebitedPaise" INTEGER NOT NULL DEFAULT 0,
    "lastTransactionAt" TIMESTAMP(3),
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "flaggedAt" TIMESTAMP(3),
    "flaggedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "balanceBeforePaise" INTEGER NOT NULL,
    "balanceAfterPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "metaChargeId" TEXT,
    "metaService" TEXT,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "performedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WalletTopUpOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "creditedVia" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "transactionId" TEXT,

    CONSTRAINT "WalletTopUpOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ExpoPushToken_token_key" ON "ExpoPushToken"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ExpoPushToken_userId_idx" ON "ExpoPushToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InstagramAccount_igUserId_key" ON "InstagramAccount"("igUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InstagramAccount_organizationId_idx" ON "InstagramAccount"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InstagramAccount_igUserId_idx" ON "InstagramAccount"("igUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InstagramAccount_status_idx" ON "InstagramAccount"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IgDmAutomation_organizationId_idx" ON "IgDmAutomation"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IgDmAutomation_igAccountId_idx" ON "IgDmAutomation"("igAccountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IgDmAutomation_isActive_idx" ON "IgDmAutomation"("isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IgDmAutomation_triggerType_idx" ON "IgDmAutomation"("triggerType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IgCommentRule_organizationId_idx" ON "IgCommentRule"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IgCommentRule_igAccountId_idx" ON "IgCommentRule"("igAccountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IgCommentRule_isActive_idx" ON "IgCommentRule"("isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IgStoryRule_organizationId_idx" ON "IgStoryRule"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IgStoryRule_igAccountId_idx" ON "IgStoryRule"("igAccountId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "IgMessage_igMessageId_key" ON "IgMessage"("igMessageId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IgMessage_igAccountId_idx" ON "IgMessage"("igAccountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IgMessage_senderId_idx" ON "IgMessage"("senderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IgMessage_createdAt_idx" ON "IgMessage"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IgAnalytics_igAccountId_idx" ON "IgAnalytics"("igAccountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IgAnalytics_date_idx" ON "IgAnalytics"("date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "IgAnalytics_igAccountId_date_key" ON "IgAnalytics"("igAccountId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WalletAccessRequest_organizationId_idx" ON "WalletAccessRequest"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WalletAccessRequest_status_idx" ON "WalletAccessRequest"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WalletAccessRequest_requestedAt_idx" ON "WalletAccessRequest"("requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Wallet_organizationId_key" ON "Wallet"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Wallet_organizationId_idx" ON "Wallet"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Wallet_isActive_idx" ON "Wallet"("isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Wallet_flagged_idx" ON "Wallet"("flagged");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WalletTransaction_transactionId_key" ON "WalletTransaction"("transactionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WalletTransaction_walletId_idx" ON "WalletTransaction"("walletId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WalletTransaction_type_idx" ON "WalletTransaction"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WalletTransaction_createdAt_idx" ON "WalletTransaction"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WalletTransaction_razorpayPaymentId_idx" ON "WalletTransaction"("razorpayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WalletTopUpOrder_razorpayOrderId_key" ON "WalletTopUpOrder"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WalletTopUpOrder_razorpayPaymentId_key" ON "WalletTopUpOrder"("razorpayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WalletTopUpOrder_transactionId_key" ON "WalletTopUpOrder"("transactionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WalletTopUpOrder_organizationId_idx" ON "WalletTopUpOrder"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WalletTopUpOrder_status_idx" ON "WalletTopUpOrder"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WalletTopUpOrder_razorpayOrderId_idx" ON "WalletTopUpOrder"("razorpayOrderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WalletTopUpOrder_razorpayPaymentId_idx" ON "WalletTopUpOrder"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WalletTopUpOrder_createdAt_idx" ON "WalletTopUpOrder"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Campaign_organizationId_status_createdAt_idx" ON "Campaign"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Campaign_whatsappAccountId_status_idx" ON "Campaign"("whatsappAccountId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CampaignContact_campaignId_status_idx" ON "CampaignContact"("campaignId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CampaignContact_waMessageId_idx" ON "CampaignContact"("waMessageId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Contact_deletedAt_idx" ON "Contact"("deletedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_asc_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ExpoPushToken" ADD CONSTRAINT "ExpoPushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "InstagramAccount" ADD CONSTRAINT "InstagramAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "IgDmAutomation" ADD CONSTRAINT "IgDmAutomation_igAccountId_fkey" FOREIGN KEY ("igAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "IgCommentRule" ADD CONSTRAINT "IgCommentRule_igAccountId_fkey" FOREIGN KEY ("igAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "IgStoryRule" ADD CONSTRAINT "IgStoryRule_igAccountId_fkey" FOREIGN KEY ("igAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "IgMessage" ADD CONSTRAINT "IgMessage_igAccountId_fkey" FOREIGN KEY ("igAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "IgAnalytics" ADD CONSTRAINT "IgAnalytics_igAccountId_fkey" FOREIGN KEY ("igAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "WalletAccessRequest" ADD CONSTRAINT "WalletAccessRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "WalletAccessRequest" ADD CONSTRAINT "WalletAccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "WalletAccessRequest" ADD CONSTRAINT "WalletAccessRequest_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;


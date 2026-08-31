-- Admin ke display-only overrides. Meta par kuch nahi badalta - ye sirf
-- tay karta hai ki WabMeta me user ko kya dikhe.
--
-- NOTE: yahan pehle messagingLimitSetBy / messagingLimitSetAt ko DROP kiya
-- ja raha tha. Chalu production par column drop karna khatarnak hai - purana
-- build ka Prisma client use maangta rehta hai aur har query P2022 se fail
-- ho jati hai. Migrations sirf jodne wali rakho; hatana tab jab naya build
-- sab jagah chal raha ho.
ALTER TABLE "WhatsAppAccount"
  ADD COLUMN IF NOT EXISTS "qualityRatingOverride" TEXT,
  ADD COLUMN IF NOT EXISTS "overrideSetBy" TEXT,
  ADD COLUMN IF NOT EXISTS "overrideSetAt" TIMESTAMP(3);

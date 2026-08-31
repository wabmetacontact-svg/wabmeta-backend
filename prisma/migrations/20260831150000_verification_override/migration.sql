-- Admin ka verification status override (sirf display).
--
-- NOTE: healthCanSendOverride ko yahan DROP nahi kar rahe.
-- Wo column pehle add ho kar deploy ho chuka tha; chalu production ka
-- Prisma client use har WhatsAppAccount query me maangta hai. Drop karte
-- hi saari queries P2022 se fail ho gayi thi. Purana build hatne ke baad
-- alag migration me hataya ja sakta hai.
ALTER TABLE "WhatsAppAccount"
  ADD COLUMN IF NOT EXISTS "codeVerificationOverride" TEXT;

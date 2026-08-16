-- AlterTable
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "whatsappAbout" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "whatsappProfilePicUrl" TEXT;

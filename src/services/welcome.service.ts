// src/services/welcome.service.ts

import prisma from '../config/database';
import { toCanonicalPhone } from '../utils/phone';
import { config } from '../config';

class WelcomeService {
  
  private cachedOrgId: string | null = null;

  // ✅ Auto-detect WabMeta org ID from PLATFORM_WA_PHONE_ID
  private async getWabMetaOrgId(): Promise<string | null> {
    // Cache check
    if (this.cachedOrgId) return this.cachedOrgId;

    // ✅ Method 1: Env se try karo
    const envOrgId = process.env.WABMETA_OWN_ORG_ID;
    if (envOrgId) {
      const exists = await prisma.organization.findUnique({
        where: { id: envOrgId },
        select: { id: true },
      });
      if (exists) {
        this.cachedOrgId = envOrgId;
        return envOrgId;
      }
      console.warn(`⚠️ WABMETA_OWN_ORG_ID "${envOrgId}" not found in DB`);
    }

    // ✅ Method 2: PLATFORM_WA_PHONE_ID se auto-detect karo
    const phoneNumberId = config.platform?.whatsapp?.phoneNumberId;
    if (phoneNumberId) {
      const account = await prisma.whatsAppAccount.findFirst({
        where: { phoneNumberId },
        select: { organizationId: true },
      });

      if (account?.organizationId) {
        console.log(`✅ Auto-detected WabMeta org: ${account.organizationId}`);
        this.cachedOrgId = account.organizationId;
        return account.organizationId;
      }
    }

    console.error('❌ Could not detect WabMeta organization ID');
    return null;
  }

  async saveNewUserAsContact(
    user: {
      id: string;
      firstName: string;
      lastName?: string | null;
      email: string;
      phone: string;
    },
    organizationIdParam?: string // Optional - agar nahi diya toh auto-detect
  ): Promise<void> {
    try {
      if (!user.phone) return;

      // ✅ Org ID auto-detect karo
      const organizationId = organizationIdParam || await this.getWabMetaOrgId();
      
      if (!organizationId) {
        console.warn('⚠️ WabMeta org ID not found - skipping contact save');
        return;
      }

      const normalizedPhone = toCanonicalPhone(user.phone);
      if (!normalizedPhone) {
        console.warn(`⚠️ Invalid phone: ${user.phone}`);
        return;
      }

      // Country code extract
      const digits = normalizedPhone.slice(1);
      let countryCode = '+91';
      if (digits.startsWith('1')) countryCode = '+1';
      else if (digits.startsWith('44')) countryCode = '+44';
      else if (digits.startsWith('91')) countryCode = '+91';
      else countryCode = `+${digits.slice(0, digits.length - 10)}`;

      // ✅ Contact upsert
      const contact = await prisma.contact.upsert({
        where: {
          organizationId_phone: {
            organizationId,
            phone: normalizedPhone,
          },
        },
        create: {
          organizationId,
          phone: normalizedPhone,
          countryCode,
          firstName: user.firstName || 'User',
          lastName: user.lastName || null,
          email: user.email || null,
          status: 'ACTIVE',
          source: 'wabmeta_signup',
          tags: ['wabmeta-user'],
          customFields: {
            userId: user.id,
            signupDate: new Date().toISOString(),
          } as any,
        },
        update: {
          firstName: user.firstName || 'User',
          lastName: user.lastName || null,
          email: user.email || null,
        },
      });

      console.log(`✅ New user saved as contact: ${contact.id} | ${normalizedPhone}`);

    } catch (error: any) {
      console.error('❌ saveNewUserAsContact error (non-fatal):', error.message);
    }
  }
}

export const welcomeService = new WelcomeService();

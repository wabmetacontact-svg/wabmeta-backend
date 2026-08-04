// src/services/welcome.service.ts

import prisma from '../config/database';
import { toCanonicalPhone } from '../utils/phone';

class WelcomeService {

  async saveNewUserAsContact(
    user: {
      id: string;
      firstName: string;
      lastName?: string | null;
      email: string;
      phone: string;
    },
    organizationId: string
  ): Promise<void> {
    try {
      if (!user.phone || !organizationId) return;

      const normalizedPhone = toCanonicalPhone(user.phone);
      if (!normalizedPhone) {
        console.warn(`⚠️ Invalid phone: ${user.phone}`);
        return;
      }

      // ✅ Country code extract
      const digits = normalizedPhone.slice(1);
      let countryCode = '+91';
      if (digits.startsWith('1')) countryCode = '+1';
      else if (digits.startsWith('44')) countryCode = '+44';
      else if (digits.startsWith('91')) countryCode = '+91';
      else countryCode = `+${digits.slice(0, digits.length - 10)}`;

      // ✅ Sirf contact upsert - bas itna hi
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

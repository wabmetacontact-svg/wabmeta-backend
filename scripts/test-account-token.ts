import prisma from '../src/config/database';
import { safeDecrypt } from '../src/utils/encryption';
import axios from 'axios';

async function main() {
  const account = await prisma.whatsAppAccount.findFirst({
    where: {
      OR: [
        { phoneNumber: { contains: '9005395959' } },
        { displayName: { contains: 'Manoj', mode: 'insensitive' } },
      ]
    },
    include: {
      organization: { select: { id: true, name: true } }
    }
  });

  if (!account) {
    console.log('Account not found');
    return;
  }

  console.log('Account Details:', {
    id: account.id,
    phone: account.phoneNumber,
    name: account.displayName,
    status: account.status,
    phoneNumberId: account.phoneNumberId,
    wabaId: account.wabaId,
    tokenExpiresAt: account.tokenExpiresAt,
    org: account.organization?.name,
    hasToken: !!account.accessToken,
  });

  if (!account.accessToken) {
    console.log('No access token in database!');
    return;
  }

  let token = account.accessToken;
  if (!token.startsWith('EAA')) {
    token = safeDecrypt(token) || '';
  }

  console.log('Token prefix:', token.substring(0, 15), 'length:', token.length);

  // Test debug_token
  try {
    const debugRes = await axios.get(`https://graph.facebook.com/v21.0/debug_token`, {
      params: {
        input_token: token,
        access_token: token,
      }
    });
    console.log('🔍 Meta debug_token response:', JSON.stringify(debugRes.data, null, 2));
  } catch (err: any) {
    console.error('❌ debug_token failed:', err.response?.data || err.message);
  }

  // Test getPhoneNumberInfo
  try {
    const phoneRes = await axios.get(`https://graph.facebook.com/v21.0/${account.phoneNumberId}`, {
      params: {
        fields: 'verified_name,code_verification_status,display_phone_number,quality_rating,messaging_limit_tier,name_status,status,id',
        access_token: token,
      }
    });
    console.log('🔍 Meta getPhoneNumberInfo response:', JSON.stringify(phoneRes.data, null, 2));
  } catch (err: any) {
    console.error('❌ getPhoneNumberInfo failed:', err.response?.data || err.message);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

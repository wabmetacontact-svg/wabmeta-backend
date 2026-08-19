import prisma from '../src/config/database';
import { safeDecrypt, isMetaToken, isEncrypted } from '../src/utils/encryption';

async function main() {
  const accounts = await prisma.whatsAppAccount.findMany({
    select: {
      id: true,
      phoneNumber: true,
      displayName: true,
      status: true,
      accessToken: true,
      tokenExpiresAt: true,
      phoneNumberId: true,
      wabaId: true,
      codeVerificationStatus: true,
      qualityRating: true,
      nameStatus: true,
      updatedAt: true,
    }
  });

  console.log(`Found ${accounts.length} accounts:`);
  for (const a of accounts) {
    let tokenState = 'NO_TOKEN';
    if (a.accessToken) {
      if (isMetaToken(a.accessToken)) {
        tokenState = `PLAIN_TOKEN (prefix: ${a.accessToken.substring(0, 10)})`;
      } else if (isEncrypted(a.accessToken)) {
        const decrypted = safeDecrypt(a.accessToken);
        if (decrypted && isMetaToken(decrypted)) {
          tokenState = `ENCRYPTED_VALID (decrypted prefix: ${decrypted.substring(0, 10)})`;
        } else {
          tokenState = `ENCRYPTED_INVALID (decrypted: ${decrypted ? 'invalid' : 'null'})`;
        }
      } else {
        tokenState = `UNKNOWN_FORMAT (${a.accessToken.substring(0, 20)})`;
      }
    }

    console.log({
      id: a.id,
      phone: a.phoneNumber,
      name: a.displayName,
      status: a.status,
      tokenState,
      tokenExpiresAt: a.tokenExpiresAt,
      phoneNumberId: a.phoneNumberId,
      wabaId: a.wabaId,
      updatedAt: a.updatedAt,
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

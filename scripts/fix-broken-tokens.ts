// scripts/fix-broken-tokens.ts

import prisma from '../src/config/database';
import { safeDecrypt, isMetaToken, isEncrypted } from '../src/utils/encryption';

async function main() {
  const accounts = await prisma.whatsAppAccount.findMany({
    where: { status: 'CONNECTED', accessToken: { not: null } },
  });

  console.log(`Checking ${accounts.length} accounts...`);
  
  let fixed = 0;
  let broken = 0;

  for (const acc of accounts) {
    if (!acc.accessToken) continue;

    // Check karo token valid hai ya nahi
    if (isMetaToken(acc.accessToken)) {
      console.log(`✅ ${acc.phoneNumber} - Plain token OK`);
      continue;
    }

    if (isEncrypted(acc.accessToken)) {
      const decrypted = safeDecrypt(acc.accessToken);
      if (decrypted && isMetaToken(decrypted)) {
        console.log(`✅ ${acc.phoneNumber} - Encrypted OK`);
        continue;
      }
    }

    // ❌ Broken - disconnect karo
    console.log(`❌ ${acc.phoneNumber} - BROKEN, disconnecting`);
    await prisma.whatsAppAccount.update({
      where: { id: acc.id },
      data: { 
        status: 'DISCONNECTED', 
        accessToken: null,
        tokenExpiresAt: null,
      },
    });
    broken++;
  }

  console.log(`\n✅ Done. Broken accounts: ${broken}`);
  process.exit(0);
}

main();

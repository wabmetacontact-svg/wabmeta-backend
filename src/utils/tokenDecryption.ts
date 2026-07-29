// src/utils/tokenDecryption.ts - COMPLETE REPLACE

import { WhatsAppAccount, WhatsAppAccountStatus } from '@prisma/client';
import prisma from '../config/database';
import { encrypt, safeDecrypt, isMetaToken, isEncrypted } from './encryption';
import { authLog } from './logger';

export interface AccountWithToken {
  account: WhatsAppAccount;
  accessToken: string;
}

export async function getAccountWithDecryptedToken(
  accountId: string
): Promise<AccountWithToken | null> {
  const account = await prisma.whatsAppAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    authLog.error('Account not found', null, { accountId });
    return null;
  }

  if (account.status !== WhatsAppAccountStatus.CONNECTED) {
    return null;
  }

  if (!account.accessToken) {
    authLog.error('No access token', null, { accountId });
    return null;
  }

  let finalToken: string | null = null;

  // ✅ Case 1: Token already plain Meta token (legacy)
  if (isMetaToken(account.accessToken)) {
    authLog.warn('Plain token detected - encrypting now', { accountId });
    try {
      const encrypted = encrypt(account.accessToken);
      await prisma.whatsAppAccount.update({
        where: { id: accountId },
        data:  { accessToken: encrypted },
      });
    } catch {}
    finalToken = account.accessToken;
  }
  
  // ✅ Case 2: Token encrypted - decrypt karo
  else if (isEncrypted(account.accessToken)) {
    const decrypted = safeDecrypt(account.accessToken);
    
    if (decrypted && isMetaToken(decrypted)) {
      finalToken = decrypted;
    } else {
      authLog.error('Decryption produced invalid token', null, { 
        accountId,
        decryptedPrefix: decrypted?.substring(0, 20),
      });
    }
  }
  
  // ✅ Case 3: Something else - broken
  else {
    authLog.error('Token format unrecognized', null, {
      accountId,
      tokenPrefix: account.accessToken.substring(0, 30),
      tokenLength: account.accessToken.length,
    });
  }

  // ✅ Token invalid - mark disconnected
  if (!finalToken) {
    await prisma.whatsAppAccount.update({
      where: { id: accountId },
      data: {
        status:         WhatsAppAccountStatus.DISCONNECTED,
        accessToken:    null,
        tokenExpiresAt: null,
      },
    }).catch(() => {});
    
    return null;
  }

  return { account, accessToken: finalToken };
}
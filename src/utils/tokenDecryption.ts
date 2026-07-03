// src/utils/tokenDecryption.ts
// ✅ NEW FILE — single source of truth for account+token retrieval with auto-heal.
// Fixes: whatsapp.service.ts and meta.service.ts had two divergent copies of this
// logic. whatsapp.service.ts (used by ALL message sending) did NOT auto-heal
// plain-text tokens, did NOT mark broken accounts as DISCONNECTED — so message
// sending would silently fail while the dashboard showed "Connected".

import { WhatsAppAccount, WhatsAppAccountStatus } from '@prisma/client';
import prisma from '../config/database';
import { encrypt, safeDecryptStrict, isMetaToken, maskToken } from './encryption';

export interface AccountWithToken {
    account: WhatsAppAccount;
    accessToken: string;
}

/**
 * Fetch a WhatsApp account and return its DECRYPTED access token.
 *
 * Behavior:
 *   1. If token in DB is already plain-text (unencrypted, legacy accounts),
 *      auto-encrypts it in-place and returns the plain-text version.
 *   2. If token cannot be decrypted (encryption key mismatch / corruption),
 *      marks the account as DISCONNECTED and clears the token, then returns null.
 *   3. If account is not connected, returns null.
 *
 * Callers get a consistent contract: either a working token, or null (with the
 * DB updated so the UI shows the correct status).
 */
export async function getAccountWithDecryptedToken(
    accountId: string
): Promise<AccountWithToken | null> {
    const account = await prisma.whatsAppAccount.findUnique({
        where: { id: accountId },
    });

    if (!account) {
        console.error(`❌ Account not found: ${accountId}`);
        return null;
    }

    if (account.status !== WhatsAppAccountStatus.CONNECTED) {
        console.error(`❌ Account not connected: ${accountId}, status: ${account.status}`);
        return null;
    }

    if (!account.accessToken) {
        console.error(`❌ No access token for account: ${accountId}`);
        return null;
    }

    console.log(`🔐 Retrieving token for account ${accountId}...`);

    let decryptedToken = safeDecryptStrict(account.accessToken);

    // ✅ AUTO-HEAL: legacy plain-text token → encrypt and save
    if (!decryptedToken && isMetaToken(account.accessToken)) {
        console.log(`🔄 Auto-healing: plain-text token detected, encrypting now (${accountId})`);
        try {
            const encryptedToken = encrypt(account.accessToken);
            await prisma.whatsAppAccount.update({
                where: { id: accountId },
                data: { accessToken: encryptedToken },
            });
            decryptedToken = account.accessToken;
            console.log(`✅ Token encrypted and persisted`);
        } catch (err: any) {
            console.error(`❌ Auto-heal encryption failed:`, err.message);
        }
    }

    // ✅ If still no valid token, mark account disconnected so the UI reflects reality
    if (!decryptedToken) {
        console.error(`❌ Failed to decrypt token for ${accountId} — marking as DISCONNECTED`);
        console.error(`   Likely causes: ENCRYPTION_KEY changed, or DB corruption`);
        console.error(`   ✅ User must reconnect their WhatsApp account`);

        await prisma.whatsAppAccount
            .update({
                where: { id: accountId },
                data: {
                    status: WhatsAppAccountStatus.DISCONNECTED,
                    accessToken: null,
                    tokenExpiresAt: null,
                },
            })
            .catch((e) => console.error('Failed to mark account disconnected:', e));

        return null;
    }

    console.log(`✅ Token ready: ${maskToken(decryptedToken)}`);
    return { account, accessToken: decryptedToken };
}
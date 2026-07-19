// src/utils/tokenDecryption.ts
import { WhatsAppAccount, WhatsAppAccountStatus } from '@prisma/client';
import prisma from '../config/database';
import { encrypt, safeDecryptStrict, isMetaToken } from './encryption';
import { authLog } from './logger';

export interface AccountWithToken {
    account: WhatsAppAccount;
    accessToken: string;
}

/**
 * Fetch a WhatsApp account and return its DECRYPTED access token.
 */
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
        authLog.warn('Account not connected', { accountId, status: account.status });
        return null;
    }

    if (!account.accessToken) {
        authLog.error('No access token for account', null, { accountId });
        return null;
    }

    authLog.debug('Retrieving token for account', { accountId });

    let decryptedToken = safeDecryptStrict(account.accessToken);

    // ✅ AUTO-HEAL: legacy plain-text token → encrypt and save
    if (!decryptedToken && isMetaToken(account.accessToken)) {
        authLog.info('Auto-healing: plain-text token detected, encrypting now', { accountId });
        try {
            const encryptedToken = encrypt(account.accessToken);
            await prisma.whatsAppAccount.update({
                where: { id: accountId },
                data: { accessToken: encryptedToken },
            });
            decryptedToken = account.accessToken;
            authLog.info('Token encrypted and persisted', { accountId });
        } catch (err: any) {
            authLog.error('Auto-heal encryption failed', err, { accountId });
        }
    }

    // ✅ If still no valid token, mark account disconnected so the UI reflects reality
    if (!decryptedToken) {
        authLog.error('Failed to decrypt token — marking as DISCONNECTED', null, {
            accountId,
            cause: 'Likely ENCRYPTION_KEY changed, or DB corruption',
        });

        await prisma.whatsAppAccount
            .update({
                where: { id: accountId },
                data: {
                    status: WhatsAppAccountStatus.DISCONNECTED,
                    accessToken: null,
                    tokenExpiresAt: null,
                },
            })
            .catch((e) => authLog.error('Failed to mark account disconnected', e, { accountId }));

        return null;
    }

    authLog.debug('Token ready', { accountId });
    return { account, accessToken: decryptedToken };
}
// 📁 src/modules/meta/meta.controller.ts - COMPLETE FINAL VERSION

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { sendSuccess } from '../../utils/response';
import prisma from '../../config/database';
import { MessageStatus } from '@prisma/client';
import crypto from 'crypto';
import axios from 'axios';
import { config } from '../../config';
import { templatesService } from '../templates/templates.service';
import { metaApi } from './meta.api';
import { encrypt } from '../../utils/encryption';
import { metaService } from './meta.service';

// Helper to safely get organization ID from headers
const getOrgId = (req: Request): string => {
  const header = req.headers['x-organization-id'];
  if (!header) return '';
  return Array.isArray(header) ? header[0] : header;
};

// Extended Request interface
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
}

export class MetaController {
  // ============================================
  // GET OAUTH URL (Initiate Connection)
  // ============================================
  async getOAuthUrl(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Multiple sources for organization ID
      const organizationId =
        (req.query.organizationId as string) ||
        req.body.organizationId ||
        req.user?.organizationId;

      // Detailed logging
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔍 Meta OAuth URL Request');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Query params:', req.query);
      console.log('Body:', req.body);
      console.log('User:', req.user?.id);
      console.log('Organization ID:', organizationId);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      if (!organizationId) {
        console.error('❌ No organization ID provided');
        throw new AppError('Organization ID is required', 400);
      }

      // Verify organization exists
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (!organization) {
        console.error('❌ Organization not found:', organizationId);
        throw new AppError('Organization not found', 404);
      }

      console.log('✅ Organization found:', organization.name);

      // Verify user permissions
      const userId = req.user?.id;
      if (userId) {
        const membership = await prisma.organizationMember.findFirst({
          where: {
            organizationId,
            userId,
            role: { in: ['OWNER', 'ADMIN'] },
          },
        });

        if (!membership) {
          throw new AppError('You do not have permission to connect WhatsApp', 403);
        }
      }

      // Generate secure state
      const state = `${organizationId}:${crypto.randomBytes(32).toString('hex')}`;

      // Save state with expiry (10 minutes)
      await (prisma as any).oAuthState.create({
        data: {
          state,
          organizationId,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      // Clean up expired states
      await (prisma as any).oAuthState.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      console.log('✅ OAuth state created');

      // Build Meta Embedded Signup URL
      const metaAuthUrl = new URL(`https://www.facebook.com/${config.meta.graphApiVersion}/dialog/oauth`);

      metaAuthUrl.searchParams.set('client_id', process.env.META_APP_ID!);
      metaAuthUrl.searchParams.set('config_id', process.env.META_CONFIG_ID!);
      metaAuthUrl.searchParams.set('state', state);
      metaAuthUrl.searchParams.set('response_type', 'code');
      metaAuthUrl.searchParams.set('override_default_response_type', 'true');

      // Embedded Signup specific params
      metaAuthUrl.searchParams.set('auth_type', '');
      metaAuthUrl.searchParams.set('display', 'popup');

      // Extras for Embedded Signup v3
      const extras = JSON.stringify({
        featureType: 'whatsapp_business_app_onboarding',
        sessionInfoVersion: '3',
        version: 'v3',
        partner_data: null,
        is_hosted_es: true,
      });
      metaAuthUrl.searchParams.set('extras', extras);

      // Redirect URIs
      const redirectUri = `${process.env.FRONTEND_URL}/meta/callback`;
      const fallbackRedirectUri = `https://business.facebook.com/messaging/hosted_es/oauth_callback/?app_id=${process.env.META_APP_ID}&config_id=${process.env.META_CONFIG_ID}&extras=${encodeURIComponent(extras)}`;

      metaAuthUrl.searchParams.set('redirect_uri', redirectUri);
      metaAuthUrl.searchParams.set('fallback_redirect_uri', fallbackRedirectUri);

      // Scopes
      metaAuthUrl.searchParams.set(
        'scope',
        'whatsapp_business_management,whatsapp_business_messaging,business_management'
      );

      console.log('✅ OAuth URL generated');

      return sendSuccess(res, {
        url: metaAuthUrl.toString(),
        authUrl: metaAuthUrl.toString(), // For compatibility
        state,
      }, 'OAuth URL generated');

    } catch (error: any) {
      console.error('❌ getOAuthUrl failed:', error);
      next(error);
    }
  }

  // Alias for getOAuthUrl
  async initiateConnection(req: AuthRequest, res: Response, next: NextFunction) {
    return this.getOAuthUrl(req, res, next);
  }

  async getAuthUrl(req: AuthRequest, res: Response, next: NextFunction) {
    return this.getOAuthUrl(req, res, next);
  }

  // ============================================
  // HANDLE CALLBACK (Complete Connection)
  // ============================================
  async handleCallback(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { code, state } = req.body;

      console.log('\n🔄 ========== META CALLBACK ==========');
      console.log('   Code:', code ? `${code.substring(0, 10)}...` : 'Missing');
      console.log('   State:', state ? `${state.substring(0, 20)}...` : 'Missing');

      if (!code) {
        throw new AppError('Authorization code is required', 400);
      }

      if (!state) {
        throw new AppError('State parameter is required', 400);
      }

      // Verify state
      const oauthState = await (prisma as any).oAuthState.findUnique({
        where: { state },
      });

      if (!oauthState) {
        console.error('❌ Invalid state token');
        throw new AppError('Invalid or expired state token', 400);
      }

      if (oauthState.expiresAt < new Date()) {
        await (prisma as any).oAuthState.delete({ where: { state } });
        console.error('❌ State token expired');
        throw new AppError('State token expired. Please try again.', 400);
      }

      const organizationId = oauthState.organizationId;
      console.log('   Organization ID:', organizationId);

      // Verify user permissions
      const userId = req.user?.id;
      if (userId) {
        const membership = await prisma.organizationMember.findFirst({
          where: {
            organizationId,
            userId,
            role: { in: ['OWNER', 'ADMIN'] },
          },
        });

        if (!membership) {
          throw new AppError('You do not have permission to connect WhatsApp', 403);
        }
      }

      console.log('📊 Step 1: Exchanging code for access token...');

      // Exchange code for access token
      const tokenResponse = await axios.get(
        `https://graph.facebook.com/${config.meta.graphApiVersion}/oauth/access_token`,
        {
          params: {
            client_id: process.env.META_APP_ID,
            client_secret: process.env.META_APP_SECRET,
            code,
            redirect_uri: `${process.env.FRONTEND_URL}/meta/callback`,
          },
        }
      );

      const { access_token } = tokenResponse.data;
      console.log('   ✅ Access token obtained');

      console.log('📊 Step 2: Getting WABA ID from token...');

      // ════════════════════════════════════════════════════════════
      // ✅ FIRST: Diagnostic - What does the token contain?
      // ════════════════════════════════════════════════════════════
      console.log('\n🔬 ═══ TOKEN DIAGNOSTIC ═══');
      try {
        const debugTokenResponse = await axios.get(
          `https://graph.facebook.com/${config.meta.graphApiVersion}/debug_token`,
          {
            params: {
              input_token: access_token,
              access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`,
            },
          }
        );

        const tokenData = debugTokenResponse.data?.data;
        
        console.log('   App ID:', tokenData?.app_id);
        console.log('   User ID:', tokenData?.user_id);
        console.log('   Is Valid:', tokenData?.is_valid);
        console.log('   Scopes:', tokenData?.scopes);
        console.log('   Granular Scopes:', JSON.stringify(tokenData?.granular_scopes, null, 2));
        console.log('   Type:', tokenData?.type);
        console.log('   Application:', tokenData?.application);
        
        // ⚠️ Critical Check
        const hasWhatsAppScope = tokenData?.scopes?.includes('whatsapp_business_management');
        const hasGranularScopes = tokenData?.granular_scopes?.length > 0;
        
        console.log('\n   📊 Analysis:');
        console.log('   - Has whatsapp_business_management scope:', hasWhatsAppScope);
        console.log('   - Has granular scopes:', hasGranularScopes);
        
        if (!hasWhatsAppScope && !hasGranularScopes) {
          console.log('\n   ❌ DIAGNOSIS: User did NOT complete Embedded Signup!');
          console.log('   ❌ They only logged in, but did not setup WhatsApp Business Account');
          console.log('   ✅ SOLUTION: User must use Embedded Signup wizard, not regular OAuth');
        }
        
      } catch (e: any) {
        console.log('   ❌ Token diagnostic failed:', e.message);
      }
      console.log('🔬 ═══ END DIAGNOSTIC ═══\n');

      // Continue with WABA detection...

      // ════════════════════════════════════════════════════════════
      // ✅ MULTI-METHOD WABA DETECTION - TRY 4 METHODS
      // ════════════════════════════════════════════════════════════
      let wabaId: string | null = null;
      let wabaDetectionMethod: string = '';

      // ────────────────────────────────────────────────────────────
      // METHOD 1: Debug Token - Granular Scopes
      // ────────────────────────────────────────────────────────────
      try {
        console.log('   🔍 Method 1: Checking granular scopes...');
        
        const debugTokenResponse = await axios.get(
          `https://graph.facebook.com/${config.meta.graphApiVersion}/debug_token`,
          {
            params: {
              input_token: access_token,
              access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`,
            },
          }
        );

        const granularScopes = debugTokenResponse.data?.data?.granular_scopes || [];
        
        console.log('   📋 Granular scopes:', JSON.stringify(granularScopes, null, 2));

        for (const scope of granularScopes) {
          if (scope.scope === 'whatsapp_business_management' && scope.target_ids?.length) {
            wabaId = scope.target_ids[0];
            wabaDetectionMethod = 'granular_scopes';
            console.log('   ✅ Method 1 SUCCESS - WABA from scopes:', wabaId);
            break;
          }
        }
      } catch (e: any) {
        console.warn('   ⚠️ Method 1 failed:', e.message);
      }

      // ────────────────────────────────────────────────────────────
      // METHOD 2: User's Businesses → Owned WABAs
      // ────────────────────────────────────────────────────────────
      if (!wabaId) {
        try {
          console.log('   🔍 Method 2: Querying user businesses...');
          
          const businessResponse = await axios.get(
            `https://graph.facebook.com/${config.meta.graphApiVersion}/me`,
            {
              params: {
                access_token,
                fields: 'id,name,businesses{id,name,owned_whatsapp_business_accounts{id,name,currency,timezone_id}}',
              },
            }
          );

          console.log('   📋 Businesses response:', JSON.stringify(businessResponse.data, null, 2));

          const businesses = businessResponse.data?.businesses?.data || [];
          
          for (const business of businesses) {
            const wabas = business?.owned_whatsapp_business_accounts?.data || [];
            if (wabas.length > 0) {
              wabaId = wabas[0].id;
              wabaDetectionMethod = 'user_businesses';
              console.log('   ✅ Method 2 SUCCESS - WABA from business:', wabaId);
              console.log('   Business:', business.name);
              break;
            }
          }
        } catch (e: any) {
          console.warn('   ⚠️ Method 2 failed:', e.message);
        }
      }

      // ────────────────────────────────────────────────────────────
      // METHOD 3: Client WABAs (Shared with App)
      // ────────────────────────────────────────────────────────────
      if (!wabaId) {
        try {
          console.log('   🔍 Method 3: Querying client WABAs...');
          
          const businessResponse = await axios.get(
            `https://graph.facebook.com/${config.meta.graphApiVersion}/me`,
            {
              params: {
                access_token,
                fields: 'id,businesses{id,client_whatsapp_business_accounts{id,name,currency,timezone_id}}',
              },
            }
          );

          const businesses = businessResponse.data?.businesses?.data || [];
          
          for (const business of businesses) {
            const wabas = business?.client_whatsapp_business_accounts?.data || [];
            if (wabas.length > 0) {
              wabaId = wabas[0].id;
              wabaDetectionMethod = 'client_wabas';
              console.log('   ✅ Method 3 SUCCESS - WABA from client:', wabaId);
              break;
            }
          }
        } catch (e: any) {
          console.warn('   ⚠️ Method 3 failed:', e.message);
        }
      }

      // ────────────────────────────────────────────────────────────
      // METHOD 4: Direct WABA Search via /me
      // ────────────────────────────────────────────────────────────
      if (!wabaId) {
        try {
          console.log('   🔍 Method 4: Direct WABA query...');
          
          const directResponse = await axios.get(
            `https://graph.facebook.com/${config.meta.graphApiVersion}/me`,
            {
              params: {
                access_token,
                fields: 'owned_whatsapp_business_accounts{id,name},client_business_id',
              },
            }
          );

          console.log('   📋 Direct query response:', JSON.stringify(directResponse.data, null, 2));

          const ownedWabas = directResponse.data?.owned_whatsapp_business_accounts?.data || [];
          if (ownedWabas.length > 0) {
            wabaId = ownedWabas[0].id;
            wabaDetectionMethod = 'direct_owned';
            console.log('   ✅ Method 4 SUCCESS - WABA direct owned:', wabaId);
          }
        } catch (e: any) {
          console.warn('   ⚠️ Method 4 failed:', e.message);
        }
      }

      // ────────────────────────────────────────────────────────────
      // FINAL CHECK: WABA Found?
      // ────────────────────────────────────────────────────────────
      if (!wabaId) {
        console.error('\n❌ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('   WABA NOT FOUND - DIAGNOSIS:');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('   The user logged in but did NOT complete Embedded Signup.');
        console.error('   They likely:');
        console.error('   1. Used regular OAuth instead of Embedded Signup wizard');
        console.error('   2. Skipped business creation step');
        console.error('   3. Skipped WhatsApp Business Account creation');
        console.error('   4. Cancelled before phone verification');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        throw new AppError(
          '🚫 WhatsApp Setup Incomplete\n\n' +
          'You logged in to Facebook successfully, but you didn\'t complete the WhatsApp Business setup wizard.\n\n' +
          '✅ TO FIX THIS:\n' +
          '1. Click "Connect" again\n' +
          '2. The WhatsApp wizard should appear\n' +
          '3. Click "Get Started" in the wizard\n' +
          '4. Create a Business Portfolio\n' +
          '5. Create a WhatsApp Business Account\n' +
          '6. Add and VERIFY a phone number\n' +
          '7. Click "FINISH" at the end\n\n' +
          '⚠️ Important: The phone number must NOT be currently used on regular WhatsApp app!',
          400
        );
      }

      console.log(`\n   ✅ WABA ID: ${wabaId}`);
      console.log(`   ✅ Detection method: ${wabaDetectionMethod}\n`);

      console.log('📊 Step 3: Fetching WABA details...');

      // Get WABA details
      const wabaDetails = await axios.get(
        `https://graph.facebook.com/${config.meta.graphApiVersion}/${wabaId}`,
        {
          params: {
            fields: 'id,name,currency,timezone_id,message_template_namespace',
            access_token,
          },
        }
      );

      console.log('   ✅ WABA Name:', wabaDetails.data.name);

      console.log('📊 Step 4: Fetching phone numbers...');

      // Get phone numbers
      const phoneNumbersResponse = await axios.get(
        `https://graph.facebook.com/${config.meta.graphApiVersion}/${wabaId}/phone_numbers`,
        {
          params: {
            access_token,
          },
        }
      );

      const phoneNumbers = phoneNumbersResponse.data.data || [];
      console.log('   ✅ Phone numbers found:', phoneNumbers.length);

      if (phoneNumbers.length === 0) {
        console.warn('⚠️ No phone numbers found for WABA');
      }

      console.log('📊 Step 5: Saving to database...');

      // ============================================
      // STEP 5: SAVE TO DATABASE - ✅ FIXED VERSION
      // ============================================
      console.log('📊 Step 5: Saving to database...');

      let savedAccount = null;

      if (phoneNumbers.length > 0) {
        const primaryPhone = phoneNumbers[0];

        // Encrypt token
        const encryptedToken = encrypt(access_token);
        console.log('   Token encrypted successfully');

        // ✅ ADD: Organization level check - sirf ek connected account
        const existingConnectedInOrg = await prisma.whatsAppAccount.findFirst({
          where: {
            organizationId,
            status: 'CONNECTED',
            phoneNumberId: { not: primaryPhone.id }, // Same phone reconnect allow karo
          },
        });

        if (existingConnectedInOrg) {
          // State cleanup karo
          await (prisma as any).oAuthState.delete({ where: { state } }).catch(() => {});
          
          throw new AppError(
            `Your organization already has a connected WhatsApp account ` +
            `(${existingConnectedInOrg.phoneNumber}). ` +
            `Please disconnect it first from Settings → WhatsApp.`,
            400
          );
        }

        try {
          // ✅ CRITICAL FIX: Check if account already exists
          const existingAccount = await prisma.whatsAppAccount.findFirst({
            where: {
              OR: [
                { phoneNumberId: primaryPhone.id },
                {
                  organizationId,
                  wabaId
                }
              ]
            }
          });

          if (existingAccount) {
            // ✅ UPDATE existing account
            console.log(`   Updating existing account: ${existingAccount.id}`);

            savedAccount = await prisma.whatsAppAccount.update({
              where: { id: existingAccount.id },
              data: {
                organizationId, // ✅ CLAIM ownership (in case it moved orgs)
                status: 'CONNECTED',
                phoneNumber: primaryPhone.display_phone_number,
                displayName: primaryPhone.verified_name || primaryPhone.display_phone_number,
                verifiedName: primaryPhone.verified_name,
                qualityRating: primaryPhone.quality_rating,
                accessToken: encryptedToken,
                wabaId: wabaId,
                isDefault: true,
              },
            });

            console.log('   ✅ WhatsAppAccount UPDATED:', savedAccount.id);
          } else {
            // ✅ CREATE new account
            console.log('   Creating new WhatsApp account...');

            // First, unset any existing default
            await prisma.whatsAppAccount.updateMany({
              where: { organizationId, isDefault: true },
              data: { isDefault: false }
            });

            savedAccount = await prisma.whatsAppAccount.create({
              data: {
                organizationId,
                phoneNumberId: primaryPhone.id,
                wabaId,
                accessToken: encryptedToken,
                phoneNumber: primaryPhone.display_phone_number,
                displayName: primaryPhone.verified_name || primaryPhone.display_phone_number,
                verifiedName: primaryPhone.verified_name,
                qualityRating: primaryPhone.quality_rating,
                status: 'CONNECTED',
                isDefault: true,
              },
            });

            console.log('   ✅ WhatsAppAccount CREATED:', savedAccount.id);
          }

          // ✅ VERIFY save was successful
          const verifyAccount = await prisma.whatsAppAccount.findUnique({
            where: { id: savedAccount.id }
          });

          if (!verifyAccount) {
            throw new Error('Account verification failed - not found after save!');
          }

          console.log('   ✅ Account verified in database:', {
            id: verifyAccount.id,
            phone: verifyAccount.phoneNumber,
            status: verifyAccount.status,
          });

        } catch (dbError: any) {
          console.error('   ❌ Database save error:', dbError);
          console.error('   Error details:', {
            code: dbError.code,
            message: dbError.message,
            meta: dbError.meta,
          });

          // ✅ If unique constraint violation, try to find and update
          if (dbError.code === 'P2002') {
            console.log('   🔄 Handling unique constraint - finding existing...');

            const existing = await prisma.whatsAppAccount.findFirst({
              where: { phoneNumberId: primaryPhone.id }
            });

            if (existing) {
              savedAccount = await prisma.whatsAppAccount.update({
                where: { id: existing.id },
                data: {
                  organizationId, // ✅ Update org ownership
                  status: 'CONNECTED',
                  accessToken: encryptedToken,
                  wabaId,
                  isDefault: true,
                },
              });
              console.log('   ✅ Updated existing account:', savedAccount.id);
            } else {
              throw dbError;
            }
          } else {
            throw dbError;
          }
        }
      }

      // ✅ Also save/update MetaConnection
      let savedMetaConnection = null;
      try {
        const encryptedToken = encrypt(access_token);

        savedMetaConnection = await (prisma as any).metaConnection.upsert({
          where: { organizationId },
          update: {
            accessToken: encryptedToken,
            wabaId,
            wabaName: wabaDetails.data.name,
            status: 'CONNECTED',
            lastSyncedAt: new Date(),
          },
          create: {
            organizationId,
            accessToken: encryptedToken,
            wabaId,
            wabaName: wabaDetails.data.name,
            status: 'CONNECTED',
          },
        });
        console.log('   ✅ MetaConnection saved:', savedMetaConnection.id);
      } catch (e: any) {
        console.log('   ⚠️ MetaConnection save failed:', e.message);
      }

      // ✅ Save PhoneNumbers
      try {
        if (savedMetaConnection) {
          for (const phone of phoneNumbers) {
            await (prisma as any).phoneNumber.upsert({
              where: { phoneNumberId: phone.id },
              update: {
                phoneNumber: phone.display_phone_number,
                displayName: phone.verified_name || phone.display_phone_number,
                qualityRating: phone.quality_rating,
                verifiedName: phone.verified_name,
                isActive: true,
              },
              create: {
                metaConnectionId: savedMetaConnection.id,
                phoneNumberId: phone.id,
                phoneNumber: phone.display_phone_number,
                displayName: phone.verified_name || phone.display_phone_number,
                qualityRating: phone.quality_rating,
                verifiedName: phone.verified_name,
                isActive: true,
                isPrimary: phone.id === phoneNumbers[0].id,
              },
            });
          }
          console.log('   ✅ PhoneNumbers saved');
        }
      } catch (e: any) {
        console.log('   ⚠️ PhoneNumber save failed:', e.message);
      }

      // ✅ STEP 6: MANDATORY META ONBOARDING STEPS
      try {
        console.log('📊 Step 6: Completing Meta onboarding...');

        // ✅ 1. Subscribe to ALL required webhooks
        await metaApi.subscribeToWebhooks(wabaId, access_token).catch(err =>
          console.error('⚠️ Webhook subscription failed:', err.message)
        );

        // ✅ 2. Subscribe to WBA Onboarding specific webhooks
        try {
          await axios.post(
            `https://graph.facebook.com/${config.meta.graphApiVersion}/${wabaId}/subscribed_apps`,
            {
              subscribed_fields: [
                'messages',
                'message_template_status_update',
                'history',              // ✅ NEW: Past messages
                'smb_app_state_sync',   // ✅ NEW: Business customer contacts
                'smb_message_echoes',   // ✅ NEW: New messages from WBA app
              ]
            },
            {
              params: { access_token }
            }
          );
          console.log('✅ All webhooks subscribed including WBA onboarding fields');
        } catch (webhookErr: any) {
          console.error('⚠️ Extended webhook subscription failed:', 
                        webhookErr.response?.data || webhookErr.message);
        }

        // ✅ 3. Register Phone Numbers
        for (const phone of phoneNumbers) {
          await metaApi.registerPhoneNumber(phone.id, access_token)
            .catch(err => console.warn(`⚠️ Registration skipped:`, err.message));
        }

        // ✅ 4. Sync message history (WBA Onboarding - within 24 hours!)
        if (savedAccount) {
          console.log('🔄 Initiating message history sync...');
          syncMessageHistory(wabaId, access_token, organizationId, savedAccount.id)
            .catch(err => console.error('⚠️ History sync failed:', err.message));
        }

      } catch (onboardingErr: any) {
        console.error('⚠️ Post-connection steps failed:', onboardingErr.message);
      }

      // Delete used state
      await (prisma as any).oAuthState.delete({ where: { state } });

      console.log('✅ Meta callback successful');

      // After saving WhatsAppAccount, VERIFY it exists
      if (savedAccount) {
        // ✅ Verify save was successful
        const verifyAccount = await prisma.whatsAppAccount.findUnique({
          where: { id: savedAccount.id },
        });

        if (!verifyAccount) {
          console.error('❌ CRITICAL: Account save verification failed!');
          throw new AppError('Failed to save WhatsApp account. Please try again.', 500);
        }

        console.log('✅ Account save verified:', verifyAccount.id);

        // ✅ FIXED: Longer delay for template sync
        setTimeout(async () => {
          try {
            console.log('🔄 Starting delayed template sync...');

            // Wait extra time for any DB replication
            await new Promise(resolve => setTimeout(resolve, 2000));

            const result = await templatesService.syncFromMeta(organizationId, savedAccount.id);
            console.log('✅ Template sync completed:', result);
          } catch (syncError: any) {
            console.error('❌ Template sync error:', syncError.message);
            // Non-critical, templates can be synced manually
          }
        }, 5000); // Increased to 5 seconds
      }

      console.log('🔄 ========== META CALLBACK END ==========\n');

      return sendSuccess(
        res,
        {
          wabaId,
          wabaName: wabaDetails.data.name,
          phoneNumbers: phoneNumbers.map((p: any) => ({
            id: p.id,
            phoneNumber: p.display_phone_number,
            displayName: p.verified_name,
            qualityRating: p.quality_rating,
          })),
          phoneNumberCount: phoneNumbers.length,
          account: savedAccount,
        },
        'WhatsApp account connected successfully'
      );
    } catch (error: any) {
      console.error('❌ Meta callback error:', error);

      // Provide specific error messages
      if (error.response?.data) {
        console.error('   Meta API Error:', error.response.data);
        const apiError = error.response.data.error;
        throw new AppError(
          apiError?.message || 'Meta API error',
          error.response.status || 500
        );
      }

      next(error);
    }
  }

  // ============================================
  // GET ACCOUNTS (OLD METHOD - WHATSAPPACCOUNT ONLY)
  // ============================================
  async getAccounts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = getOrgId(req) || req.query.organizationId as string;

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      const orgIdString = Array.isArray(organizationId) ? organizationId[0] : organizationId;
      console.log('📋 Fetching accounts (old method) for org:', orgIdString);

      const accounts = await prisma.whatsAppAccount.findMany({
        where: { organizationId: orgIdString },
        orderBy: { createdAt: 'desc' },
      });

      console.log('   Found accounts:', accounts.length);

      return sendSuccess(res, accounts, 'Accounts fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET WHATSAPP ACCOUNTS (NEW METHOD - SUPPORTS BOTH STRUCTURES)
  // ============================================
  async getWhatsAppAccounts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { organizationId } = req.params;

      console.log('\n📋 Fetching WhatsApp accounts for org:', organizationId);

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      let accounts: any[] = [];

      // METHOD 1: Check MetaConnection + PhoneNumber (New structure)
      try {
        const metaConnection = await (prisma as any).metaConnection.findUnique({
          where: { organizationId },
          include: {
            phoneNumbers: {
              where: { isActive: true },
              orderBy: { isPrimary: 'desc' },
            },
          },
        });

        if (metaConnection && metaConnection.phoneNumbers && metaConnection.phoneNumbers.length > 0) {
          console.log('✅ Found MetaConnection with phones:', metaConnection.phoneNumbers.length);

          accounts = metaConnection.phoneNumbers.map((phone: any) => ({
            id: phone.id,
            phoneNumberId: phone.phoneNumberId,
            phoneNumber: phone.phoneNumber,
            displayName: phone.displayName,
            verifiedName: phone.verifiedName,
            qualityRating: phone.qualityRating,
            isPrimary: phone.isPrimary,
            isActive: phone.isActive,
            wabaId: metaConnection.wabaId,
            wabaName: metaConnection.wabaName,
          }));

          console.log('📤 Returning accounts from MetaConnection:', accounts.length);
          return sendSuccess(res, accounts, 'Accounts fetched successfully');
        }
      } catch (e: any) {
        console.log('⚠️ MetaConnection check failed:', e.message);
      }

      // METHOD 2: Check WhatsAppAccount table (Fallback)
      console.log('⚠️ No MetaConnection found, checking WhatsAppAccount table...');

      const orgIdString = Array.isArray(organizationId) ? organizationId[0] : organizationId;
      const whatsappAccounts = await prisma.whatsAppAccount.findMany({
        where: {
          organizationId: orgIdString,
          status: 'CONNECTED'
        },
        orderBy: { createdAt: 'desc' },
      });

      if (whatsappAccounts.length > 0) {
        console.log('✅ Found WhatsAppAccounts:', whatsappAccounts.length);
        accounts = whatsappAccounts.map((acc: any) => ({
          id: acc.id,
          phoneNumberId: acc.phoneNumberId,
          phoneNumber: acc.phoneNumber,
          displayName: acc.displayName,
          verifiedName: acc.verifiedName,
          qualityRating: acc.qualityRating,
          wabaId: acc.wabaId,
          isActive: acc.status === 'CONNECTED',
        }));
      }

      console.log('📤 Returning accounts:', accounts.length);

      return sendSuccess(res, accounts, 'Accounts fetched successfully');

    } catch (error: any) {
      console.error('❌ Get WhatsApp accounts error:', error);
      next(error);
    }
  }

  // ============================================
  // GET CONNECTION STATUS
  // ============================================
  async getConnectionStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { organizationId } = req.params;

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      console.log('🔍 Checking connection status for org:', organizationId);

      // Check MetaConnection
      let isConnected = false;
      let status = 'NOT_CONNECTED';
      let details: any = null;

      try {
        const metaConnection = await (prisma as any).metaConnection.findUnique({
          where: { organizationId },
          include: {
            phoneNumbers: {
              where: { isActive: true },
            },
          },
        });

        if (metaConnection) {
          isConnected = metaConnection.status === 'CONNECTED';
          status = metaConnection.status;
          details = {
            wabaId: metaConnection.wabaId,
            wabaName: metaConnection.wabaName,
            phoneNumbers: metaConnection.phoneNumbers?.length || 0,
            lastSyncedAt: metaConnection.lastSyncedAt,
          };
        }
      } catch (e) {
        console.log('⚠️ MetaConnection not available, checking WhatsAppAccount');
      }

      // Fallback to WhatsAppAccount
      if (!isConnected) {
        const orgIdString = Array.isArray(organizationId) ? organizationId[0] : organizationId;
        const whatsappAccount = await prisma.whatsAppAccount.findFirst({
          where: { organizationId: orgIdString, status: 'CONNECTED' },
        });

        if (whatsappAccount) {
          isConnected = true;
          status = 'CONNECTED';
          details = {
            wabaId: whatsappAccount.wabaId,
            phoneNumber: whatsappAccount.phoneNumber,
            displayName: whatsappAccount.displayName,
          };
        }
      }

      return sendSuccess(res, {
        isConnected,
        status,
        ...details,
      }, 'Connection status fetched');

    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET SINGLE ACCOUNT
  // ============================================
  async getAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const organizationId = getOrgId(req);

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      const account = await prisma.whatsAppAccount.findFirst({
        where: { id, organizationId },
      });

      if (!account) {
        throw new AppError('Account not found', 404);
      }

      return sendSuccess(res, account, 'Account fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // DISCONNECT ACCOUNT
  // ============================================
  async disconnectAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const organizationId = getOrgId(req);

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });

      if (!membership) {
        throw new AppError('You do not have permission to disconnect', 403);
      }

      await prisma.whatsAppAccount.update({
        where: { id },
        data: { status: 'DISCONNECTED' },
      });

      // Also disconnect MetaConnection if exists
      try {
        await (prisma as any).metaConnection.update({
          where: { organizationId },
          data: { status: 'DISCONNECTED' },
        });
      } catch (e) {
        console.log('⚠️ MetaConnection not updated (may not exist)');
      }

      return sendSuccess(res, { success: true }, 'Account disconnected successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET EMBEDDED SIGNUP CONFIG
  // ============================================
  async getEmbeddedSignupConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = {
        appId: process.env.META_APP_ID,
        configId: process.env.META_CONFIG_ID,
        version: 'v25.0',
        features: ['whatsapp_business_app_onboarding'],
      };

      return sendSuccess(res, config, 'Config fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET INTEGRATION STATUS
  // ============================================
  async getIntegrationStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = {
        configured: !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
        appId: process.env.META_APP_ID,
        version: 'v25.0',
        embeddedSignup: true,
      };

      return sendSuccess(res, status, 'Integration status fetched');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // WEBHOOK VERIFICATION (META REQUIREMENT)
  // ============================================
  async verifyWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN;

      console.log('📞 Webhook verification request:', {
        mode,
        token: token ? '***' : 'missing',
        challenge: challenge ? 'present' : 'missing',
      });

      if (mode === 'subscribe' && token === verifyToken) {
        console.log('✅ Webhook verified successfully');
        res.status(200).send(challenge);
      } else {
        console.error('❌ Webhook verification failed');
        res.sendStatus(403);
      }
    } catch (error) {
      console.error('❌ Webhook verification error:', error);
      res.sendStatus(500);
    }
  }

  // ============================================
  // WEBHOOK HANDLER - ✅ COMPLETE WITH STATUS UPDATES
  // ============================================
  async handleWebhook(req: Request, res: Response) {
    try {
      const body = req.body;

      console.log('\n📨 ========== WEBHOOK RECEIVED ==========');
      console.log(JSON.stringify(body, null, 2));

      // Acknowledge receipt immediately (Meta requirement)
      res.sendStatus(200);

      // Process webhook asynchronously
      const entry = body?.entry;

      if (!Array.isArray(entry) || entry.length === 0) {
        console.warn('⚠️ Invalid webhook payload - no entries');
        return;
      }

      for (const item of entry) {
        const changes = item.changes || [];

        for (const change of changes) {
          const field = change.field;
          const value = change.value;

          // ✅ HANDLE MESSAGE STATUS UPDATES
          if (field === 'messages' && value.statuses && Array.isArray(value.statuses)) {
            for (const statusUpdate of value.statuses) {
              console.log('📦 STATUS UPDATE:', {
                id: statusUpdate.id,
                status: statusUpdate.status,
                recipient_id: statusUpdate.recipient_id,
                timestamp: statusUpdate.timestamp,
                errors: statusUpdate.errors,
              });

              try {
                // Map Meta status to our MessageStatus enum
                let dbStatus: MessageStatus = MessageStatus.SENT;
                let deliveredAt: Date | undefined;
                let readAt: Date | undefined;
                let failedAt: Date | undefined;

                const metaStatus = statusUpdate.status;
                const timestamp = new Date(Number(statusUpdate.timestamp) * 1000);

                switch (metaStatus) {
                  case 'sent':
                    dbStatus = MessageStatus.SENT;
                    break;
                  case 'delivered':
                    dbStatus = MessageStatus.DELIVERED;
                    deliveredAt = timestamp;
                    break;
                  case 'read':
                    dbStatus = MessageStatus.READ;
                    readAt = timestamp;
                    break;
                  case 'failed':
                    dbStatus = MessageStatus.FAILED;
                    failedAt = timestamp;
                    break;
                  default:
                    console.warn(`⚠️ Unknown status: ${metaStatus}`);
                }

                // Extract failure reason if failed
                const failureReason = statusUpdate.errors?.[0]?.message || null;

                // ✅ Update Message in DB
                const updateData: any = {
                  status: dbStatus,
                };

                if (deliveredAt) updateData.deliveredAt = deliveredAt;
                if (readAt) updateData.readAt = readAt;
                if (failedAt) updateData.failedAt = failedAt;
                if (failureReason) updateData.failureReason = failureReason;

                const updated = await prisma.message.updateMany({
                  where: {
                    OR: [
                      { wamId: statusUpdate.id },
                      { waMessageId: statusUpdate.id },
                    ],
                  },
                  data: updateData,
                });

                if (updated.count > 0) {
                  console.log(`✅ Updated ${updated.count} message(s) to status: ${dbStatus}`);
                } else {
                  console.warn(`⚠️ No message found with ID: ${statusUpdate.id}`);
                }

                // ✅ Update CampaignContact status if this is a campaign message
                if (updated.count > 0) {
                  await prisma.campaignContact.updateMany({
                    where: { waMessageId: statusUpdate.id },
                    data: {
                      status: dbStatus,
                      deliveredAt,
                      readAt,
                      failedAt,
                      failureReason,
                    },
                  });
                }
              } catch (dbError: any) {
                console.error('❌ DB update error:', dbError.message);
              }
            }
          }

          // ✅ HANDLE INCOMING MESSAGES
          if (field === 'messages' && value.messages && Array.isArray(value.messages)) {
            for (const message of value.messages) {
              console.log('📩 INCOMING MESSAGE:', {
                id: message.id,
                from: message.from,
                type: message.type,
                timestamp: message.timestamp,
              });

              // TODO: Process incoming message
              // This would create a new Message record with direction: INBOUND
              // await this.processIncomingMessage(message, value.metadata);
            }
          }

          // ✅ HANDLE TEMPLATE STATUS UPDATES
          if (field === 'message_template_status_update') {
            console.log('📋 TEMPLATE STATUS UPDATE:', {
              messageTemplateId: value.message_template_id,
              event: value.event,
            });

            // TODO: Update template status in DB
            // await this.updateTemplateStatus(value);
          }
        }
      }

      console.log('📨 ========== WEBHOOK PROCESSED ==========\n');
    } catch (error: any) {
      console.error('❌ Webhook processing error:', error);
      // Still return 200 to Meta to prevent retries
      res.sendStatus(200);
    }
  }
  // ============================================
  // COMPLETE CONNECTION
  // ============================================
  async completeConnection(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      const userId = (req as AuthRequest).user?.id; // Note: using id instead of userId based on AuthRequest interface
      
      if (!organizationId || !userId) {
        throw new AppError('Organization not found', 404);
      }

      const { code, accessToken, connectionType } = req.body; // ✅ Get connectionType
      
      const codeOrToken = accessToken || code;
      
      if (!codeOrToken) {
        throw new AppError('Authorization code or access token is required', 400);
      }

      // ✅ Pass connectionType to service
      const result = await metaService.completeConnection(
        codeOrToken,
        organizationId,
        userId,
        connectionType || 'CLOUD_API' // Default to CLOUD_API
      );

      if (result.success) {
        return res.json({
          success: true,
          message: 'WhatsApp account connected successfully',
          data: result.account
        });
      } else {
        throw new AppError(result.error || 'Failed to connect', 400);
      }
    } catch (error) {
      next(error);
    }
  }
}

// ✅ Message History Sync (WBA Onboarding requirement)
async function syncMessageHistory(
  wabaId: string,
  accessToken: string,
  organizationId: string,
  accountId: string
): Promise<void> {
  try {
    console.log('📜 Starting message history sync for WABA:', wabaId);

    // Step 1: Request history sync
    const syncResponse = await axios.post(
      `https://graph.facebook.com/${config.meta.graphApiVersion}/${wabaId}/sync_history`,
      {},
      { params: { access_token: accessToken } }
    );

    console.log('✅ History sync initiated:', syncResponse.data);

    // Step 2: Update DB - mark sync as in progress
    await prisma.whatsAppAccount.update({
      where: { id: accountId },
      data: {
        // Store sync status in metadata or a field
        lastSyncedAt: new Date(),
      } as any,
    });

  } catch (err: any) {
    // History sync failure is non-critical
    console.warn('⚠️ History sync failed (non-critical):', 
                  err.response?.data?.error?.message || err.message);
  }
}

export const metaController = new MetaController();
export default metaController;
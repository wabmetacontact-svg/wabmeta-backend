"use strict";
// src/modules/calling/calling.controller.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.callingController = void 0;
const errorHandler_1 = require("../../middleware/errorHandler");
const meta_api_1 = require("../meta/meta.api");
const meta_service_1 = require("../meta/meta.service");
const database_1 = __importDefault(require("../../config/database"));
class CallingController {
    // ✅ Get calling settings
    async getSettings(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization required', 400);
            // Get WhatsApp account (any status, not just CONNECTED)
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { organizationId, isActive: true },
                orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            });
            if (!account) {
                return res.json({
                    success: true,
                    data: {
                        callingEnabled: false,
                        inboundCallsEnabled: true,
                        callbackEnabled: true,
                        callHoursEnabled: false,
                        message: 'No WhatsApp account found',
                    },
                });
            }
            // Get token safely
            let settings = {
                callingEnabled: false,
                inboundCallsEnabled: true,
                callbackEnabled: true,
                callHoursEnabled: false,
            };
            try {
                const accountWithToken = await meta_service_1.metaService.getAccountWithToken(account.id);
                if (accountWithToken?.accessToken) {
                    // Get calling settings from Meta (may fail if calling not supported yet)
                    settings = await meta_api_1.metaApi.getCallingSettings(account.phoneNumberId, accountWithToken.accessToken);
                }
            }
            catch (metaErr) {
                // Meta settings fetch failed — return defaults (non-blocking)
                console.warn('[Calling] Could not fetch Meta calling settings:', metaErr?.message || metaErr);
            }
            return res.json({
                success: true,
                data: {
                    ...settings,
                    phoneNumberId: account.phoneNumberId,
                    phoneNumber: account.phoneNumber,
                },
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ✅ Enable/disable calling
    async updateSettings(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization required', 400);
            const { callingEnabled, inboundCallsEnabled, callbackEnabled, callHoursEnabled, whatsappAccountId, 
            // New fields
            restrictToCountries, timezone, weeklyHours, holidaySchedule, } = req.body;
            // Get account
            let account = null;
            if (whatsappAccountId) {
                account = await database_1.default.whatsAppAccount.findFirst({
                    where: { id: whatsappAccountId, organizationId },
                });
            }
            if (!account) {
                account = await database_1.default.whatsAppAccount.findFirst({
                    where: { organizationId, status: 'CONNECTED' },
                    orderBy: { isDefault: 'desc' },
                });
            }
            if (!account)
                throw new errorHandler_1.AppError('No WhatsApp account found', 400);
            const accountWithToken = await meta_service_1.metaService.getAccountWithToken(account.id);
            if (!accountWithToken)
                throw new errorHandler_1.AppError('Token decryption failed', 500);
            // Update calling settings with full schema
            const result = await meta_api_1.metaApi.enableCalling(account.phoneNumberId, accountWithToken.accessToken, {
                callingEnabled: callingEnabled ?? true,
                inboundCallsEnabled: inboundCallsEnabled ?? true,
                callbackEnabled: callbackEnabled ?? true,
                callHoursEnabled: callHoursEnabled ?? false,
                // Country restriction (default: India only)
                restrictToCountries: restrictToCountries ?? ['IN'],
                // Business hours (default: Mon-Fri 9AM-6PM IST)
                timezone: timezone || 'Asia/Kolkata',
                weeklyHours: weeklyHours || [],
                holidaySchedule: holidaySchedule || [],
            });
            // Subscribe to calls webhook if enabling
            if (callingEnabled) {
                await meta_api_1.metaApi.subscribeToCallsWebhook(account.wabaId, accountWithToken.accessToken).catch((e) => console.warn('Webhook subscribe failed:', e.message));
            }
            return res.json({
                success: true,
                message: callingEnabled
                    ? 'Calling enabled successfully'
                    : 'Calling disabled successfully',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ✅ Initiate call to customer
    async initiateCall(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            const userId = req.user?.id;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization required', 400);
            const { to, contactId, conversationId, whatsappAccountId } = req.body;
            if (!to)
                throw new errorHandler_1.AppError('Phone number required', 400);
            // Get account
            let account = null;
            if (whatsappAccountId) {
                account = await database_1.default.whatsAppAccount.findFirst({
                    where: { id: whatsappAccountId, organizationId },
                });
            }
            if (!account) {
                account = await database_1.default.whatsAppAccount.findFirst({
                    where: { organizationId, status: 'CONNECTED' },
                    orderBy: { isDefault: 'desc' },
                });
            }
            if (!account)
                throw new errorHandler_1.AppError('No WhatsApp account found. Please connect a WhatsApp account first.', 400);
            const accountWithToken = await meta_service_1.metaService.getAccountWithToken(account.id);
            if (!accountWithToken)
                throw new errorHandler_1.AppError('Token decryption failed. Please reconnect your WhatsApp account.', 500);
            // ✅ Step 1: Auto-enable calling on this phone number (if not already enabled)
            // Per Meta docs: POST /<PHONE_NUMBER_ID>/settings must be called first
            try {
                await meta_api_1.metaApi.enableCalling(account.phoneNumberId, accountWithToken.accessToken, {
                    callingEnabled: true,
                    inboundCallsEnabled: true,
                    callbackEnabled: true,
                });
                console.log('[Calling] ✅ Calling settings enabled for:', account.phoneNumberId);
            }
            catch (settingsErr) {
                // If settings enable fails due to eligibility (2000 limit), throw clear error
                const settingsMsg = settingsErr?.metaError?.message || settingsErr?.message || '';
                const settingsCode = settingsErr?.metaError?.code;
                console.warn('[Calling] Settings enable warning:', settingsCode, settingsMsg);
                if (settingsCode === 141000 || settingsMsg.includes('2000') || settingsMsg.includes('limit')) {
                    throw new errorHandler_1.AppError('WhatsApp Calling requires 2000+ business-initiated conversations/day. ' +
                        'Your current messaging tier is below this limit. ' +
                        'Send more campaigns to increase your tier, then try again.', 403);
                }
                // Non-blocking: if settings fail for other reasons, still try the call
                console.warn('[Calling] Could not update settings, attempting call anyway...');
            }
            // ✅ Step 2: Resolve actual business phone number for wa.me URL
            // account.phoneNumber may be null, or stored as display format like "+91 76781 03840"
            // phoneNumberId is Meta's 16-digit internal ID — NOT a real phone number for wa.me
            let businessPhoneNumber = undefined;
            const rawPhone = account.phoneNumber || account.displayPhoneNumber || '';
            const cleanedPhone = rawPhone.replace(/[^0-9]/g, '');
            // A real E.164 number is 7–15 digits. phoneNumberId is 16 digits — reject it.
            if (cleanedPhone.length >= 7 && cleanedPhone.length <= 15) {
                businessPhoneNumber = cleanedPhone;
                console.log('[Calling] Using stored phone number:', businessPhoneNumber);
            }
            else {
                // Fetch from Meta API as fallback
                console.log('[Calling] Stored phone number invalid/missing, fetching from Meta...');
                try {
                    const phoneDetails = await meta_api_1.metaApi.getPhoneNumberDetails(account.phoneNumberId, accountWithToken.accessToken);
                    const fetched = (phoneDetails.displayPhoneNumber || '').replace(/[^0-9]/g, '');
                    if (fetched.length >= 7 && fetched.length <= 15) {
                        businessPhoneNumber = fetched;
                        console.log('[Calling] ✅ Fetched phone number from Meta:', businessPhoneNumber);
                    }
                }
                catch (e) {
                    console.warn('[Calling] Could not fetch phone number from Meta:', e?.message);
                }
            }
            if (!businessPhoneNumber) {
                console.warn('[Calling] ⚠️ Could not resolve business phone number — wa.me URL will be incomplete');
            }
            // ✅ Step 3: Send a call CTA message (requires active 24h session)
            // WhatsApp Business Calling does NOT support cold-calling via /calls endpoint.
            // We send an interactive message with a Call button instead.
            // Customer taps "Call Now" → opens wa.me/<phone>?call=true → WhatsApp voice call starts
            let callResult;
            try {
                callResult = await meta_api_1.metaApi.initiateCall(account.phoneNumberId, accountWithToken.accessToken, to, {
                    callbackData: `org:${organizationId}:contact:${contactId || 'unknown'}`,
                    businessPhoneNumber,
                });
            }
            catch (metaErr) {
                // ✅ Extract Meta-specific error details
                const metaError = metaErr?.metaError || metaErr?.response?.data?.error;
                const metaCode = metaError?.code;
                const metaSubcode = metaError?.error_subcode;
                const metaMsg = metaError?.message || metaErr?.message || '';
                console.error('[Calling] Meta API error:', {
                    code: metaCode,
                    subcode: metaSubcode,
                    message: metaMsg,
                    phoneNumberId: account.phoneNumberId,
                });
                // ✅ Translate Meta error codes to friendly messages
                if (metaCode === 131009 && metaSubcode === 2494010) {
                    throw new errorHandler_1.AppError('WhatsApp Calling requires an active messaging session. ' +
                        'The customer must send you a message first (within 24 hours) before you can initiate a call. ' +
                        'Ask the customer to message you on WhatsApp, then try calling.', 400);
                }
                if (metaCode === 141000 || metaSubcode === 2655010 || metaMsg.includes('not a valid Cloud API number')) {
                    throw new errorHandler_1.AppError('WhatsApp Calling API is not enabled for this phone number. ' +
                        'Your number needs to be separately approved by Meta for the Calling product. ' +
                        'Visit Meta Business Suite → WhatsApp → Calling to request access.', 400);
                }
                if (metaCode === 100 || metaMsg.includes('not supported') || metaMsg.includes('not enabled')) {
                    throw new errorHandler_1.AppError('WhatsApp Calling is not enabled on this account. Enable it in Settings → WhatsApp Calling.', 400);
                }
                if (metaCode === 131056 || metaMsg.includes('permission')) {
                    throw new errorHandler_1.AppError('Call permission required. The user must opt-in to receive calls from your business.', 403);
                }
                if (metaCode === 131048 || metaMsg.includes('2000') || metaMsg.includes('limit')) {
                    throw new errorHandler_1.AppError('Your account needs 2000+ daily messaging limit to use calling. Please upgrade your account tier.', 403);
                }
                if (metaCode === 190 || metaMsg.includes('token') || metaMsg.includes('OAuth')) {
                    throw new errorHandler_1.AppError('Access token expired. Please reconnect your WhatsApp account.', 401);
                }
                if (metaMsg.includes('not a valid phone number') || metaCode === 131026) {
                    throw new errorHandler_1.AppError(`Invalid phone number: ${to}. Use international format (e.g. 919876543210).`, 400);
                }
                // ✅ Generic Meta error — show actual message to help debug
                throw new errorHandler_1.AppError(metaMsg || 'Failed to initiate call. Check if WhatsApp Calling is enabled for your account.', 400);
            }
            // Save call log to DB (non-blocking, CallLog table may not exist yet)
            database_1.default.callLog?.create({
                data: {
                    organizationId,
                    whatsappAccountId: account.id,
                    contactId: contactId || null,
                    conversationId: conversationId || null,
                    callId: callResult.messageId,
                    direction: 'OUTBOUND',
                    status: callResult.status,
                    to: to.replace(/[^0-9]/g, ''),
                    from: account.phoneNumber,
                    startedAt: new Date(),
                    initiatedBy: userId,
                },
            })?.catch((e) => console.warn('Call log save failed:', e.message));
            return res.json({
                success: true,
                message: 'Call initiated successfully',
                data: callResult,
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ✅ Get call logs
    async getCallLogs(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization required', 400);
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const contactId = req.query.contactId;
            const direction = req.query.direction;
            const where = { organizationId };
            if (contactId)
                where.contactId = contactId;
            if (direction)
                where.direction = direction.toUpperCase();
            // Try DB first (CallLog table may not exist yet — fail gracefully)
            let logs = [];
            let total = 0;
            try {
                if (!database_1.default.callLog) {
                    // Table not yet in Prisma schema — skip silently
                    console.warn('[Calling] callLog model not available in Prisma client. Run migration to enable.');
                }
                else {
                    [logs, total] = await Promise.all([
                        database_1.default.callLog.findMany({
                            where,
                            include: {
                                contact: {
                                    select: {
                                        id: true,
                                        phone: true,
                                        firstName: true,
                                        lastName: true,
                                    },
                                },
                            },
                            orderBy: { startedAt: 'desc' },
                            skip: (page - 1) * limit,
                            take: limit,
                        }),
                        database_1.default.callLog.count({ where }),
                    ]);
                }
            }
            catch (dbErr) {
                // CallLog table not yet available or query error
                console.warn('[Calling] CallLog query failed (table may not exist yet):', dbErr.message);
                logs = [];
                total = 0;
            }
            return res.json({
                success: true,
                data: logs,
                meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.callingController = new CallingController();
//# sourceMappingURL=calling.controller.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.templatesService = exports.TemplatesService = void 0;
const axios_1 = __importDefault(require("axios"));
const database_1 = __importDefault(require("../../config/database"));
const errorHandler_1 = require("../../middleware/errorHandler");
const whatsapp_api_1 = require("../whatsapp/whatsapp.api");
const meta_service_1 = require("../meta/meta.service");
const meta_api_1 = require("../meta/meta.api");
const encryption_1 = require("../../utils/encryption");
// ============================================
// HELPERS
// ============================================
const formatTemplate = (template) => ({
    id: template.id,
    name: template.name,
    language: template.language,
    category: template.category,
    headerType: template.headerType,
    headerContent: template.headerContent, // ✅ This should have Cloudinary URL
    headerMediaId: template.headerMediaId, // ✅ This has Meta handle
    bodyText: template.bodyText,
    footerText: template.footerText,
    buttons: template.buttons || [],
    variables: template.variables || [],
    status: template.status,
    metaTemplateId: template.metaTemplateId,
    rejectionReason: template.rejectionReason,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    whatsappAccount: undefined,
    wabaId: template.wabaId || null,
    whatsappAccountId: template.whatsappAccountId || null,
});
/**
 * ✅ FIXED: Upload media to Meta with proper MIME detection
 */
const uploadMediaToMeta = async (cloudinaryUrl, headerType, waData) => {
    try {
        console.log('📤 Uploading media to Meta:', { cloudinaryUrl, headerType });
        // ============================================
        // ✅ STEP 1: URL se MIME type pre-detect karo
        // ============================================
        const detectMimeFromUrl = (url, type) => {
            const urlLower = url.toLowerCase();
            const urlPath = url.split('?')[0]; // Query params remove karo
            // 1. Cloudinary format parameter check: /upload/f_jpg/ ya /upload/q_auto,f_png/
            const fParamMatch = urlLower.match(/[,\/]f_([a-z0-9]+)/);
            if (fParamMatch) {
                const fmtMap = {
                    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
                    'png': 'image/png', 'webp': 'image/webp',
                    'gif': 'image/gif', 'mp4': 'video/mp4',
                    'pdf': 'application/pdf',
                };
                if (fmtMap[fParamMatch[1]]) {
                    console.log(`✅ MIME from Cloudinary f_ param: ${fmtMap[fParamMatch[1]]}`);
                    return fmtMap[fParamMatch[1]];
                }
            }
            // 2. URL extension check (.jpg, .png, .mp4 etc)
            const extMatch = urlPath.match(/\.([a-z0-9]+)$/i);
            if (extMatch) {
                const extMap = {
                    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
                    'png': 'image/png', 'webp': 'image/webp',
                    'gif': 'image/gif', 'mp4': 'video/mp4',
                    '3gp': 'video/3gpp', '3gpp': 'video/3gpp',
                    'pdf': 'application/pdf',
                    'doc': 'application/msword',
                    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'xls': 'application/vnd.ms-excel',
                    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'ppt': 'application/vnd.ms-powerpoint',
                    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    'txt': 'text/plain',
                    'ogg': 'audio/ogg', 'mp3': 'audio/mpeg',
                    'aac': 'audio/aac', 'amr': 'audio/amr',
                };
                if (extMap[extMatch[1].toLowerCase()]) {
                    console.log(`✅ MIME from URL extension .${extMatch[1]}: ${extMap[extMatch[1].toLowerCase()]}`);
                    return extMap[extMatch[1].toLowerCase()];
                }
            }
            // 3. Cloudinary resource type from URL path
            // e.g. /image/upload/ → image, /video/upload/ → video, /raw/upload/ → document
            if (urlLower.includes('/image/upload/')) {
                console.log(`✅ MIME from Cloudinary /image/upload/ path: image/jpeg`);
                return 'image/jpeg';
            }
            if (urlLower.includes('/video/upload/')) {
                console.log(`✅ MIME from Cloudinary /video/upload/ path: video/mp4`);
                return 'video/mp4';
            }
            if (urlLower.includes('/raw/upload/')) {
                console.log(`✅ MIME from Cloudinary /raw/upload/ path (document): application/pdf`);
                return 'application/pdf';
            }
            // 4. headerType se default MIME
            const typeDefaults = {
                'IMAGE': 'image/jpeg',
                'VIDEO': 'video/mp4',
                'DOCUMENT': 'application/pdf',
                'AUDIO': 'audio/mpeg',
            };
            const defaultMime = typeDefaults[type.toUpperCase()] || 'image/jpeg';
            console.log(`⚠️ MIME defaulting to: ${defaultMime} (headerType: ${type})`);
            return defaultMime;
        };
        // ============================================
        // ✅ STEP 2: Filename detect karo
        // ============================================
        const detectFilename = (url, mimeType) => {
            const urlPath = url.split('?')[0];
            const lastSegment = urlPath.split('/').pop() || 'media';
            // Already has valid extension?
            if (/\.[a-z0-9]{2,5}$/i.test(lastSegment)) {
                return lastSegment;
            }
            // Add extension based on mimeType
            const mimeToExt = {
                'image/jpeg': '.jpg',
                'image/png': '.png',
                'image/webp': '.webp',
                'image/gif': '.gif',
                'video/mp4': '.mp4',
                'video/3gpp': '.3gp',
                'application/pdf': '.pdf',
                'application/msword': '.doc',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
                'application/vnd.ms-excel': '.xls',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
                'audio/mpeg': '.mp3',
                'audio/aac': '.aac',
                'audio/ogg': '.ogg',
                'audio/amr': '.amr',
            };
            const ext = mimeToExt[mimeType] || '.jpg';
            return `${lastSegment}${ext}`;
        };
        // ============================================
        // ✅ STEP 3: Pre-detect karo DOWNLOAD se pehle
        // ============================================
        const preMime = detectMimeFromUrl(cloudinaryUrl, headerType);
        const preFilename = detectFilename(cloudinaryUrl, preMime);
        console.log('🔍 Pre-detected:', { mimeType: preMime, filename: preFilename });
        // ============================================
        // ✅ STEP 4: Download from Cloudinary
        // ============================================
        const response = await axios_1.default.get(cloudinaryUrl, {
            responseType: 'arraybuffer',
            timeout: 60000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; WabMeta/1.0)',
                'Accept': '*/*'
            }
        });
        const buffer = Buffer.from(response.data);
        // ============================================
        // ✅ STEP 5: Response Content-Type validate karo
        // Response se sirf valid MIME lo, octet-stream ignore karo
        // ============================================
        const INVALID_MIME_TYPES = [
            'application/octet-stream',
            'binary/octet-stream',
            'application/binary',
            'application/unknown',
        ];
        const META_ACCEPTED_MIMES = [
            'image/jpeg', 'image/png', 'image/webp', 'image/gif',
            'video/mp4', 'video/3gpp',
            'audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr',
            'audio/ogg', 'audio/opus',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/vnd.ms-powerpoint',
            'text/plain',
        ];
        const rawContentType = (response.headers['content-type'] || '').split(';')[0].trim();
        const isValidResponseMime = rawContentType &&
            !INVALID_MIME_TYPES.includes(rawContentType) &&
            META_ACCEPTED_MIMES.includes(rawContentType);
        // Final MIME: valid response header > pre-detected
        const finalMime = isValidResponseMime ? rawContentType : preMime;
        const finalFilename = detectFilename(cloudinaryUrl, finalMime);
        console.log('📥 Downloaded:', {
            size: buffer.length,
            rawContentType,
            isValidResponseMime,
            finalMime, // ← Ye Meta ko jayega
            finalFilename,
        });
        // ============================================
        // ✅ STEP 6: Upload to Meta
        // ============================================
        console.log('📤 Uploading to Meta:', {
            size: buffer.length,
            mimeType: finalMime,
            filename: finalFilename
        });
        const result = await meta_api_1.metaApi.uploadMedia(waData.phoneNumberId, waData.accessToken, buffer, finalMime, // ✅ Correct MIME - never octet-stream
        finalFilename, // ✅ Correct filename with extension
        waData.wabaId);
        console.log('✅ Meta upload successful:', result.id);
        return result.id;
    }
    catch (error) {
        console.error('❌ Meta upload failed:', error.message);
        throw new errorHandler_1.AppError(`Failed to upload ${headerType.toLowerCase()} to WhatsApp: ` +
            `${error.response?.data?.error?.message || error.message}`, 400);
    }
};
const extractVariables = (text) => {
    const regex = /\{\{(\d+)\}\}/g;
    const variables = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        variables.push(parseInt(match[1], 10));
    }
    return [...new Set(variables)].sort((a, b) => a - b);
};
const replaceVariables = (text, values) => {
    return text.replace(/\{\{(\d+)\}\}/g, (match, index) => values[index] || match);
};
const toJsonValue = (value) => JSON.parse(JSON.stringify(value));
/**
 * ✅ IMPROVED: Keep language as-is, no forced conversion
 * Meta accepts both formats: "en", "en_US", "hi", "hi_IN"
 */
const toMetaLanguage = (lang) => {
    const l = String(lang || '').trim();
    if (!l)
        return 'en_US';
    // If it's already a valid-looking Meta language code (e.g., 'en', 'en_US', 'hi'), use it directly
    if (l.length >= 2 && l.length <= 6 && !l.includes(' ')) {
        return l;
    }
    const mapping = {
        'english': 'en_US',
        'hindi': 'hi',
        'spanish': 'es_ES',
        'portuguese': 'pt_BR',
        'french': 'fr_FR',
        'german': 'de_DE',
        'italian': 'it_IT',
    };
    const lower = l.toLowerCase();
    if (mapping[lower])
        return mapping[lower];
    return l;
};
/**
 * Normalizes template name to Meta's strict requirements
 */
const normalizeTemplateName = (name) => {
    return name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, ''); // Trim leading/trailing underscores
};
const normalizeHeaderType = (t) => {
    const headerType = String(t || 'NONE').toUpperCase();
    return ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) ? headerType : 'NONE';
};
const buildMetaTemplatePayload = (t) => {
    const components = [];
    const headerType = normalizeHeaderType(t.headerType);
    console.log('🔧 Building Meta template payload:', {
        name: t.name,
        language: t.language,
        headerType,
        hasMediaUrl: !!(t.headerMediaId || t.headerContent),
    });
    // ============================================
    // HEADER COMPONENT
    // ============================================
    if (headerType && headerType !== 'NONE') {
        // TEXT Header
        if (headerType === 'TEXT' && t.headerContent) {
            const headerVars = extractVariables(t.headerContent);
            const headerComp = {
                type: 'HEADER',
                format: 'TEXT',
                text: t.headerContent,
            };
            if (headerVars.length > 0) {
                const samples = headerVars.map(idx => {
                    const v = t.variables?.find(var_item => var_item.index === idx);
                    return v?.example || `Example${idx}`;
                });
                headerComp.example = {
                    header_text: samples,
                };
            }
            components.push(headerComp);
            console.log('✅ TEXT header added');
        }
        // ✅ FIXED: MEDIA Headers (IMAGE, VIDEO, DOCUMENT)
        else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
            // ✅ Template CREATION ke liye priority:
            // 1. headerMediaId (handle "4:V2hh..." ya numeric) → header_handle
            // 2. headerContent (Cloudinary URL) → header_handle (Meta bhi accept karta hai URLs)
            const mediaForCreation = t.headerMediaId || t.headerContent;
            if (!mediaForCreation) {
                throw new errorHandler_1.AppError(`${headerType} template requires uploaded media. Please upload a file first.`, 400);
            }
            const headerComp = {
                type: 'HEADER',
                format: headerType,
                example: {
                    header_handle: [mediaForCreation], // Meta accepts both handles and URLs
                }
            };
            components.push(headerComp);
            console.log(`✅ ${headerType} header with: ${mediaForCreation.substring(0, 40)}...`);
        }
    }
    // ============================================
    // BODY COMPONENT (unchanged)
    // ============================================
    const bodyVars = extractVariables(t.bodyText);
    const bodyComp = { type: 'BODY', text: t.bodyText };
    if (bodyVars.length > 0) {
        const samples = bodyVars.map(idx => {
            const v = t.variables?.find(var_item => var_item.index === idx);
            return v?.example || `Sample${idx}`;
        });
        bodyComp.example = {
            body_text: [samples],
        };
    }
    components.push(bodyComp);
    // ============================================
    // FOOTER COMPONENT (unchanged)
    // ============================================
    if (t.footerText) {
        components.push({ type: 'FOOTER', text: t.footerText });
    }
    // ============================================
    // BUTTONS COMPONENT - FIXED
    // ============================================
    if (t.buttons && t.buttons.length > 0) {
        const validButtons = t.buttons.filter((b) => b.text?.trim());
        if (validButtons.length > 0) {
            const buttons = validButtons.slice(0, 10).map((b) => {
                // ✅ Normalize type - handle all possible formats
                const rawType = String(b.type || '').toUpperCase()
                    .replace(/[^A-Z_]/g, '');
                let metaType;
                if (rawType.includes('PHONE') || rawType === 'CALL') {
                    metaType = 'PHONE_NUMBER';
                }
                else if (rawType === 'URL' || rawType.includes('URL') || rawType === 'WEBSITE') {
                    metaType = 'URL';
                }
                else {
                    metaType = 'QUICK_REPLY';
                }
                // ✅ Base button
                const btn = {
                    type: metaType,
                    text: String(b.text || '').trim().substring(0, 25), // Max 25 chars
                };
                // ✅ URL button
                if (metaType === 'URL') {
                    const url = b.url || b.website_url || '';
                    if (!url || !url.startsWith('http')) {
                        throw new errorHandler_1.AppError(`URL button "${btn.text}" requires a valid URL starting with http/https`, 400);
                    }
                    btn.url = url.trim();
                }
                // ✅ Phone button - Meta requires 'phone_number' (underscore format)
                if (metaType === 'PHONE_NUMBER') {
                    // Handle both 'phoneNumber' (camelCase) and 'phone_number' (snake_case)
                    const phone = b.phoneNumber || b.phone_number || '';
                    if (!phone) {
                        throw new errorHandler_1.AppError(`Phone button "${btn.text}" requires a phone number`, 400);
                    }
                    // Validate E.164 format
                    const cleanPhone = String(phone).trim();
                    if (!cleanPhone.startsWith('+')) {
                        throw new errorHandler_1.AppError(`Phone number must be in E.164 format (e.g., +919876543210). Got: ${cleanPhone}`, 400);
                    }
                    btn.phone_number = cleanPhone; // ✅ Meta expects 'phone_number' NOT 'phoneNumber'
                }
                // ✅ Quick Reply - no extra fields needed
                // Just type and text
                console.log(`  ✅ Button mapped: ${metaType} - "${btn.text}"`, metaType === 'URL' ? `→ ${btn.url}` :
                    metaType === 'PHONE_NUMBER' ? `→ ${btn.phone_number}` : '');
                return btn;
            });
            components.push({
                type: 'BUTTONS',
                buttons
            });
            console.log(`✅ BUTTONS component: ${buttons.length} buttons added`);
        }
    }
    const payload = {
        name: t.name,
        language: toMetaLanguage(t.language),
        category: String(t.category || 'UTILITY').toUpperCase(),
        components,
    };
    console.log('📦 Final Meta payload:', JSON.stringify(payload, null, 2));
    return payload;
};
// ✅ Buttons normalize karo before saving to DB
const normalizeButtonsForDB = (buttons) => {
    return (buttons || []).map((b) => ({
        type: b.type, // 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'
        text: b.text || '',
        // ✅ Unified format - ALWAYS save both fields
        url: b.url || b.website_url || undefined,
        phoneNumber: b.phone_number || b.phoneNumber || undefined, // camelCase save karo
    }));
};
/**
 * ✅ FIXED: Get WhatsApp Account with robust retry logic
 */
const getWhatsAppAccountWithToken = async (organizationId, whatsappAccountId) => {
    const MAX_RETRIES = 5;
    const RETRY_DELAYS = [500, 1000, 2000, 3000, 5000]; // Progressive delays
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            console.log(`🔍 [Attempt ${attempt + 1}/${MAX_RETRIES}] Getting WhatsApp account:`, {
                organizationId,
                whatsappAccountId: whatsappAccountId || 'auto-detect',
            });
            // ============================================
            // METHOD 1: Try WhatsAppAccount table
            // ============================================
            let waAccount = null;
            if (whatsappAccountId) {
                // ✅ Direct ID lookup (most reliable)
                waAccount = await database_1.default.whatsAppAccount.findFirst({
                    where: {
                        id: whatsappAccountId,
                        organizationId,
                    },
                });
                console.log(`   Direct lookup by ID:`, waAccount ? '✅ Found' : '❌ Not found');
            }
            // ✅ Fallback: Find ANY connected account for this org
            if (!waAccount) {
                waAccount = await database_1.default.whatsAppAccount.findFirst({
                    where: {
                        organizationId,
                        status: 'CONNECTED',
                    },
                    orderBy: [
                        { isDefault: 'desc' },
                        { createdAt: 'desc' },
                    ],
                });
                console.log(`   Fallback connected lookup:`, waAccount ? '✅ Found' : '❌ Not found');
            }
            // ✅ Last resort: Find ANY account for this org (even pending)
            if (!waAccount) {
                waAccount = await database_1.default.whatsAppAccount.findFirst({
                    where: {
                        organizationId,
                    },
                    orderBy: [
                        { status: 'asc' }, // CONNECTED is 'C', DISCONNECTED is 'D', PENDING is 'P'. Sort by status might be tricky.
                        { createdAt: 'desc' },
                    ],
                });
                console.log(`   Last resort lookup:`, waAccount ? `✅ Found (status: ${waAccount.status})` : '❌ Not found');
            }
            // ============================================
            // METHOD 2: Try MetaConnection table (new structure)
            // ============================================
            if (!waAccount) {
                console.log('📋 Trying MetaConnection table...');
                try {
                    const metaConnection = await database_1.default.metaConnection.findUnique({
                        where: { organizationId },
                        include: {
                            phoneNumbers: {
                                where: { isActive: true },
                                orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
                            },
                        },
                    });
                    if (metaConnection && metaConnection.phoneNumbers?.length > 0) {
                        const primaryPhone = metaConnection.phoneNumbers[0];
                        console.log('✅ Found via MetaConnection:', {
                            wabaId: metaConnection.wabaId,
                            phone: primaryPhone.phoneNumber,
                        });
                        // Decrypt token
                        const decryptedToken = (0, encryption_1.safeDecryptStrict)(metaConnection.accessToken);
                        if (!decryptedToken) {
                            throw new errorHandler_1.AppError('Failed to decrypt MetaConnection token', 500);
                        }
                        return {
                            account: {
                                id: primaryPhone.id,
                                phoneNumberId: primaryPhone.phoneNumberId,
                                wabaId: metaConnection.wabaId,
                                phoneNumber: primaryPhone.phoneNumber,
                                accessToken: decryptedToken,
                                status: metaConnection.status,
                            },
                            accessToken: decryptedToken,
                            wabaId: metaConnection.wabaId,
                            phoneNumberId: primaryPhone.phoneNumberId,
                        };
                    }
                }
                catch (metaError) {
                    console.log('⚠️ MetaConnection not available:', metaError.message);
                }
            }
            // ============================================
            // Account Found - Validate & Return
            // ============================================
            if (waAccount) {
                console.log('✅ WhatsApp account found:', {
                    id: waAccount.id,
                    phone: waAccount.phoneNumber,
                    status: waAccount.status,
                    wabaId: waAccount.wabaId,
                });
                // Check if account has required fields
                if (!waAccount.wabaId) {
                    throw new errorHandler_1.AppError('WhatsApp Business Account ID missing. Please reconnect in Settings → WhatsApp.', 400);
                }
                if (!waAccount.accessToken) {
                    throw new errorHandler_1.AppError('WhatsApp access token missing. Please reconnect in Settings → WhatsApp.', 400);
                }
                // Get decrypted token
                const accountWithToken = await meta_service_1.metaService.getAccountWithToken(waAccount.id);
                if (!accountWithToken) {
                    throw new errorHandler_1.AppError('Failed to decrypt token. Please reconnect in Settings → WhatsApp.', 400);
                }
                return {
                    account: {
                        id: waAccount.id,
                        phoneNumberId: waAccount.phoneNumberId,
                        wabaId: waAccount.wabaId,
                        phoneNumber: waAccount.phoneNumber,
                        accessToken: accountWithToken.accessToken,
                        status: waAccount.status,
                        isDefault: waAccount.isDefault,
                    },
                    accessToken: accountWithToken.accessToken,
                    wabaId: waAccount.wabaId,
                    phoneNumberId: waAccount.phoneNumberId,
                };
            }
            // ============================================
            // Account Not Found - Retry or Throw
            // ============================================
            if (attempt < MAX_RETRIES - 1) {
                const delay = RETRY_DELAYS[attempt];
                console.log(`⏳ Account not found, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            // All retries exhausted
            throw new errorHandler_1.AppError('No WhatsApp account found. Please connect your WhatsApp Business account in Settings → WhatsApp.', 400);
        }
        catch (error) {
            // If it's a retryable error and we have retries left
            if (attempt < MAX_RETRIES - 1 &&
                (error.message.includes('not found') || error.message.includes('No WhatsApp'))) {
                const delay = RETRY_DELAYS[attempt];
                console.log(`⏳ Error: ${error.message}, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            // Non-retryable or retries exhausted
            console.error('❌ getWhatsAppAccountWithToken failed:', error);
            throw error;
        }
    }
    // Should never reach here, but TypeScript requires it
    throw new errorHandler_1.AppError('No WhatsApp account found after all retries.', 400);
};
// ============================================
// SERVICE CLASS
// ============================================
class TemplatesService {
    /**
     * Validate template before creation/update
     */
    validateTemplate(input) {
        const errors = [];
        // Name validation
        if (!/^[a-z0-9_]+$/.test(input.name)) {
            errors.push('Template name must be lowercase with underscores only (a-z, 0-9, _)');
        }
        if (input.name.length < 1 || input.name.length > 512) {
            errors.push('Template name must be between 1 and 512 characters');
        }
        // Body validation
        if (!input.bodyText || input.bodyText.trim().length === 0) {
            errors.push('Body text is required');
        }
        if (input.bodyText && input.bodyText.length > 1024) {
            errors.push('Body text exceeds 1024 characters');
        }
        // Header validation
        const headerType = normalizeHeaderType(input.headerType);
        if (headerType === 'TEXT' && input.headerContent) {
            if (input.headerContent.length > 60) {
                errors.push('Header text exceeds 60 characters');
            }
        }
        // Footer validation
        if (input.footerText && input.footerText.length > 60) {
            errors.push('Footer text exceeds 60 characters');
        }
        // Buttons validation
        if (input.buttons && input.buttons.length > 3) {
            errors.push('Maximum 3 buttons allowed');
        }
        // Variables validation
        const varsInBody = extractVariables(input.bodyText);
        for (let i = 0; i < varsInBody.length; i++) {
            if (varsInBody[i] !== i + 1) {
                errors.push(`Variables must be sequential starting from {{1}}. Found gap at {{${i + 1}}}`);
                break;
            }
        }
        return { valid: errors.length === 0, errors };
    }
    /**
     * ✅ NEW: Helper to extract smuggled URL from mediaId
     */
    extractSmuggledMedia(mediaId, existingContent) {
        const isScontent = (url) => !!url && url.includes('scontent.whatsapp');
        const isExpiredHandle = (id) => !!id && id.startsWith('4:');
        // ✅ CASE 1: Clean format (new upload - no smuggling)
        if (mediaId && !mediaId.includes(':::')) {
            return {
                mediaId: mediaId,
                content: isScontent(existingContent)
                    ? null
                    : existingContent || null,
            };
        }
        // ✅ CASE 2: Legacy smuggled format "handle:::url"
        if (mediaId?.includes(':::')) {
            const parts = mediaId.split(':::');
            const rawHandle = parts[0] || null;
            const smuggledUrl = parts[1] || null;
            // Clean URL prefer karo
            const content = (smuggledUrl && !isScontent(smuggledUrl) ? smuggledUrl : null) ||
                (existingContent && !isScontent(existingContent) ? existingContent : null);
            return { mediaId: rawHandle, content };
        }
        // ✅ CASE 3: No mediaId
        return {
            mediaId: null,
            content: isScontent(existingContent) ? null : existingContent || null,
        };
    }
    /**
     * Create new template
     */
    async create(organizationId, input) {
        const headerType = normalizeHeaderType(input.headerType);
        // ✅ Resolve best media fields
        let finalMetaId = null;
        let finalCloudinaryUrl = null;
        if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
            // === Permanent URL resolve karo ===
            // Priority: cloudinaryUrl > permanentUrl > smuggled URL > headerContent
            finalCloudinaryUrl =
                input.cloudinaryUrl ||
                    input.permanentUrl ||
                    (() => {
                        // Legacy: extract from smuggled format
                        if (input.headerMediaId?.includes(':::')) {
                            const url = input.headerMediaId.split(':::')[1];
                            return url && url.startsWith('http') && !url.includes('scontent')
                                ? url
                                : null;
                        }
                        return null;
                    })() ||
                    (input.headerContent?.startsWith('http') &&
                        !input.headerContent.includes('scontent')
                        ? input.headerContent
                        : null) ||
                    null;
            // === Meta ID resolve karo ===
            // Priority: metaNumericId > numeric from headerMediaId > handle
            finalMetaId =
                (input.metaNumericId || null) ||
                    (() => {
                        const rawId = input.headerMediaId?.split(':::')[0];
                        // Numeric ID = permanent (best choice)
                        if (rawId && /^\d+$/.test(rawId))
                            return rawId;
                        return null;
                    })() ||
                    // Handle (4:xxx) = template creation ke liye ok
                    input.headerMediaId?.split(':::')[0] ||
                    null;
            console.log('✅ [Create] Media fields resolved:', {
                finalMetaId: finalMetaId
                    ? (finalMetaId.length > 20
                        ? finalMetaId.substring(0, 20) + '...'
                        : finalMetaId)
                    : 'none',
                finalCloudinaryUrl: finalCloudinaryUrl
                    ? finalCloudinaryUrl.substring(0, 60)
                    : 'none',
                hasNumericId: finalMetaId ? /^\d+$/.test(finalMetaId) : false,
            });
        }
        // Text header content
        const mediaHeaderContent = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)
            ? finalCloudinaryUrl // ✅ Permanent URL DB me store hoga
            : input.headerContent || null;
        // Validate template
        const validation = this.validateTemplate(input);
        if (!validation.valid) {
            throw new errorHandler_1.AppError(`Validation failed: ${validation.errors.join(', ')}`, 400);
        }
        // Check for WhatsApp account first
        let waData = null;
        let canSyncToMeta = false;
        try {
            waData = await getWhatsAppAccountWithToken(organizationId, input.whatsappAccountId);
            canSyncToMeta = true;
        }
        catch (err) {
            canSyncToMeta = false;
        }
        // Check for duplicates
        const existing = await database_1.default.template.findFirst({
            where: {
                organizationId,
                name: input.name,
                language: input.language,
            },
        });
        if (existing) {
            throw new errorHandler_1.AppError('Template with this name and language already exists', 409);
        }
        // Extract variables
        const extractedVars = extractVariables(input.bodyText);
        const finalVariables = input.variables && input.variables.length > 0
            ? input.variables
            : extractedVars.map((index) => ({ index, type: 'text' }));
        // Create template data
        const templateData = {
            organizationId,
            name: normalizeTemplateName(input.name),
            language: input.language,
            category: input.category,
            headerType: input.headerType || null,
            // ✅ CRITICAL: DB mein SIRF Cloudinary URL save karo
            headerContent: mediaHeaderContent, // = finalCloudinaryUrl (PERMANENT)
            // ✅ headerMediaId: null save karo! Handle expire ho jaata hai
            // Sirf numeric ID save karo agar available ho
            headerMediaId: (() => {
                if (!finalMetaId)
                    return null;
                // Pure numeric = permanent, save karo
                if (/^\d{10,}$/.test(finalMetaId))
                    return finalMetaId;
                // "4:V2hh..." handle = EXPIRE HOGA, null save karo
                return null;
            })(),
            // ✅ NEW: If numeric ID, set timestamp
            headerMediaUploadedAt: (() => {
                if (!finalMetaId)
                    return null;
                if (/^\d{10,}$/.test(finalMetaId))
                    return new Date();
                return null;
            })(),
            headerMediaLastVerified: null,
            bodyText: input.bodyText,
            footerText: input.footerText || null,
            buttons: toJsonValue(input.buttons || []),
            variables: toJsonValue(finalVariables),
            status: canSyncToMeta ? 'PENDING' : 'DRAFT',
            metaTemplateId: null,
            rejectionReason: null,
        };
        // Store wabaId and whatsappAccountId if available
        if (waData) {
            if (waData.wabaId) {
                templateData.wabaId = waData.wabaId;
            }
            if (waData.account?.id) {
                templateData.whatsappAccountId = waData.account.id;
            }
        }
        // Create template in database
        const template = await database_1.default.template.create({
            data: templateData,
        });
        console.log(`✅ Template created: ${template.id} (status: ${template.status})`);
        // ✅ Submit to Meta if account is available
        if (canSyncToMeta && waData) {
            try {
                const metaHeaderMediaId = (() => {
                    if (!finalMetaId)
                        return null;
                    // Pure numeric = OK for template creation
                    if (/^\d+$/.test(finalMetaId))
                        return finalMetaId;
                    // Handle "4:xxx" = OK for CREATION only (header_handle field)
                    if (/^\d+:[A-Za-z0-9+/=:_-]+$/.test(finalMetaId))
                        return finalMetaId;
                    return null;
                })();
                const metaPayload = buildMetaTemplatePayload({
                    name: normalizeTemplateName(input.name),
                    language: input.language,
                    category: input.category,
                    headerType: input.headerType || null,
                    headerContent: finalCloudinaryUrl || input.headerContent || null,
                    headerMediaId: metaHeaderMediaId,
                    bodyText: input.bodyText,
                    footerText: input.footerText || null,
                    buttons: (input.buttons || []),
                    variables: finalVariables,
                });
                console.log('📤 Submitting template to Meta WABA:', waData.wabaId);
                console.log('📝 Template language:', toMetaLanguage(input.language));
                console.log('📦 Meta Payload:', JSON.stringify(metaPayload, null, 2));
                const metaRes = await whatsapp_api_1.whatsappApi.createMessageTemplateByVersion(waData.wabaId, waData.accessToken, metaPayload, 'v21.0');
                const metaTemplateId = metaRes?.id || metaRes?.template_id;
                if (metaTemplateId) {
                    await database_1.default.template.update({
                        where: { id: template.id },
                        data: {
                            metaTemplateId: String(metaTemplateId),
                            status: 'PENDING',
                        },
                    });
                    console.log('✅ Meta template created:', metaTemplateId);
                }
            }
            catch (e) {
                const metaErr = e.metaError || e.response?.data?.error;
                const msg = String(metaErr?.message || e?.message || 'Meta submission failed');
                console.error('❌ Meta template create failed:', {
                    code: metaErr?.code,
                    message: metaErr?.message,
                    error_subcode: metaErr?.error_subcode,
                    error_data: metaErr?.error_data,
                    templateName: input.name,
                    language: toMetaLanguage(input.language),
                    message_raw: e.message
                });
                await database_1.default.template.update({
                    where: { id: template.id },
                    data: {
                        status: 'REJECTED',
                        rejectionReason: msg,
                    },
                });
            }
        }
        // Fetch latest template state
        const latest = await database_1.default.template.findUnique({
            where: { id: template.id },
        });
        return formatTemplate(latest);
    }
    /**
     * Get list of templates with filtering
     */
    async getList(organizationId, query) {
        const { page = 1, limit = 20, search, status, category, language, sortBy = 'createdAt', sortOrder = 'desc', whatsappAccountId, wabaId, } = query;
        const skip = (page - 1) * limit;
        const where = { organizationId };
        if (search && search.trim()) {
            where.OR = [
                { name: { contains: search.trim(), mode: 'insensitive' } },
                { bodyText: { contains: search.trim(), mode: 'insensitive' } },
            ];
        }
        if (status)
            where.status = status;
        if (category)
            where.category = category;
        if (language)
            where.language = language;
        // Filter by whatsappAccountId or wabaId
        if (whatsappAccountId) {
            where.whatsappAccountId = whatsappAccountId;
        }
        if (wabaId) {
            where.wabaId = wabaId;
        }
        const [templates, total] = await Promise.all([
            database_1.default.template.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [sortBy]: sortOrder },
            }),
            database_1.default.template.count({ where }),
        ]);
        console.log(`📋 Found ${templates.length} templates (total: ${total})`);
        return {
            templates: templates.map(formatTemplate),
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    /**
     * Get approved templates only
     */
    async getApprovedTemplates(organizationId, whatsappAccountId, wabaId) {
        const where = {
            organizationId,
            status: 'APPROVED',
        };
        if (wabaId) {
            where.wabaId = wabaId;
        }
        else if (whatsappAccountId) {
            where.whatsappAccountId = whatsappAccountId;
        }
        const templates = await database_1.default.template.findMany({
            where,
            orderBy: { name: 'asc' },
        });
        console.log(`📋 Found ${templates.length} approved templates`);
        return templates.map(formatTemplate);
    }
    /**
     * Sync templates from Meta
     */
    async syncFromMeta(organizationId, whatsappAccountId) {
        console.log('🔄 Syncing templates from Meta...');
        const waData = await getWhatsAppAccountWithToken(organizationId, whatsappAccountId);
        const metaTemplates = await whatsapp_api_1.whatsappApi.listMessageTemplates(waData.wabaId, waData.accessToken);
        console.log(`📥 Found ${metaTemplates.length} templates in Meta`);
        // ✅ Track found names to handle deletions
        const foundMetaKeys = new Set();
        let synced = 0;
        for (const mt of metaTemplates) {
            try {
                const metaId = String(mt.id);
                const metaName = String(mt.name);
                const metaLang = String(mt.language);
                // Track this key (name:lang)
                foundMetaKeys.add(`${metaName}:${metaLang}`);
                const metaStatusRaw = String(mt.status || 'PENDING').toUpperCase();
                const mappedStatus = metaStatusRaw === 'APPROVED'
                    ? 'APPROVED'
                    : metaStatusRaw === 'REJECTED'
                        ? 'REJECTED'
                        : 'PENDING';
                const rejectionReason = mt.rejected_reason || mt.rejection_reason || null;
                const bodyComponent = mt.components?.find((c) => c.type === 'BODY');
                const headerComponent = mt.components?.find((c) => c.type === 'HEADER');
                const footerComponent = mt.components?.find((c) => c.type === 'FOOTER');
                const buttonsComponent = mt.components?.find((c) => c.type === 'BUTTONS');
                let headerContent = null;
                // Text header
                if (headerComponent?.text) {
                    headerContent = headerComponent.text;
                }
                // Media header - example se URL extract karo
                if (!headerContent && headerComponent?.example) {
                    const exampleHandles = headerComponent.example.header_handle || [];
                    const exampleTexts = headerComponent.example.header_text || [];
                    // URL prefer karo, handle skip karo
                    for (const handle of exampleHandles) {
                        if (handle && handle.startsWith('http') && !handle.includes('scontent')) {
                            headerContent = handle; // Valid CDN URL ✅
                            break;
                        }
                        // "4:xxx" handles skip karo - expire ho jaate hain
                    }
                    if (!headerContent && exampleTexts.length > 0) {
                        headerContent = exampleTexts[0];
                    }
                }
                const existing = await database_1.default.template.findFirst({
                    where: {
                        whatsappAccountId: waData.account?.id || waData.account?.id, // Use ID from waData
                        name: metaName,
                        language: metaLang,
                    },
                });
                // ✅ CRITICAL BUG FIX: Don't let Meta's expiring scontent CDN wipe out our permanent Cloudinary URL
                // NEVER save scontent URLs as permanent headerContent.
                const isScontent = (url) => !!url && url.includes('scontent.whatsapp');
                let finalHeaderContent = isScontent(headerContent) ? null : headerContent;
                // If we have an existing record with a good URL, ALWAYS keep it
                if (existing && existing.headerContent && !isScontent(existing.headerContent)) {
                    // If the incoming content is bad or missing, preserve the good one we have
                    if (!finalHeaderContent) {
                        finalHeaderContent = existing.headerContent;
                    }
                }
                if (existing) {
                    // Update existing
                    const updateData = {
                        organizationId, // ✅ CLAIM ownership (move with account)
                        metaTemplateId: metaId,
                        status: mappedStatus,
                        rejectionReason,
                        category: (String(mt.category || 'UTILITY').toUpperCase()),
                        headerType: headerComponent?.format || null,
                        headerContent: finalHeaderContent,
                        bodyText: bodyComponent?.text || existing.bodyText,
                        footerText: footerComponent?.text || existing.footerText,
                        buttons: toJsonValue(normalizeButtonsForDB(buttonsComponent?.buttons || []) // ✅ FIXED
                        ),
                    };
                    if (waData.wabaId)
                        updateData.wabaId = waData.wabaId;
                    if (waData.account?.id)
                        updateData.whatsappAccountId = waData.account.id;
                    await database_1.default.template.update({
                        where: { id: existing.id },
                        data: updateData,
                    });
                }
                else {
                    // Create new
                    const createData = {
                        organizationId,
                        name: metaName,
                        language: metaLang,
                        category: (String(mt.category || 'UTILITY').toUpperCase()),
                        bodyText: bodyComponent?.text || 'Imported from Meta',
                        headerType: headerComponent?.format || null,
                        headerContent: finalHeaderContent,
                        footerText: footerComponent?.text || null,
                        status: mappedStatus,
                        metaTemplateId: metaId,
                        buttons: toJsonValue(normalizeButtonsForDB(buttonsComponent?.buttons || []) // ✅ FIXED
                        ),
                        variables: toJsonValue([]),
                        rejectionReason,
                    };
                    if (waData.wabaId)
                        createData.wabaId = waData.wabaId;
                    if (waData.account?.id)
                        createData.whatsappAccountId = waData.account.id;
                    await database_1.default.template.create({ data: createData });
                }
                synced++;
            }
            catch (err) {
                console.error(`Failed to sync template ${mt.name}:`, err.message);
            }
        }
        // ✅ Handle Ghost Templates (Deleted in Meta)
        // Find templates in DB for this org/waba that were NOT in Meta's response
        const dbTemplates = await database_1.default.template.findMany({
            where: {
                organizationId,
                wabaId: waData.wabaId,
                status: { in: ['APPROVED', 'PENDING'] } // Only worry about active ones
            }
        });
        let cleaned = 0;
        for (const dt of dbTemplates) {
            if (!foundMetaKeys.has(`${dt.name}:${dt.language}`)) {
                console.log(`⚠️ Marking ghost template as REJECTED (Deleted in Meta): ${dt.name}`);
                await database_1.default.template.update({
                    where: { id: dt.id },
                    data: {
                        status: 'REJECTED',
                        rejectionReason: 'Template deleted from Meta Business Suite.'
                    }
                });
                cleaned++;
            }
        }
        console.log(`✅ Synced ${synced} templates. Cleaned ${cleaned} ghosts.`);
        return { message: `Sync complete. ${synced} synced, ${cleaned} cleaned.`, synced };
    }
    /**
     * Get template by ID
     */
    async getById(organizationId, templateId) {
        const template = await database_1.default.template.findFirst({
            where: { id: templateId, organizationId },
        });
        if (!template) {
            throw new errorHandler_1.AppError('Template not found', 404);
        }
        return formatTemplate(template);
    }
    /**
     * Update template
     */
    async update(organizationId, templateId, input) {
        const existing = await database_1.default.template.findFirst({
            where: { id: templateId, organizationId },
        });
        if (!existing) {
            throw new errorHandler_1.AppError('Template not found', 404);
        }
        // ✅ FIXED: Approved template mein sirf media update allow karo
        const isApproved = existing.status === 'APPROVED' && existing.metaTemplateId;
        if (isApproved) {
            // ✅ Check: Kya sirf media update ho raha hai?
            const isMediaOnlyUpdate = (input.headerMediaId || input.headerContent) &&
                !input.name &&
                !input.bodyText &&
                !input.language &&
                !input.category;
            if (!isMediaOnlyUpdate) {
                throw new errorHandler_1.AppError('Cannot modify approved templates content. ' +
                    'You can only re-upload media for expired handles.', 400);
            }
            // ✅ ALLOW: Sirf headerMediaId aur headerContent update karo
            console.log('🔄 Updating media for approved template:', templateId);
            const { mediaId: rawMediaId, content: extractedUrl } = this.extractSmuggledMedia(input.headerMediaId, input.headerContent);
            const updated = await database_1.default.template.update({
                where: { id: templateId },
                data: {
                    headerMediaId: rawMediaId || existing.headerMediaId,
                    headerContent: extractedUrl || existing.headerContent,
                    // ✅ Status APPROVED rahega - sirf media update hua
                },
            });
            console.log('✅ Media updated for approved template:', templateId);
            return formatTemplate(updated);
        }
        // ✅ Non-approved templates: Full update allow karo
        let finalVariables = input.variables;
        if (input.bodyText) {
            const extracted = extractVariables(input.bodyText);
            if (!finalVariables || finalVariables.length === 0) {
                finalVariables = extracted.map((index) => ({
                    index,
                    type: 'text'
                }));
            }
        }
        const { mediaId: rawMediaId, content: extractedUrl } = this.extractSmuggledMedia(input.headerMediaId, input.headerContent);
        const updateData = {
            name: input.name,
            language: input.language,
            category: input.category,
            headerType: input.headerType,
            headerContent: extractedUrl,
            headerMediaId: rawMediaId,
            bodyText: input.bodyText,
            footerText: input.footerText,
        };
        if (input.buttons !== undefined) {
            updateData.buttons = toJsonValue(input.buttons);
        }
        if (finalVariables !== undefined) {
            updateData.variables = toJsonValue(finalVariables);
        }
        if (input.bodyText || input.headerContent) {
            updateData.status = 'PENDING';
        }
        const updated = await database_1.default.template.update({
            where: { id: templateId },
            data: updateData,
        });
        console.log('✅ Template updated:', templateId);
        return formatTemplate(updated);
    }
    /**
     * Delete template
     */
    async delete(organizationId, templateId) {
        const template = await database_1.default.template.findFirst({
            where: { id: templateId, organizationId },
            include: { whatsappAccount: true },
        });
        if (!template) {
            throw new errorHandler_1.AppError('Template not found', 404);
        }
        // 1. Attempt to delete from Meta if synced
        if (template.metaTemplateId && template.whatsappAccount) {
            try {
                const waData = await getWhatsAppAccountWithToken(organizationId, template.whatsappAccountId || undefined);
                console.log(`📤 Deleting template "${template.name}" from Meta...`);
                await whatsapp_api_1.whatsappApi.deleteMessageTemplate(waData.wabaId, waData.accessToken, template.name);
                console.log('✅ Deleted from Meta');
            }
            catch (metaErr) {
                console.warn('⚠️ Failed to delete template from Meta:', metaErr.message);
                // We continue even if Meta delete fails (might already be deleted there)
            }
        }
        // 2. Handle DB relations
        // Nullify templateId in message history to preserve chat history but break link
        await database_1.default.message.updateMany({
            where: { templateId },
            data: { templateId: null },
        });
        // Delete message queue entries for this template
        await database_1.default.messageQueue.deleteMany({
            where: { templateId },
        });
        // Handle Campaigns - If we want to allow delete, we must handle campaigns.
        // We'll delete related campaigns too to ensure the delete succeeds.
        await database_1.default.campaign.deleteMany({
            where: { templateId },
        });
        // 3. Final Delete
        await database_1.default.template.delete({ where: { id: templateId } });
        console.log(`✅ Template completely deleted: ${templateId}`);
        return { message: 'Template deleted successfully' };
    }
    /**
     * Get template statistics
     */
    async getStats(organizationId, whatsappAccountId) {
        try {
            const where = { organizationId };
            if (whatsappAccountId) {
                where.whatsappAccountId = whatsappAccountId;
            }
            const [total, pending, approved, rejected, marketing, utility, authentication] = await Promise.all([
                database_1.default.template.count({ where }),
                database_1.default.template.count({ where: { ...where, status: 'PENDING' } }),
                database_1.default.template.count({ where: { ...where, status: 'APPROVED' } }),
                database_1.default.template.count({ where: { ...where, status: 'REJECTED' } }),
                database_1.default.template.count({ where: { ...where, category: 'MARKETING' } }),
                database_1.default.template.count({ where: { ...where, category: 'UTILITY' } }),
                database_1.default.template.count({ where: { ...where, category: 'AUTHENTICATION' } }),
            ]);
            return {
                total,
                pending,
                approved,
                rejected,
                byCategory: { marketing, utility, authentication },
            };
        }
        catch (error) {
            console.error('❌ Get template stats error:', error);
            return {
                total: 0,
                pending: 0,
                approved: 0,
                rejected: 0,
                byCategory: { marketing: 0, utility: 0, authentication: 0 },
            };
        }
    }
    /**
     * Duplicate template
     */
    async duplicate(organizationId, templateId, newName, targetWhatsappAccountId) {
        const original = await database_1.default.template.findFirst({
            where: { id: templateId, organizationId },
        });
        if (!original) {
            throw new errorHandler_1.AppError('Template not found', 404);
        }
        const dup = await database_1.default.template.findFirst({
            where: {
                organizationId,
                name: newName,
                language: original.language,
            },
        });
        if (dup) {
            throw new errorHandler_1.AppError('Template with this name already exists', 409);
        }
        const createData = {
            organizationId,
            name: newName,
            language: original.language,
            category: original.category,
            headerType: original.headerType,
            headerContent: original.headerContent,
            bodyText: original.bodyText,
            footerText: original.footerText,
            buttons: original.buttons || toJsonValue([]),
            variables: original.variables || toJsonValue([]),
            status: 'PENDING',
            metaTemplateId: null,
            rejectionReason: null,
        };
        if (original.wabaId)
            createData.wabaId = original.wabaId;
        if (original.whatsappAccountId)
            createData.whatsappAccountId = original.whatsappAccountId;
        const created = await database_1.default.template.create({ data: createData });
        console.log(`📋 Template duplicated: ${templateId} -> ${created.id}`);
        return formatTemplate(created);
    }
    /**
     * Preview template with variables
     */
    async preview(bodyText, variables = {}, headerType, headerContent, footerText, buttons) {
        const preview = {
            body: replaceVariables(bodyText, variables),
        };
        const normalizedHeaderType = normalizeHeaderType(headerType);
        if (normalizedHeaderType === 'TEXT' && headerContent) {
            preview.header = replaceVariables(headerContent, variables);
        }
        else if (normalizedHeaderType !== 'NONE') {
            preview.header = `[${normalizedHeaderType}]`;
        }
        if (footerText) {
            preview.footer = footerText;
        }
        if (buttons && buttons.length > 0) {
            preview.buttons = buttons.map((btn) => ({
                type: btn.type,
                text: btn.text,
            }));
        }
        return preview;
    }
    /**
     * Submit template to Meta
     */
    async submitToMeta(organizationId, templateId, whatsappAccountId) {
        const template = await database_1.default.template.findFirst({
            where: { id: templateId, organizationId },
        });
        if (!template) {
            throw new errorHandler_1.AppError('Template not found', 404);
        }
        const waData = await getWhatsAppAccountWithToken(organizationId, whatsappAccountId);
        // ✅ Buttons ko normalize karo before building payload
        const normalizedButtons = (template.buttons || []).map((b) => ({
            type: b.type,
            text: b.text,
            // ✅ Both formats handle karo
            url: b.url || b.website_url,
            phoneNumber: b.phoneNumber || b.phone_number,
            phone_number: b.phone_number || b.phoneNumber,
        }));
        const metaPayload = buildMetaTemplatePayload({
            name: template.name,
            language: template.language,
            category: template.category,
            headerType: template.headerType,
            headerContent: template.headerContent,
            bodyText: template.bodyText,
            footerText: template.footerText,
            buttons: normalizedButtons,
            variables: template.variables || [],
            headerMediaId: template.headerMediaId || undefined,
        });
        console.log('📤 Submitting template to Meta:', {
            templateId,
            name: template.name,
            language: toMetaLanguage(template.language),
            buttonsCount: normalizedButtons.length,
        });
        // ✅ FIXED: v21.0 use karo (same as create)
        const metaRes = await whatsapp_api_1.whatsappApi.createMessageTemplateByVersion(waData.wabaId, waData.accessToken, metaPayload, 'v21.0' // ✅ Was 'v17.0' - FIXED
        );
        const metaTemplateId = metaRes?.id || metaRes?.template_id;
        const updateData = {
            metaTemplateId: metaTemplateId ? String(metaTemplateId) : template.metaTemplateId,
            status: 'PENDING',
            rejectionReason: null,
        };
        if (waData.wabaId)
            updateData.wabaId = waData.wabaId;
        if (waData.account?.id)
            updateData.whatsappAccountId = waData.account.id;
        await database_1.default.template.update({
            where: { id: template.id },
            data: updateData,
        });
        console.log('✅ Template submitted to Meta:', metaTemplateId);
        return {
            message: 'Template submitted to Meta. It will appear as PENDING until approved.',
            metaTemplateId: metaTemplateId ? String(metaTemplateId) : undefined,
        };
    }
    /**
     * Get available languages
     */
    async getLanguages(organizationId, whatsappAccountId) {
        const where = { organizationId };
        if (whatsappAccountId) {
            where.whatsappAccountId = whatsappAccountId;
        }
        const templates = await database_1.default.template.groupBy({
            by: ['language'],
            where,
            _count: { language: true },
            orderBy: { _count: { language: 'desc' } },
        });
        return templates.map((t) => ({
            language: t.language,
            count: t._count.language,
        }));
    }
    /**
     * Update template status (called from webhook)
     */
    async updateStatus(metaTemplateId, status, rejectionReason) {
        await database_1.default.template.updateMany({
            where: { metaTemplateId },
            data: {
                status,
                rejectionReason: rejectionReason || null,
            },
        });
        console.log(`✅ Template status updated: ${metaTemplateId} -> ${status}`);
    }
    /**
     * Sync templates for specific account
     */
    async syncTemplatesForAccount(organizationId, whatsappAccountId) {
        return meta_service_1.metaService.syncTemplates(whatsappAccountId, organizationId);
    }
}
exports.TemplatesService = TemplatesService;
exports.templatesService = new TemplatesService();
exports.default = exports.templatesService;
//# sourceMappingURL=templates.service.js.map
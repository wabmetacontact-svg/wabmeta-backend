"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.templatesController = void 0;
const axios_1 = __importDefault(require("axios"));
const templates_service_1 = require("./templates.service");
const errorHandler_1 = require("../../middleware/errorHandler");
const database_1 = __importDefault(require("../../config/database"));
const meta_service_1 = require("../meta/meta.service");
const meta_api_1 = require("../meta/meta.api");
// ─── Helper: Get default WA account ──────────────────────────
const getDefaultAccountId = async (organizationId) => {
    const account = await database_1.default.whatsAppAccount.findFirst({
        where: {
            organizationId,
            status: 'CONNECTED',
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        select: { id: true },
    });
    return account?.id;
};
// ─── Helper: Lazy load cloudinary ─────────────────────────────
const getCloudinary = () => {
    let cloudinaryService = null;
    try {
        cloudinaryService = require('../../services/cloudinary.service').cloudinaryService;
    }
    catch {
        throw new errorHandler_1.AppError('Media storage not configured. Contact support.', 500);
    }
    if (!cloudinaryService?.isConfigured()) {
        throw new errorHandler_1.AppError('Media storage not configured. Contact support.', 500);
    }
    return cloudinaryService;
};
class TemplatesController {
    // ── CREATE ──────────────────────────────────────────────────
    async create(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const input = req.body;
            // Auto-detect account if not provided
            if (!input.whatsappAccountId) {
                input.whatsappAccountId = await getDefaultAccountId(organizationId);
            }
            const template = await templates_service_1.templatesService.create(organizationId, input);
            return res.status(201).json({
                success: true,
                message: 'Template created successfully',
                data: template,
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ── LIST ────────────────────────────────────────────────────
    async getList(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
            const search = req.query.search?.trim() || undefined;
            const status = req.query.status;
            const category = req.query.category;
            const language = req.query.language?.trim() || undefined;
            const sortBy = req.query.sortBy || 'createdAt';
            const sortOrder = req.query.sortOrder || 'desc';
            let whatsappAccountId = req.query.whatsappAccountId?.trim() || undefined;
            const wabaId = req.query.wabaId?.trim() || undefined;
            if (!whatsappAccountId && !wabaId) {
                whatsappAccountId = await getDefaultAccountId(organizationId);
            }
            const result = await templates_service_1.templatesService.getList(organizationId, {
                page, limit, search, status, category, language,
                sortBy: sortBy, sortOrder,
                whatsappAccountId, wabaId,
            });
            return res.json({
                success: true,
                message: 'Templates fetched successfully',
                data: result.templates,
                meta: result.meta,
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ── GET BY ID ───────────────────────────────────────────────
    async getById(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const template = await templates_service_1.templatesService.getById(organizationId, req.params.id);
            return res.json({
                success: true,
                message: 'Template fetched successfully',
                data: template,
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ── UPDATE ──────────────────────────────────────────────────
    async update(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const template = await templates_service_1.templatesService.update(organizationId, req.params.id, req.body);
            return res.json({
                success: true,
                message: 'Template updated successfully',
                data: template,
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ── DELETE ──────────────────────────────────────────────────
    async delete(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const result = await templates_service_1.templatesService.delete(organizationId, req.params.id);
            return res.json({ success: true, message: result.message });
        }
        catch (error) {
            next(error);
        }
    }
    // ── DUPLICATE ───────────────────────────────────────────────
    async duplicate(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { name, whatsappAccountId } = req.body;
            if (!name)
                throw new errorHandler_1.AppError('New template name is required', 400);
            const template = await templates_service_1.templatesService.duplicate(organizationId, req.params.id, name, whatsappAccountId);
            return res.status(201).json({
                success: true,
                message: 'Template duplicated successfully',
                data: template,
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ── STATS ───────────────────────────────────────────────────
    async getStats(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const whatsappAccountId = req.query.whatsappAccountId?.trim() || undefined;
            const stats = await templates_service_1.templatesService.getStats(organizationId, whatsappAccountId);
            return res.json({ success: true, data: stats });
        }
        catch (error) {
            next(error);
        }
    }
    // ── PREVIEW ─────────────────────────────────────────────────
    async preview(req, res, next) {
        try {
            const { bodyText, variables, headerType, headerContent, footerText, buttons, } = req.body;
            if (!bodyText)
                throw new errorHandler_1.AppError('Body text is required', 400);
            const preview = await templates_service_1.templatesService.preview(bodyText, variables || {}, headerType, headerContent, footerText, buttons);
            return res.json({ success: true, data: preview });
        }
        catch (error) {
            next(error);
        }
    }
    // ── APPROVED LIST ───────────────────────────────────────────
    async getApproved(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            let whatsappAccountId = req.query.whatsappAccountId?.trim() || undefined;
            const wabaId = req.query.wabaId?.trim() || undefined;
            if (!whatsappAccountId && !wabaId) {
                whatsappAccountId = await getDefaultAccountId(organizationId);
            }
            if (!whatsappAccountId && !wabaId) {
                return res.json({
                    success: true,
                    message: 'No WhatsApp account connected',
                    data: [],
                });
            }
            const templatesList = await templates_service_1.templatesService.getApprovedTemplates(organizationId, whatsappAccountId, wabaId);
            return res.json({
                success: true,
                data: templatesList,
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ── LANGUAGES ───────────────────────────────────────────────
    async getLanguages(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const whatsappAccountId = req.query.whatsappAccountId?.trim() || undefined;
            const langs = await templates_service_1.templatesService.getLanguages(organizationId, whatsappAccountId);
            return res.json({ success: true, data: langs });
        }
        catch (error) {
            next(error);
        }
    }
    // ── SUBMIT TO META ──────────────────────────────────────────
    async submit(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { whatsappAccountId, forceResubmit } = req.body || {};
            const result = await templates_service_1.templatesService.submitToMeta(organizationId, req.params.id, whatsappAccountId);
            return res.json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    // ── SYNC FROM META ──────────────────────────────────────────
    async sync(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            let whatsappAccountId = req.body?.whatsappAccountId?.trim() || undefined;
            if (!whatsappAccountId) {
                whatsappAccountId = await getDefaultAccountId(organizationId);
            }
            if (!whatsappAccountId) {
                return res.status(400).json({
                    success: false,
                    message: 'No WhatsApp account connected. Please connect first.',
                });
            }
            const result = await templates_service_1.templatesService.syncFromMeta(organizationId, whatsappAccountId);
            return res.json({ success: true, ...result });
        }
        catch (error) {
            next(error);
        }
    }
    // ── CHECK CONNECTION ────────────────────────────────────────
    async checkConnection(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const accounts = await database_1.default.whatsAppAccount.findMany({
                where: { organizationId },
                select: {
                    id: true, phoneNumber: true, displayName: true,
                    status: true, isDefault: true, wabaId: true,
                    createdAt: true, tokenExpiresAt: true,
                },
                orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            });
            if (accounts.length === 0) {
                return res.json({
                    success: false,
                    message: 'No WhatsApp accounts found',
                    hasConnection: false,
                    accounts: [],
                    connectedCount: 0,
                    totalCount: 0,
                });
            }
            const accountsWithStatus = await Promise.all(accounts.map(async (account) => {
                let tokenValid = false;
                const isExpired = account.tokenExpiresAt
                    ? account.tokenExpiresAt < new Date()
                    : false;
                try {
                    const result = await meta_service_1.metaService.getAccountWithToken(account.id);
                    tokenValid = !!result?.accessToken;
                }
                catch { /* silent */ }
                return {
                    ...account,
                    tokenValid,
                    isExpired,
                    isReady: account.status === 'CONNECTED' && tokenValid && !isExpired,
                };
            }));
            const connected = accountsWithStatus.filter(a => a.isReady);
            const defaultAcc = accountsWithStatus.find(a => a.isDefault);
            return res.json({
                success: true,
                hasConnection: connected.length > 0,
                defaultAccount: defaultAcc || connected[0] || null,
                accounts: accountsWithStatus,
                connectedCount: connected.length,
                totalCount: accounts.length,
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ── UPLOAD TO META (Re-upload helper) ───────────────────────
    // Sirf tab use hota hai jab:
    // - Cloudinary URL hai
    // - Fresh handle chahiye (resubmit ke liye)
    async uploadToMeta(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { cloudinaryUrl, mimeType, filename, whatsappAccountId } = req.body;
            if (!cloudinaryUrl)
                throw new errorHandler_1.AppError('cloudinaryUrl is required', 400);
            if (!cloudinaryUrl.startsWith('http')) {
                throw new errorHandler_1.AppError('Invalid cloudinaryUrl', 400);
            }
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
                    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
                });
            }
            if (!account) {
                throw new errorHandler_1.AppError('No connected WhatsApp account found', 400);
            }
            const accountWithToken = await meta_service_1.metaService.getAccountWithToken(account.id);
            if (!accountWithToken?.accessToken) {
                throw new errorHandler_1.AppError('Failed to decrypt WhatsApp token', 500);
            }
            // Download from Cloudinary
            const response = await axios_1.default.get(cloudinaryUrl, {
                responseType: 'arraybuffer',
                timeout: 60_000,
                headers: { 'User-Agent': 'WabMeta/1.0', Accept: '*/*' },
            });
            const buffer = Buffer.from(response.data);
            const contentType = (response.headers['content-type'] || '')
                .split(';')[0].trim();
            const finalMime = (contentType && contentType !== 'application/octet-stream')
                ? contentType
                : (mimeType || 'image/jpeg');
            const finalName = filename ||
                cloudinaryUrl.split('/').pop()?.split('?')[0] || 'media';
            // Upload to Meta
            const result = await meta_api_1.metaApi.uploadMedia(account.phoneNumberId, accountWithToken.accessToken, buffer, finalMime, finalName, account.wabaId);
            return res.json({
                success: true,
                mediaId: result.id,
                cloudinaryUrl,
            });
        }
        catch (error) {
            console.error('❌ uploadToMeta failed:', error.message);
            next(error);
        }
    }
    // ── REUPLOAD MEDIA ──────────────────────────────────────────
    // Existing template ka Cloudinary URL use karke
    // fresh handle banao aur DB update karo
    async reuploadMedia(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const template = await database_1.default.template.findFirst({
                where: { id: req.params.id, organizationId },
            });
            if (!template)
                throw new errorHandler_1.AppError('Template not found', 404);
            const mediaTypes = ['IMAGE', 'VIDEO', 'DOCUMENT'];
            if (!mediaTypes.includes(String(template.headerType || '').toUpperCase())) {
                throw new errorHandler_1.AppError('Template has no media header', 400);
            }
            const cloudinaryUrl = template.headerContent;
            if (!cloudinaryUrl?.startsWith('http')) {
                throw new errorHandler_1.AppError('No valid Cloudinary URL found in this template. ' +
                    'Please use fix-media to upload a new file.', 400);
            }
            // Get WA account
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { organizationId, status: 'CONNECTED' },
                orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            });
            if (!account)
                throw new errorHandler_1.AppError('No connected WhatsApp account', 400);
            const accountWithToken = await meta_service_1.metaService.getAccountWithToken(account.id);
            if (!accountWithToken?.accessToken) {
                throw new errorHandler_1.AppError('Failed to decrypt token', 500);
            }
            // Download from Cloudinary
            console.log('📥 Downloading from Cloudinary:', cloudinaryUrl);
            const response = await axios_1.default.get(cloudinaryUrl, {
                responseType: 'arraybuffer',
                timeout: 60_000,
                headers: { 'User-Agent': 'WabMeta/1.0' },
            });
            const buffer = Buffer.from(response.data);
            const mime = (response.headers['content-type'] || 'image/jpeg')
                .split(';')[0].trim();
            const fname = cloudinaryUrl.split('/').pop()?.split('?')[0] || 'media';
            // Upload to Meta
            const result = await meta_api_1.metaApi.uploadMedia(account.phoneNumberId, accountWithToken.accessToken, buffer, mime, fname, account.wabaId);
            console.log('✅ Reupload success, numeric ID:', result.id);
            // Update DB - sirf timestamp update karo
            // headerContent (Cloudinary URL) same rahega
            // headerMediaId DB mein store nahi karte
            await database_1.default.template.update({
                where: { id: template.id },
                data: {
                    headerMediaUploadedAt: new Date(),
                    headerMediaLastVerified: new Date(),
                },
            });
            return res.json({
                success: true,
                message: 'Media re-uploaded successfully. Now submit template for approval.',
                data: {
                    metaMediaId: result.id,
                    cloudinaryUrl: cloudinaryUrl,
                },
            });
        }
        catch (error) {
            console.error('❌ Reupload failed:', error.message);
            next(error);
        }
    }
    // ── FIX MEDIA ───────────────────────────────────────────────
    // Jab Cloudinary URL bhi nahi hai - fresh file upload karo
    async fixMedia(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const file = req.file;
            if (!file)
                throw new errorHandler_1.AppError('No file uploaded', 400);
            const template = await database_1.default.template.findFirst({
                where: { id: req.params.id, organizationId },
            });
            if (!template)
                throw new errorHandler_1.AppError('Template not found', 404);
            const mediaTypes = ['IMAGE', 'VIDEO', 'DOCUMENT'];
            if (!mediaTypes.includes(String(template.headerType || '').toUpperCase())) {
                throw new errorHandler_1.AppError('Template has no media header', 400);
            }
            // Get WA account
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { organizationId, status: 'CONNECTED' },
                orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            });
            if (!account)
                throw new errorHandler_1.AppError('No connected WhatsApp account', 400);
            const accountWithToken = await meta_service_1.metaService.getAccountWithToken(account.id);
            if (!accountWithToken?.accessToken) {
                throw new errorHandler_1.AppError('Failed to decrypt token', 500);
            }
            // 1. Upload to Cloudinary (permanent backup)
            let newCloudinaryUrl = template.headerContent || '';
            try {
                const cloudinary = getCloudinary();
                const result = await cloudinary.uploadTemplateMedia(file.buffer, file.originalname, file.mimetype, organizationId);
                newCloudinaryUrl = result.secureUrl;
                console.log('✅ Fix-media: Cloudinary done');
            }
            catch (err) {
                console.warn('⚠️ Fix-media: Cloudinary failed:', err.message);
                // Continue - Meta upload is critical
            }
            // 2. Upload to Meta (get numeric ID for verification)
            const metaResult = await meta_api_1.metaApi.uploadMedia(account.phoneNumberId, accountWithToken.accessToken, file.buffer, file.mimetype, file.originalname, account.wabaId);
            console.log('✅ Fix-media: Meta done, ID:', metaResult.id);
            // 3. Update DB
            const updateData = {
                headerMediaUploadedAt: new Date(),
                headerMediaLastVerified: new Date(),
            };
            // Only update cloudinaryUrl if we got a new one
            if (newCloudinaryUrl?.startsWith('http')) {
                updateData.headerContent = newCloudinaryUrl;
            }
            await database_1.default.template.update({
                where: { id: template.id },
                data: updateData,
            });
            return res.json({
                success: true,
                message: 'Media fixed. Template is ready for campaigns.',
                data: {
                    templateId: template.id,
                    metaMediaId: metaResult.id,
                    cloudinaryUrl: newCloudinaryUrl || null,
                    headerType: template.headerType,
                },
            });
        }
        catch (error) {
            console.error('❌ Fix-media failed:', error.message);
            next(error instanceof errorHandler_1.AppError ? error : new errorHandler_1.AppError(error.message, 500));
        }
    }
    // ── UPLOAD MEDIA ─────────────────────────────────────────────
    // ✅ Controller mein sirf delegate karo - sab logic media.ts mein hai
    async uploadMedia(req, res, next) {
        // templates.media.ts ka uploadTemplateMedia call hota hai route se directly
        // Ye method sirf fallback ke liye hai agar route directly call kare
        return next(new errorHandler_1.AppError('Use /upload-media route directly', 500));
    }
}
exports.templatesController = new TemplatesController();
exports.default = exports.templatesController;
//# sourceMappingURL=templates.controller.js.map
"use strict";
// src/modules/templates/templates.media.ts
// ✅ FINAL: Single upload flow
// - Cloudinary: permanent storage
// - Meta Resumable: handle for template creation only
// - No dual upload, no confusion
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadTemplateMedia = exports.uploadMiddleware = void 0;
const multer_1 = __importDefault(require("multer"));
const errorHandler_1 = require("../../middleware/errorHandler");
const meta_upload_service_1 = require("../../services/meta.upload.service");
const meta_service_1 = require("../meta/meta.service");
const database_1 = __importDefault(require("../../config/database"));
// ─── Lazy load cloudinary ─────────────────────────────────────
let _cloudinary = null;
const getCloudinary = () => {
    if (!_cloudinary) {
        try {
            _cloudinary = require('../../services/cloudinary.service').cloudinaryService;
        }
        catch {
            throw new errorHandler_1.AppError('Media storage not configured. Contact support.', 500);
        }
    }
    if (!_cloudinary.isConfigured()) {
        throw new errorHandler_1.AppError('Media storage not configured. Contact support.', 500);
    }
    return _cloudinary;
};
// ─── Meta size limits (hard limits) ──────────────────────────
const META_SIZE_LIMITS = {
    'image/jpeg': 5 * 1024 * 1024,
    'image/jpg': 5 * 1024 * 1024,
    'image/png': 5 * 1024 * 1024,
    'image/webp': 5 * 1024 * 1024,
    'video/mp4': 16 * 1024 * 1024,
    'video/3gpp': 16 * 1024 * 1024,
    'application/pdf': 100 * 1024 * 1024,
};
// Upload limits (before compression)
const UPLOAD_SIZE_LIMITS = {
    'image/jpeg': 15 * 1024 * 1024,
    'image/jpg': 15 * 1024 * 1024,
    'image/png': 15 * 1024 * 1024,
    'image/webp': 15 * 1024 * 1024,
    'video/mp4': 100 * 1024 * 1024,
    'video/3gpp': 100 * 1024 * 1024,
    'application/pdf': 100 * 1024 * 1024,
};
const ALLOWED_MIMES = Object.keys(META_SIZE_LIMITS);
const formatMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
// ─── Multer config ────────────────────────────────────────────
exports.uploadMiddleware = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIMES.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new errorHandler_1.AppError(`Unsupported file type: ${file.mimetype}. ` +
                `Allowed: JPEG, PNG, WebP, MP4, 3GPP, PDF`, 400));
        }
    },
});
// ─── Validate handle ──────────────────────────────────────────
const sanitizeHandle = (raw) => {
    if (!raw)
        return null;
    let h = raw.trim();
    // Remove concatenations (double upload bug)
    if (h.includes('\n'))
        h = h.split('\n')[0].trim();
    if (h.includes('\r'))
        h = h.split('\r')[0].trim();
    if (h.includes(','))
        h = h.split(',')[0].trim();
    if (h.includes(':::'))
        h = h.split(':::')[0].trim();
    // Must not be a URL
    if (h.startsWith('http'))
        return null;
    // Minimum valid length
    if (h.length < 10)
        return null;
    return h;
};
// ─── Main upload handler ──────────────────────────────────────
const uploadTemplateMedia = async (req, res, next) => {
    try {
        const file = req.file;
        const organizationId = req.user?.organizationId;
        const { whatsappAccountId } = req.body;
        if (!file)
            throw new errorHandler_1.AppError('No file uploaded', 400);
        if (!organizationId)
            throw new errorHandler_1.AppError('Organization required', 400);
        // ── Size validation ──────────────────────────────────────
        const uploadLimit = UPLOAD_SIZE_LIMITS[file.mimetype];
        if (!uploadLimit) {
            throw new errorHandler_1.AppError(`Unsupported file type: ${file.mimetype}`, 400);
        }
        if (file.size === 0) {
            throw new errorHandler_1.AppError('File is empty', 400);
        }
        if (file.size > uploadLimit) {
            throw new errorHandler_1.AppError(`File too large (${formatMB(file.size)}). ` +
                `Maximum: ${formatMB(uploadLimit)}. Please compress first.`, 400);
        }
        console.log('📤 Template media upload:', {
            filename: file.originalname,
            size: formatMB(file.size),
            mime: file.mimetype,
            orgId: organizationId,
        });
        // ── Step 1: Get WA account ───────────────────────────────
        let account = null;
        if (whatsappAccountId?.trim()) {
            account = await database_1.default.whatsAppAccount.findFirst({
                where: {
                    id: whatsappAccountId.trim(),
                    organizationId,
                    status: 'CONNECTED',
                },
            });
        }
        if (!account) {
            account = await database_1.default.whatsAppAccount.findFirst({
                where: { organizationId, status: 'CONNECTED' },
                orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            });
        }
        if (!account) {
            throw new errorHandler_1.AppError('No connected WhatsApp account found. ' +
                'Please connect WhatsApp in Settings.', 400);
        }
        const accountWithToken = await meta_service_1.metaService.getAccountWithToken(account.id);
        if (!accountWithToken?.accessToken) {
            throw new errorHandler_1.AppError('Failed to decrypt WhatsApp token. Please reconnect.', 500);
        }
        // ── Step 2: Upload to Cloudflare R2 (or fallback to Cloudinary) ─────────────
        let permanentUrl = '';
        let finalSize = file.size;
        let compressionApplied = false;
        const { r2Service } = await Promise.resolve().then(() => __importStar(require('../../services/r2.service')));
        if (r2Service.isConfigured()) {
            console.log('☁️ Uploading to Cloudflare R2...');
            try {
                const r2Result = await r2Service.uploadTemplateMedia({
                    file: {
                        buffer: file.buffer,
                        mimetype: file.mimetype,
                        originalname: file.originalname,
                        size: file.size,
                    },
                    organizationId,
                    headerType: req.body.headerType || 'IMAGE',
                    templateName: req.body.templateName,
                });
                permanentUrl = r2Result.url;
                finalSize = r2Result.size;
                console.log('✅ Cloudflare R2 done:', permanentUrl);
            }
            catch (err) {
                console.error('❌ R2 upload failed, falling back to Cloudinary:', err.message);
            }
        }
        if (!permanentUrl) {
            const cloudinary = getCloudinary();
            console.log('☁️ Uploading to Cloudinary...');
            try {
                const cloudinaryResult = await cloudinary.uploadTemplateMedia(file.buffer, file.originalname, file.mimetype, organizationId);
                permanentUrl = cloudinaryResult.secureUrl;
                finalSize = cloudinaryResult.finalSize || file.size;
                compressionApplied = !!cloudinaryResult.compressionApplied;
                console.log('✅ Cloudinary done:', permanentUrl.substring(0, 60));
            }
            catch (err) {
                throw new errorHandler_1.AppError(`Media storage upload failed: ${err.message}. Please try again.`, 500);
            }
        }
        // ── Step 3: Upload to Meta (handle for template creation) ─
        // Handle sirf ek baar use hoga - template create karte waqt
        // Approve hone ke baad Meta khud media store karta hai
        console.log('📱 Getting Meta handle...');
        let metaHandle;
        try {
            const result = await meta_upload_service_1.metaUploadService.uploadMediaForTemplate('', accountWithToken.accessToken, file.buffer, file.mimetype, file.originalname);
            const clean = sanitizeHandle(result.handle);
            if (!clean) {
                throw new Error('Invalid handle received from Meta');
            }
            metaHandle = clean;
        }
        catch (err) {
            // ✅ Meta handle fail hone pe bhi Cloudinary URL save hai
            // Frontend ko batao ki handle nahi mila
            throw new errorHandler_1.AppError(`Meta upload failed: ${err.message}. ` +
                `Please check file format and try again.`, 500);
        }
        console.log('✅ Meta handle:', metaHandle.substring(0, 40) + '...');
        // ── Response ─────────────────────────────────────────────
        // ✅ Clean response - no metaNumericId, no ":::" smuggling
        return res.json({
            success: true,
            message: 'Media uploaded successfully',
            data: {
                // Primary fields
                mediaHandle: metaHandle, // For Meta template creation
                cloudinaryUrl: permanentUrl, // For DB storage (permanent)
                permanentUrl: permanentUrl, // Same (backward compat)
                // Backward compat
                mediaId: metaHandle,
                url: permanentUrl,
                // Metadata
                filename: file.originalname,
                mimeType: file.mimetype,
                size: finalSize || file.size,
                originalSize: file.size,
                compressionApplied: compressionApplied,
                wabaId: account.wabaId,
                whatsappAccountId: account.id,
            },
        });
    }
    catch (error) {
        console.error('❌ Template media upload failed:', error.message);
        next(error instanceof errorHandler_1.AppError ? error : new errorHandler_1.AppError(error.message, 500));
    }
};
exports.uploadTemplateMedia = uploadTemplateMedia;
//# sourceMappingURL=templates.media.js.map
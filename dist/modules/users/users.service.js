"use strict";
// src/modules/users/users.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersService = exports.UsersService = void 0;
const database_1 = __importDefault(require("../../config/database"));
const errorHandler_1 = require("../../middleware/errorHandler");
const password_1 = require("../../utils/password");
const whatsapp_api_1 = require("../whatsapp/whatsapp.api");
const config_1 = require("../../config");
const cloudinary_1 = require("cloudinary");
const cloudinary_service_1 = require("../../services/cloudinary.service");
const r2_service_1 = require("../../services/r2.service");
// ============================================
// HELPER FUNCTIONS
// ============================================
const formatUserProfile = (user) => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    avatar: user.avatar,
    status: user.status,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
});
// ============================================
// HELPERS - WhatsApp Messaging
// ============================================
const toWhatsAppPhone = (phone) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10)
        return `91${digits}`;
    if (digits.startsWith('91') && digits.length === 12)
        return digits;
    if (digits.startsWith('0') && digits.length === 11)
        return `91${digits.slice(1)}`;
    return digits;
};
const toE164 = (phone) => {
    const wa = toWhatsAppPhone(phone);
    return `+${wa}`;
};
const sendWhatsAppTemplate = (phone, templateName, bodyParams = []) => {
    const { phoneNumberId, accessToken } = config_1.config.platform.whatsapp;
    if (!phoneNumberId || !accessToken) {
        console.warn('⚠️ Platform WhatsApp not configured');
        return;
    }
    const waPhone = toWhatsAppPhone(phone);
    // Fetch the template from DB to check for header configuration dynamically
    database_1.default.template
        .findFirst({
        where: {
            name: templateName,
            whatsappAccount: {
                phoneNumberId: phoneNumberId,
            },
        },
        select: {
            id: true,
            organizationId: true,
            headerType: true,
            headerContent: true,
        },
    })
        .then(async (tpl) => {
        const templateComponents = {};
        if (bodyParams.length > 0) {
            templateComponents.body = bodyParams.map((param) => ({
                type: 'text',
                text: param,
            }));
        }
        if (tpl?.headerContent) {
            const resolvedUrl = tpl.headerContent;
            const typeLower = tpl.headerType?.toLowerCase();
            if (typeLower === 'image' || typeLower === 'video' || typeLower === 'document') {
                templateComponents.header = [
                    {
                        type: typeLower,
                        [typeLower]: {
                            link: resolvedUrl,
                            ...(typeLower === 'document' ? { filename: 'Document' } : {}),
                        },
                    },
                ];
            }
        }
        return whatsapp_api_1.whatsappApi.sendTemplateMessage(phoneNumberId, waPhone, templateName, 'en', templateComponents, accessToken);
    })
        .then(() => console.log(`✅ WhatsApp [${templateName}] → +${waPhone}`))
        .catch((err) => {
        console.warn(`⚠️ WhatsApp [${templateName}] → +${waPhone} failed:`, err?.message);
    });
};
// ============================================
// USERS SERVICE CLASS
// ============================================
class UsersService {
    // ==========================================
    // GET USER PROFILE
    // ==========================================
    async getProfile(userId) {
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        return formatUserProfile(user);
    }
    // ==========================================
    // GET USER WITH ORGANIZATIONS
    // ==========================================
    async getUserWithOrganizations(userId) {
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
            include: {
                ownedOrganizations: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
                memberships: {
                    include: {
                        organization: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                            },
                        },
                    },
                },
            },
        });
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        // Combine owned and member organizations
        const organizations = [
            ...user.ownedOrganizations.map((org) => ({
                id: org.id,
                name: org.name,
                slug: org.slug,
                role: 'OWNER',
                isOwner: true,
            })),
            ...user.memberships
                .filter((m) => !user.ownedOrganizations.some((o) => o.id === m.organization.id))
                .map((m) => ({
                id: m.organization.id,
                name: m.organization.name,
                slug: m.organization.slug,
                role: m.role,
                isOwner: false,
            })),
        ];
        return {
            ...formatUserProfile(user),
            organizations,
        };
    }
    // ==========================================
    // UPDATE PROFILE
    // ==========================================
    async updateProfile(userId, input) {
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        const updatedUser = await database_1.default.user.update({
            where: { id: userId },
            data: {
                firstName: input.firstName ?? user.firstName,
                lastName: input.lastName !== undefined ? input.lastName : user.lastName,
                phone: input.phone !== undefined ? input.phone : user.phone,
                avatar: input.avatar !== undefined ? input.avatar : user.avatar,
            },
        });
        return formatUserProfile(updatedUser);
    }
    // ==========================================
    // UPDATE AVATAR
    // ==========================================
    async updateAvatar(userId, avatarUrl) {
        let finalAvatar = avatarUrl;
        if (avatarUrl && avatarUrl.startsWith('data:')) {
            // Sirf images. data:application/... jaisa kuch aaye to seedha reject,
            // warna wo bina upload ke raw hi DB mein chala jata tha.
            if (!avatarUrl.startsWith('data:image/')) {
                throw new errorHandler_1.AppError('Avatar must be an image', 400);
            }
            const parts = avatarUrl.split(',');
            const base64 = parts[1];
            if (!base64) {
                throw new errorHandler_1.AppError('Avatar image is malformed', 400);
            }
            // Base64 ka asli size ~ 3/4. 5MB se upar mat lo - upload slow hoga
            // aur fail hone par poori string DB mein ghusne ka risk hai.
            const approxBytes = Math.floor((base64.length * 3) / 4);
            if (approxBytes > 5 * 1024 * 1024) {
                throw new errorHandler_1.AppError('Avatar image is too large (max 5MB)', 400);
            }
            const failures = [];
            // 1. Try R2 (Primary CDN)
            if (r2_service_1.r2Service.isConfigured()) {
                try {
                    const buffer = Buffer.from(base64, 'base64');
                    const mimeType = parts[0].split(';')[0].replace('data:', '') || 'image/png';
                    const ext = mimeType.split('/')[1] || 'png';
                    const filename = `avatar_${userId}_${Date.now()}.${ext}`;
                    const r2Res = await r2_service_1.r2Service.uploadMediaBuffer(buffer, filename, mimeType, `avatars/${userId}`);
                    if (r2Res?.url) {
                        finalAvatar = r2Res.url;
                    }
                    else {
                        failures.push('R2 returned no URL');
                    }
                }
                catch (err) {
                    console.warn('⚠️ R2 avatar upload failed, trying Cloudinary:', err?.message);
                    failures.push(`R2: ${err?.message || 'unknown error'}`);
                }
            }
            else {
                failures.push('R2 not configured');
            }
            // 2. Fallback to Cloudinary
            if (finalAvatar.startsWith('data:image/')) {
                if (cloudinary_service_1.cloudinaryService.isConfigured()) {
                    try {
                        const uploadRes = await cloudinary_1.v2.uploader.upload(avatarUrl, {
                            folder: 'wabmeta/avatars',
                            transformation: [
                                { width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto', fetch_format: 'auto' },
                            ],
                        });
                        if (uploadRes?.secure_url) {
                            finalAvatar = uploadRes.secure_url;
                        }
                        else {
                            failures.push('Cloudinary returned no URL');
                        }
                    }
                    catch (err) {
                        console.warn('⚠️ Cloudinary avatar upload failed:', err?.message);
                        failures.push(`Cloudinary: ${err?.message || 'unknown error'}`);
                    }
                }
                else {
                    failures.push('Cloudinary not configured');
                }
            }
            // Dono fail? Pehle yahan poori data-uri (kai MB ki string) DB ke avatar
            // column mein save ho jati thi - aur user ko lagta tha photo lag gayi.
            // Ab saaf error, taaki client ko pata chale ki upload nahi hua.
            if (finalAvatar.startsWith('data:image/')) {
                console.error('❌ Avatar upload failed for user', userId, failures);
                throw new errorHandler_1.AppError('Could not upload profile photo right now. Please try again.', 502);
            }
        }
        const updatedUser = await database_1.default.user.update({
            where: { id: userId },
            data: { avatar: finalAvatar },
        });
        return formatUserProfile(updatedUser);
    }
    // ==========================================
    // GET USER STATS
    // ==========================================
    async getUserStats(userId) {
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
            include: {
                ownedOrganizations: {
                    select: { id: true },
                },
                memberships: {
                    select: {
                        organizationId: true,
                    },
                },
            },
        });
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        // Get all organization IDs user belongs to
        const orgIds = [
            ...user.ownedOrganizations.map((o) => o.id),
            ...user.memberships.map((m) => m.organizationId),
        ];
        // Get stats from all organizations
        const [totalContacts, totalMessages, totalCampaigns] = await Promise.all([
            database_1.default.contact.count({
                where: { organizationId: { in: orgIds } },
            }),
            database_1.default.message.count({
                where: {
                    conversation: {
                        organizationId: { in: orgIds },
                    },
                },
            }),
            database_1.default.campaign.count({
                where: { organizationId: { in: orgIds } },
            }),
        ]);
        return {
            totalContacts,
            totalMessages,
            totalCampaigns,
            memberSince: user.createdAt,
        };
    }
    // ==========================================
    // GET ACTIVE SESSIONS
    // ==========================================
    async getActiveSessions(userId, currentToken) {
        const sessions = await database_1.default.refreshToken.findMany({
            where: {
                userId,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
        });
        return sessions.map((session) => ({
            id: session.id,
            userAgent: session.userAgent,
            ipAddress: session.ipAddress,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            isCurrent: session.token === currentToken,
        }));
    }
    // ==========================================
    // REVOKE SESSION
    // ==========================================
    async revokeSession(userId, sessionId) {
        const session = await database_1.default.refreshToken.findFirst({
            where: {
                id: sessionId,
                userId,
            },
        });
        if (!session) {
            throw new errorHandler_1.AppError('Session not found', 404);
        }
        await database_1.default.refreshToken.delete({
            where: { id: sessionId },
        });
        return { message: 'Session revoked successfully' };
    }
    // ==========================================
    // REVOKE ALL SESSIONS
    // ==========================================
    async revokeAllSessions(userId, exceptCurrent) {
        await database_1.default.refreshToken.deleteMany({
            where: {
                userId,
                ...(exceptCurrent && { token: { not: exceptCurrent } }),
            },
        });
        return { message: 'All sessions revoked successfully' };
    }
    // ==========================================
    // DELETE ACCOUNT
    // ==========================================
    async deleteAccount(userId, password, reason) {
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
            include: {
                // Only live orgs matter for the ownership-transfer guard below; a
                // soft-deleted org would otherwise block account deletion forever.
                ownedOrganizations: { where: { deletedAt: null } },
            },
        });
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        // Verify password (skip for OAuth users)
        if (user.password) {
            const isValid = await (0, password_1.comparePassword)(password, user.password);
            if (!isValid) {
                throw new errorHandler_1.AppError('Invalid password', 400);
            }
        }
        // Check if user owns any organizations with other members
        for (const org of user.ownedOrganizations) {
            const memberCount = await database_1.default.organizationMember.count({
                where: { organizationId: org.id },
            });
            if (memberCount > 1) {
                throw new errorHandler_1.AppError(`Cannot delete account. Please transfer ownership of "${org.name}" first.`, 400);
            }
        }
        // Log deletion reason
        if (reason) {
            await database_1.default.activityLog.create({
                data: {
                    userId,
                    action: 'DELETE',
                    metadata: { reason },
                },
            });
        }
        // Delete user and all related data (cascades)
        await database_1.default.$transaction(async (tx) => {
            // Full account erasure: hard-delete owned organizations (cascades to
            // their data). Org-only deletion is soft (see organizations.service) to
            // keep the ledger; a whole-account deletion is a complete erasure, and the
            // org can't outlive its sole owner without an owner FK anyway.
            await tx.organization.deleteMany({
                where: { ownerId: userId },
            });
            // Delete user
            await tx.user.delete({
                where: { id: userId },
            });
        });
        return { message: 'Account deleted successfully' };
    }
    // ==========================================
    // GET USER BY ID (Admin)
    // ==========================================
    async getUserById(userId) {
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        return formatUserProfile(user);
    }
    // ==========================================
    // ADD PHONE NUMBER (For Google login users)
    // ==========================================
    async addPhoneNumber(userId, phone) {
        // Validate
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 10 || digits.length > 15) {
            throw new errorHandler_1.AppError('Invalid phone number', 400);
        }
        // Get user
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        const phoneE164 = toE164(phone);
        // Check duplicate
        const existingPhoneUser = await database_1.default.user.findFirst({
            where: {
                phone: phoneE164,
                id: { not: userId },
            },
        });
        if (existingPhoneUser) {
            throw new errorHandler_1.AppError('This phone number is already registered with another account', 409);
        }
        // Update user
        const updatedUser = await database_1.default.user.update({
            where: { id: userId },
            data: { phone: phoneE164 },
        });
        console.log(`📱 Phone added: ${user.email} → ${phoneE164}`);
        // Send Welcome WhatsApp (non-blocking)
        let whatsappSent = false;
        try {
            sendWhatsAppTemplate(phoneE164, config_1.config.platform.whatsapp.welcomeTemplate, [user.firstName]);
            whatsappSent = true;
        }
        catch (err) {
            console.warn('⚠️ WhatsApp send failed:', err.message);
        }
        return {
            message: 'Phone number added successfully',
            phone: updatedUser.phone,
            whatsappSent,
        };
    }
}
exports.UsersService = UsersService;
// Export singleton instance
exports.usersService = new UsersService();
//# sourceMappingURL=users.service.js.map
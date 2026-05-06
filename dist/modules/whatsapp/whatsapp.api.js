"use strict";
// 📁 src/modules/whatsapp/whatsapp.api.ts - COMPLETE WHATSAPP API CLIENT
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappApi = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../../config");
const META_API_VERSION = config_1.config.meta.graphApiVersion || 'v22.0';
const BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;
// ============================================
// WHATSAPP API CLASS
// ============================================
class WhatsAppAPI {
    client;
    clientUnversioned;
    constructor() {
        // Versioned client (for most endpoints)
        this.client = axios_1.default.create({
            baseURL: BASE_URL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        // Unversioned client (for debug_token)
        this.clientUnversioned = axios_1.default.create({
            baseURL: 'https://graph.facebook.com',
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        console.log(`✅ WhatsApp API Client initialized (${META_API_VERSION})`);
    }
    // ============================================
    // OAUTH & TOKEN MANAGEMENT
    // ============================================
    /**
     * Exchange OAuth code for short-lived access token
     */
    async exchangeCodeForToken(code, redirectUri) {
        try {
            console.log('[WhatsApp API] Exchanging code for token...');
            const response = await this.client.get('/oauth/access_token', {
                params: {
                    client_id: config_1.config.meta.appId,
                    client_secret: config_1.config.meta.appSecret,
                    redirect_uri: redirectUri,
                    code,
                },
            });
            console.log('[WhatsApp API] ✅ Token obtained');
            return response.data;
        }
        catch (error) {
            console.error('[WhatsApp API] ❌ Token exchange failed:', this.formatError(error));
            throw this.handleError(error, 'Failed to exchange code for token');
        }
    }
    /**
     * Exchange short-lived token for long-lived token (60 days)
     */
    async exchangeForLongLivedToken(shortLivedToken) {
        try {
            console.log('[WhatsApp API] Getting long-lived token...');
            const response = await this.client.get('/oauth/access_token', {
                params: {
                    grant_type: 'fb_exchange_token',
                    client_id: config_1.config.meta.appId,
                    client_secret: config_1.config.meta.appSecret,
                    fb_exchange_token: shortLivedToken,
                },
            });
            console.log('[WhatsApp API] ✅ Long-lived token obtained');
            return response.data;
        }
        catch (error) {
            console.error('[WhatsApp API] ❌ Long-lived token failed:', this.formatError(error));
            throw this.handleError(error, 'Failed to get long-lived token');
        }
    }
    /**
     * Debug token - check validity, scopes, expiry
     */
    async debugToken(inputToken) {
        try {
            const appAccessToken = `${config_1.config.meta.appId}|${config_1.config.meta.appSecret}`;
            const response = await this.clientUnversioned.get('/debug_token', {
                params: {
                    input_token: inputToken,
                    access_token: appAccessToken,
                },
            });
            return response.data;
        }
        catch (error) {
            console.error('[WhatsApp API] ❌ Debug token failed:', this.formatError(error));
            throw this.handleError(error, 'Failed to debug token');
        }
    }
    /**
     * Get current user info
     */
    async getMe(accessToken) {
        try {
            const response = await this.client.get('/me', {
                params: {
                    access_token: accessToken,
                    fields: 'id,name',
                    appsecret_proof: this.generateAppSecretProof(accessToken),
                },
            });
            return response.data;
        }
        catch (error) {
            console.error('[WhatsApp API] ❌ Get me failed:', this.formatError(error));
            throw this.handleError(error, 'Failed to get user info');
        }
    }
    // ============================================
    // BUSINESS & WABA
    // ============================================
    /**
     * Get businesses owned by the user
     */
    async getUserBusinesses(accessToken) {
        try {
            const response = await this.client.get('/me/businesses', {
                params: {
                    access_token: accessToken,
                    limit: 50,
                    appsecret_proof: this.generateAppSecretProof(accessToken),
                },
            });
            return response.data?.data || [];
        }
        catch (error) {
            console.error('[WhatsApp API] ❌ Get businesses failed:', this.formatError(error));
            throw this.handleError(error, 'Failed to get businesses');
        }
    }
    /**
     * Get WhatsApp Business Accounts owned by a business
     */
    async getOwnedWabas(businessId, accessToken) {
        try {
            const response = await this.client.get(`${businessId}/owned_whatsapp_business_accounts`, {
                params: {
                    access_token: accessToken,
                    limit: 50,
                    appsecret_proof: this.generateAppSecretProof(accessToken),
                },
            });
            return response.data?.data || [];
        }
        catch (error) {
            console.error('[WhatsApp API] ❌ Get WABAs failed:', this.formatError(error));
            throw this.handleError(error, 'Failed to get WABAs');
        }
    }
    /**
     * Get phone numbers under a WABA
     */
    async getWabaPhoneNumbers(wabaId, accessToken) {
        try {
            const response = await this.client.get(`${wabaId}/phone_numbers`, {
                params: {
                    access_token: accessToken,
                    limit: 50,
                    fields: 'id,verified_name,display_phone_number,quality_rating,code_verification_status,platform_type,throughput',
                    appsecret_proof: this.generateAppSecretProof(accessToken),
                },
            });
            return response.data?.data || [];
        }
        catch (error) {
            console.error('[WhatsApp API] ❌ Get phone numbers failed:', this.formatError(error));
            throw this.handleError(error, 'Failed to get phone numbers');
        }
    }
    /**
     * Get phone number details
     */
    async getPhoneNumberInfo(phoneNumberId, accessToken) {
        try {
            const response = await this.client.get(`${phoneNumberId}`, {
                params: {
                    access_token: accessToken,
                    fields: 'verified_name,code_verification_status,display_phone_number,quality_rating,platform_type,throughput,id',
                    appsecret_proof: this.generateAppSecretProof(accessToken),
                },
            });
            return response.data;
        }
        catch (error) {
            console.error('[WhatsApp API] ❌ Get phone info failed:', this.formatError(error));
            throw this.handleError(error, 'Failed to get phone number info');
        }
    }
    /**
     * Register phone number for WhatsApp
     */
    async registerPhoneNumber(phoneNumberId, accessToken, pin) {
        try {
            const response = await this.client.post(`${phoneNumberId}/register`, {
                messaging_product: 'whatsapp',
                pin,
            }, {
                params: {
                    access_token: accessToken,
                    appsecret_proof: this.generateAppSecretProof(accessToken),
                },
            });
            return response.data;
        }
        catch (error) {
            console.error('[WhatsApp API] ❌ Register phone failed:', this.formatError(error));
            throw this.handleError(error, 'Failed to register phone number');
        }
    }
    /**
     * Subscribe app to WABA webhooks
     */
    async subscribeAppToWaba(wabaId, accessToken) {
        try {
            const response = await this.client.post(`${wabaId}/subscribed_apps`, {}, {
                params: {
                    access_token: accessToken,
                    appsecret_proof: this.generateAppSecretProof(accessToken),
                },
            });
            return response.data;
        }
        catch (error) {
            console.error('[WhatsApp API] ❌ Subscribe webhook failed:', this.formatError(error));
            throw this.handleError(error, 'Failed to subscribe to webhooks');
        }
    }
    // ============================================
    // MESSAGING
    // ============================================
    /**
     * Send template message
     */
    async sendTemplateMessage(phoneNumberId, to, templateName, language, components, accessToken) {
        try {
            console.log(`📤 Sending template message:`);
            console.log(`   Phone Number ID: ${phoneNumberId}`);
            console.log(`   To: ${to}`);
            console.log(`   Template: ${templateName} (${language})`);
            const cleanTo = to.replace(/\D/g, '');
            const payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: cleanTo,
                type: 'template',
                template: {
                    name: templateName,
                    language: {
                        code: language,
                    },
                },
            };
            if (components && Object.keys(components).length > 0) {
                payload.template.components = this.buildTemplateComponents(components);
            }
            const response = await this.client.post(`${phoneNumberId}/messages`, payload, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            const waMessageId = response.data.messages?.[0]?.id;
            if (!waMessageId) {
                throw new Error('No message ID returned from WhatsApp API');
            }
            console.log(`✅ Template message sent: ${waMessageId}`);
            return { waMessageId };
        }
        catch (error) {
            console.error('❌ Error sending template message:', this.formatError(error));
            throw this.handleError(error, 'Failed to send template message');
        }
    }
    /**
     * Send text message
     */
    async sendTextMessage(phoneNumberId, to, message, accessToken, previewUrl = false) {
        try {
            const cleanTo = to.replace(/\D/g, '');
            const payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: cleanTo,
                type: 'text',
                text: {
                    preview_url: previewUrl,
                    body: message,
                },
            };
            const response = await this.client.post(`${phoneNumberId}/messages`, payload, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            const waMessageId = response.data.messages?.[0]?.id;
            if (!waMessageId) {
                throw new Error('No message ID returned');
            }
            console.log(`✅ Text message sent: ${waMessageId}`);
            return { waMessageId };
        }
        catch (error) {
            console.error('❌ Error sending text message:', this.formatError(error));
            throw this.handleError(error, 'Failed to send text message');
        }
    }
    /**
     * Send media message
     */
    async sendMediaMessage(phoneNumberId, to, media, accessToken) {
        try {
            const cleanTo = to.replace(/\D/g, '');
            const mediaPayload = {};
            if (media.id) {
                mediaPayload.id = media.id;
            }
            else if (media.url) {
                mediaPayload.link = media.url;
            }
            else {
                throw new Error('Either media ID or URL must be provided');
            }
            if (media.caption && ['image', 'video', 'document'].includes(media.type)) {
                mediaPayload.caption = media.caption;
            }
            if (media.type === 'document' && media.filename) {
                mediaPayload.filename = media.filename;
            }
            const payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: cleanTo,
                type: media.type,
                [media.type]: mediaPayload,
            };
            const response = await this.client.post(`${phoneNumberId}/messages`, payload, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            const waMessageId = response.data.messages?.[0]?.id;
            if (!waMessageId) {
                throw new Error('No message ID returned');
            }
            console.log(`✅ ${media.type} message sent: ${waMessageId}`);
            return { waMessageId };
        }
        catch (error) {
            console.error('❌ Error sending media message:', this.formatError(error));
            throw this.handleError(error, 'Failed to send media message');
        }
    }
    /**
     * Send message (generic)
     */
    async sendMessage(phoneNumberId, accessToken, payload) {
        try {
            const response = await this.client.post(`${phoneNumberId}/messages`, payload, {
                params: {
                    access_token: accessToken,
                    appsecret_proof: this.generateAppSecretProof(accessToken),
                },
            });
            return response.data;
        }
        catch (error) {
            console.error('❌ Error sending message:', this.formatError(error));
            throw this.handleError(error, 'Failed to send message');
        }
    }
    /**
     * Mark message as read
     */
    async markAsRead(phoneNumberId, messageId, accessToken) {
        try {
            await this.client.post(`${phoneNumberId}/messages`, {
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: messageId,
            }, {
                params: {
                    access_token: accessToken,
                    appsecret_proof: this.generateAppSecretProof(accessToken),
                },
            });
            console.log(`✅ Message marked as read: ${messageId}`);
            return true;
        }
        catch (error) {
            console.error('❌ Error marking message as read:', this.formatError(error));
            return false;
        }
    }
    // ============================================
    // TEMPLATES
    // ============================================
    /**
     * Create message template with specific API version
     */
    async createMessageTemplateByVersion(wabaId, accessToken, payload, version = 'v22.0') {
        try {
            const response = await this.clientUnversioned.post(`/${version}/${wabaId}/message_templates`, payload, {
                params: {
                    access_token: accessToken,
                    appsecret_proof: this.generateAppSecretProof(accessToken),
                },
            });
            return response.data;
        }
        catch (error) {
            console.error(`❌ Error creating template (${version}):`, this.formatError(error));
            throw this.handleError(error, `Failed to create template with ${version}`);
        }
    }
    /**
     * Create message template
     */
    async createMessageTemplate(wabaId, accessToken, payload) {
        try {
            const response = await this.client.post(`${wabaId}/message_templates`, payload, {
                params: {
                    access_token: accessToken,
                    appsecret_proof: this.generateAppSecretProof(accessToken),
                },
            });
            return response.data;
        }
        catch (error) {
            console.error('❌ Error creating template:', this.formatError(error));
            throw this.handleError(error, 'Failed to create template');
        }
    }
    /**
     * List message templates
     */
    async listMessageTemplates(wabaId, accessToken) {
        try {
            const response = await this.client.get(`${wabaId}/message_templates`, {
                params: {
                    access_token: accessToken,
                    limit: 200,
                    appsecret_proof: this.generateAppSecretProof(accessToken),
                },
            });
            return response.data?.data || [];
        }
        catch (error) {
            console.error('❌ Error listing templates:', this.formatError(error));
            throw this.handleError(error, 'Failed to list templates');
        }
    }
    /**
     * Get single template
     */
    async getMessageTemplate(templateId, accessToken) {
        try {
            const response = await this.client.get(`${templateId}`, {
                params: {
                    access_token: accessToken,
                    appsecret_proof: this.generateAppSecretProof(accessToken),
                },
            });
            return response.data;
        }
        catch (error) {
            console.error('❌ Error getting template:', this.formatError(error));
            throw this.handleError(error, 'Failed to get template');
        }
    }
    /**
     * Delete message template
     */
    async deleteMessageTemplate(wabaId, accessToken, templateName) {
        try {
            const response = await this.client.delete(`${wabaId}/message_templates`, {
                params: {
                    access_token: accessToken,
                    name: templateName,
                    appsecret_proof: this.generateAppSecretProof(accessToken),
                },
            });
            return response.data;
        }
        catch (error) {
            console.error('❌ Error deleting template:', this.formatError(error));
            throw this.handleError(error, 'Failed to delete template');
        }
    }
    // ============================================
    // MEDIA
    // ============================================
    /**
     * Upload media
     */
    async uploadMedia(phoneNumberId, accessToken, formData) {
        try {
            const response = await this.client.post(`${phoneNumberId}/media`, formData, {
                params: {
                    access_token: accessToken,
                    appsecret_proof: this.generateAppSecretProof(accessToken),
                },
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        }
        catch (error) {
            console.error('❌ Error uploading media:', this.formatError(error));
            throw this.handleError(error, 'Failed to upload media');
        }
    }
    /**
     * Get media URL
     */
    async getMediaUrl(mediaId, accessToken) {
        try {
            const response = await this.client.get(`${mediaId}`, {
                params: {
                    access_token: accessToken,
                    appsecret_proof: this.generateAppSecretProof(accessToken),
                },
            });
            return response.data;
        }
        catch (error) {
            console.error('❌ Error getting media URL:', this.formatError(error));
            throw this.handleError(error, 'Failed to get media URL');
        }
    }
    /**
     * Download media
     */
    async downloadMedia(mediaUrl, accessToken) {
        try {
            const response = await axios_1.default.get(mediaUrl, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                responseType: 'arraybuffer',
            });
            return response.data;
        }
        catch (error) {
            console.error('❌ Error downloading media:', this.formatError(error));
            throw this.handleError(error, 'Failed to download media');
        }
    }
    // ============================================
    // HELPER METHODS
    // ============================================
    /**
     * Generate app secret proof for secure API calls
     */
    generateAppSecretProof(userAccessToken) {
        if (!config_1.config.meta.appSecret)
            return undefined;
        return crypto_1.default
            .createHmac('sha256', config_1.config.meta.appSecret)
            .update(userAccessToken)
            .digest('hex');
    }
    /**
     * Build template components
     */
    buildTemplateComponents(params) {
        const components = [];
        if (params.header) {
            const headerParams = Array.isArray(params.header) ? params.header : [params.header];
            components.push({
                type: 'header',
                parameters: headerParams.map((value) => {
                    if (typeof value === 'string') {
                        return { type: 'text', text: value };
                    }
                    return value;
                }),
            });
        }
        if (params.body && params.body.length > 0) {
            components.push({
                type: 'body',
                parameters: params.body.map((value) => {
                    if (typeof value === 'string') {
                        return { type: 'text', text: value };
                    }
                    return value;
                }),
            });
        }
        if (params.buttons && params.buttons.length > 0) {
            params.buttons.forEach((button, index) => {
                components.push({
                    type: 'button',
                    sub_type: button.type || 'quick_reply',
                    index: index,
                    parameters: [
                        {
                            type: 'payload',
                            payload: button.payload || button.text || '',
                        },
                    ],
                });
            });
        }
        return components;
    }
    /**
     * Format error for logging
     */
    formatError(error) {
        return {
            status: error?.response?.status,
            data: error?.response?.data,
            message: error?.message,
        };
    }
    /**
     * Handle and format errors
     */
    handleError(error, defaultMessage) {
        const err = error.response?.data?.error;
        if (err) {
            let msg = err.message || defaultMessage;
            if (err.code)
                msg += ` (Code: ${err.code})`;
            if (err.error_subcode)
                msg += ` (Subcode: ${err.error_subcode})`;
            const apiErr = new Error(msg);
            apiErr.response = error.response;
            apiErr.metaError = err;
            return apiErr;
        }
        const standardErr = new Error(error.message || defaultMessage);
        standardErr.response = error.response;
        return standardErr;
    }
}
exports.whatsappApi = new WhatsAppAPI();
exports.default = exports.whatsappApi;
//# sourceMappingURL=whatsapp.api.js.map
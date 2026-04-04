"use strict";
// 📁 src/modules/meta/meta.api.ts - COMPLETE META API CLIENT WITH PROFILE METHODS
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metaApi = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../../config");
class MetaApiClient {
    client;
    graphVersion;
    constructor() {
        this.graphVersion = config_1.config.meta.graphApiVersion || 'v22.0';
        this.client = axios_1.default.create({
            baseURL: `https://graph.facebook.com/${this.graphVersion}`,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        // Request interceptor
        this.client.interceptors.request.use((reqConfig) => {
            const url = reqConfig.url || '';
            const method = reqConfig.method?.toUpperCase() || 'GET';
            console.log(`[Meta API] ${method} ${url}`);
            return reqConfig;
        }, (error) => {
            console.error('[Meta API] Request setup error:', error.message);
            return Promise.reject(error);
        });
        // Response interceptor
        this.client.interceptors.response.use((response) => {
            console.log(`[Meta API] ✅ Response: ${response.status}`);
            return response;
        }, (error) => {
            if (error.response?.data?.error) {
                const metaError = error.response.data.error;
                console.error('[Meta API] ❌ Error:', {
                    message: metaError.message,
                    code: metaError.code,
                    subcode: metaError.error_subcode,
                    type: metaError.type,
                    fbtrace_id: metaError.fbtrace_id,
                });
            }
            else {
                console.error('[Meta API] ❌ Error:', error.message);
            }
            return Promise.reject(error);
        });
        console.log(`✅ Meta API Client initialized (${this.graphVersion})`);
    }
    // ============================================
    // TOKEN MANAGEMENT
    // ============================================
    async exchangeCodeForToken(code) {
        try {
            console.log('[Meta API] Exchanging code for token...');
            console.log('[Meta API] Redirect URI:', config_1.config.meta.redirectUri);
            const response = await this.client.get('/oauth/access_token', {
                params: {
                    client_id: config_1.config.meta.appId,
                    client_secret: config_1.config.meta.appSecret,
                    redirect_uri: config_1.config.meta.redirectUri,
                    code: code,
                },
            });
            console.log('[Meta API] ✅ Token exchange successful');
            return {
                accessToken: response.data.access_token,
                tokenType: response.data.token_type || 'bearer',
                expiresIn: response.data.expires_in,
            };
        }
        catch (error) {
            console.error('[Meta API] ❌ Token exchange failed');
            throw this.handleError(error, 'Failed to exchange code for token');
        }
    }
    async getLongLivedToken(shortLivedToken) {
        try {
            console.log('[Meta API] Getting long-lived token...');
            const response = await this.client.get('/oauth/access_token', {
                params: {
                    grant_type: 'fb_exchange_token',
                    client_id: config_1.config.meta.appId,
                    client_secret: config_1.config.meta.appSecret,
                    fb_exchange_token: shortLivedToken,
                },
            });
            console.log('[Meta API] ✅ Long-lived token obtained');
            return {
                accessToken: response.data.access_token,
                tokenType: response.data.token_type || 'bearer',
                expiresIn: response.data.expires_in,
            };
        }
        catch (error) {
            console.error('[Meta API] ⚠️ Could not get long-lived token');
            throw this.handleError(error, 'Failed to get long-lived token');
        }
    }
    async debugToken(accessToken) {
        try {
            console.log('[Meta API] Debugging token...');
            const appToken = `${config_1.config.meta.appId}|${config_1.config.meta.appSecret}`;
            const response = await this.client.get('/debug_token', {
                params: {
                    input_token: accessToken,
                    access_token: appToken,
                },
            });
            const data = response.data.data;
            console.log('[Meta API] ✅ Token debug info:', {
                app_id: data.app_id,
                is_valid: data.is_valid,
                scopes: data.scopes?.join(', ') || 'none',
                expires_at: data.expires_at ? new Date(data.expires_at * 1000).toISOString() : 'never',
            });
            return response.data;
        }
        catch (error) {
            throw this.handleError(error, 'Failed to debug token');
        }
    }
    async validateToken(accessToken) {
        try {
            const debugResult = await this.debugToken(accessToken);
            return debugResult.data.is_valid;
        }
        catch (error) {
            console.error('[Meta API] Token validation failed:', error);
            return false;
        }
    }
    // ============================================
    // WABA METHODS
    // ============================================
    async getSharedWABAs(accessToken) {
        try {
            console.log('[Meta API] Fetching shared WABAs...');
            const meResponse = await this.client.get('/me', {
                params: {
                    access_token: accessToken,
                    fields: 'id,name',
                },
            });
            console.log('[Meta API] User:', meResponse.data.name || meResponse.data.id);
            const businessResponse = await this.client.get(`/${meResponse.data.id}/businesses`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,name',
                },
            });
            const businesses = businessResponse.data.data || [];
            console.log('[Meta API] Found businesses:', businesses.length);
            const wabas = [];
            for (const business of businesses) {
                try {
                    const clientWabaResponse = await this.client.get(`/${business.id}/client_whatsapp_business_accounts`, {
                        params: {
                            access_token: accessToken,
                            fields: 'id,name,currency,timezone_id,message_template_namespace',
                        },
                    });
                    if (clientWabaResponse.data.data?.length) {
                        wabas.push(...clientWabaResponse.data.data);
                    }
                }
                catch (e) {
                    try {
                        const ownedWabaResponse = await this.client.get(`/${business.id}/owned_whatsapp_business_accounts`, {
                            params: {
                                access_token: accessToken,
                                fields: 'id,name,currency,timezone_id,message_template_namespace',
                            },
                        });
                        if (ownedWabaResponse.data.data?.length) {
                            wabas.push(...ownedWabaResponse.data.data);
                        }
                    }
                    catch (e2) {
                        console.log(`[Meta API] No WABAs for business ${business.id}`);
                    }
                }
            }
            try {
                const debugToken = await this.debugToken(accessToken);
                const granularScopes = debugToken.data.granular_scopes || [];
                for (const scope of granularScopes) {
                    if (scope.scope === 'whatsapp_business_management' && scope.target_ids) {
                        for (const wabaId of scope.target_ids) {
                            if (!wabas.find((w) => w.id === wabaId)) {
                                try {
                                    const wabaDetails = await this.getWABADetails(wabaId, accessToken);
                                    if (wabaDetails) {
                                        wabas.push(wabaDetails);
                                    }
                                }
                                catch (e) {
                                    console.log(`[Meta API] Could not fetch WABA ${wabaId}`);
                                }
                            }
                        }
                    }
                }
            }
            catch (e) {
                console.log('[Meta API] Could not get WABAs from debug token');
            }
            console.log(`[Meta API] ✅ Total WABAs found: ${wabas.length}`);
            return wabas;
        }
        catch (error) {
            throw this.handleError(error, 'Failed to get shared WABAs');
        }
    }
    async getWABADetails(wabaId, accessToken) {
        try {
            console.log(`[Meta API] Fetching WABA details for ${wabaId}...`);
            const response = await this.client.get(`${wabaId}`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,name,currency,timezone_id,message_template_namespace,owner_business_info,on_behalf_of_business_info,account_review_status',
                },
            });
            console.log(`[Meta API] ✅ WABA: ${response.data.name}`);
            return response.data;
        }
        catch (error) {
            throw this.handleError(error, 'Failed to get WABA details');
        }
    }
    // ============================================
    // PHONE NUMBER METHODS
    // ============================================
    async getPhoneNumbers(wabaId, accessToken) {
        try {
            console.log(`[Meta API] Fetching phone numbers for WABA ${wabaId}...`);
            const response = await this.client.get(`${wabaId}/phone_numbers`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,verified_name,display_phone_number,quality_rating,code_verification_status,platform_type,throughput,status,name_status,messaging_limit_tier',
                },
            });
            const phoneNumbers = (response.data.data || []).map((phone) => ({
                id: phone.id,
                verifiedName: phone.verified_name,
                displayPhoneNumber: phone.display_phone_number,
                qualityRating: phone.quality_rating,
                codeVerificationStatus: phone.code_verification_status,
                nameStatus: phone.name_status,
                messagingLimitTier: phone.messaging_limit_tier,
                platformType: phone.platform_type,
                throughput: phone.throughput,
                status: phone.status,
            }));
            console.log(`[Meta API] ✅ Found ${phoneNumbers.length} phone numbers`);
            return phoneNumbers;
        }
        catch (error) {
            throw this.handleError(error, 'Failed to get phone numbers');
        }
    }
    async getPhoneNumberDetails(phoneNumberId, accessToken) {
        try {
            console.log(`[Meta API] Fetching phone number details for ${phoneNumberId}...`);
            const response = await this.client.get(`${phoneNumberId}`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,verified_name,display_phone_number,quality_rating,code_verification_status,name_status',
                },
            });
            const data = response.data;
            return {
                id: data.id,
                verifiedName: data.verified_name,
                displayPhoneNumber: data.display_phone_number,
                qualityRating: data.quality_rating,
                codeVerificationStatus: data.code_verification_status,
                nameStatus: data.name_status,
            };
        }
        catch (error) {
            throw this.handleError(error, 'Failed to get phone number details');
        }
    }
    async registerPhoneNumber(phoneNumberId, accessToken) {
        try {
            console.log(`[Meta API] Registering phone number ${phoneNumberId}...`);
            const response = await this.client.post(`${phoneNumberId}/register`, {
                messaging_product: 'whatsapp',
                pin: '123456',
            }, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            console.log('[Meta API] ✅ Phone number registered');
            return response.data.success === true;
        }
        catch (error) {
            if (error.response?.data?.error?.code === 10) {
                console.log('[Meta API] Phone number already registered');
                return true;
            }
            throw this.handleError(error, 'Failed to register phone number');
        }
    }
    // ============================================
    // WHATSAPP PROFILE METHODS
    // ============================================
    /**
     * ✅ Extract WhatsApp profile from incoming webhook
     * This is the MOST RELIABLE method to get real names
     * Called when processing incoming messages
     */
    extractProfileFromWebhook(webhookData) {
        try {
            const entry = webhookData.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;
            if (!value)
                return null;
            // From incoming message
            if (value.messages?.[0]) {
                const message = value.messages[0];
                const contact = value.contacts?.[0];
                return {
                    waId: message.from,
                    profileName: contact?.profile?.name || 'Unknown',
                    phone: message.from.startsWith('+') ? message.from : '+' + message.from,
                };
            }
            // From status update (also contains contact info sometimes)
            if (value.statuses?.[0]) {
                const status = value.statuses[0];
                const contact = value.contacts?.[0];
                if (contact) {
                    return {
                        waId: status.recipient_id,
                        profileName: contact?.profile?.name || 'Unknown',
                        phone: status.recipient_id.startsWith('+')
                            ? status.recipient_id
                            : '+' + status.recipient_id,
                    };
                }
            }
            return null;
        }
        catch (error) {
            console.error('[Meta API] Error extracting profile from webhook:', error);
            return null;
        }
    }
    /**
     * ✅ Get WhatsApp contact profile
     * Uses the Contacts API to check if number exists and get profile
     */
    async getContactProfile(phoneNumberId, accessToken, phone) {
        try {
            const cleanPhone = phone.replace(/[^0-9]/g, '');
            console.log(`[Meta API] Fetching profile for: ${cleanPhone.substring(0, 5)}...`);
            const response = await this.client.post(`${phoneNumberId}/contacts`, {
                messaging_product: 'whatsapp',
                blocking: 'wait',
                force_check: true,
                contacts: [cleanPhone],
            }, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const contact = response.data.contacts?.[0];
            if (!contact) {
                return { exists: false };
            }
            const result = {
                exists: contact.status === 'valid',
                waId: contact.wa_id,
                status: contact.status,
                profileName: undefined,
            };
            console.log(`[Meta API] Contact ${contact.status}: ${contact.wa_id}`);
            return result;
        }
        catch (error) {
            const metaError = error.response?.data?.error;
            if (metaError?.code === 100 && metaError?.error_subcode === 33) {
                return { exists: true, waId: phone.replace(/[^0-9]/g, ''), status: 'valid' };
            }
            console.error('[Meta API] Failed to get contact profile:', error.response?.data || error.message);
            return { exists: false };
        }
    }
    /**
     * ✅ Batch check multiple contacts
     * Check up to 50 contacts at once
     */
    async batchCheckContacts(phoneNumberId, accessToken, phones) {
        try {
            const cleanPhones = phones
                .map(p => p.replace(/[^0-9]/g, ''))
                .filter(p => p.length >= 10)
                .slice(0, 50);
            if (cleanPhones.length === 0) {
                return [];
            }
            console.log(`[Meta API] Batch checking ${cleanPhones.length} contacts...`);
            const response = await this.client.post(`${phoneNumberId}/contacts`, {
                messaging_product: 'whatsapp',
                blocking: 'wait',
                force_check: true,
                contacts: cleanPhones,
            }, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const contacts = response.data.contacts || [];
            console.log(`[Meta API] ✅ Checked ${contacts.length} contacts`);
            return contacts.map((contact) => ({
                input: contact.input,
                waId: contact.wa_id,
                status: contact.status,
            }));
        }
        catch (error) {
            const metaError = error.response?.data?.error;
            if (metaError?.code === 100 && metaError?.error_subcode === 33) {
                return phones.map(p => ({
                    input: p.replace(/[^0-9]/g, ''),
                    waId: p.replace(/[^0-9]/g, ''),
                    status: 'valid'
                }));
            }
            console.error('[Meta API] Batch contact check failed:', error.response?.data || error.message);
            throw this.handleError(error, 'Failed to batch check contacts');
        }
    }
    /**
     * ✅ Get contact profile from message send response
     */
    extractContactFromMessageResponse(messageResponse) {
        try {
            const contact = messageResponse.contacts?.[0];
            if (!contact) {
                return null;
            }
            return {
                waId: contact.wa_id,
                input: contact.input,
            };
        }
        catch (error) {
            console.error('[Meta API] Failed to extract contact from message response');
            return null;
        }
    }
    /**
     * ⚠️ Get profile picture URL
     * NOTE: This typically requires special permissions and may not work
     */
    async getProfilePictureUrl(phoneNumberId, accessToken, waId) {
        try {
            console.log(`[Meta API] Attempting to get profile picture for ${waId}...`);
            const response = await this.client.get(`${waId}/profile_picture`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            return response.data.url || null;
        }
        catch (error) {
            console.warn('[Meta API] Profile picture not accessible:', error.response?.data?.error?.message);
            return null;
        }
    }
    // ============================================
    // CONTACT VALIDATION
    // ============================================
    async checkContact(phoneNumberId, accessToken, phone) {
        try {
            const clean = phone.replace(/[^0-9]/g, '');
            console.log(`📞 Checking contact: ${clean}`);
            const response = await this.client.post(`${phoneNumberId}/contacts`, {
                messaging_product: 'whatsapp',
                blocking: 'wait',
                force_check: true,
                contacts: [clean],
            }, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const result = response.data;
            const status = result.contacts?.[0]?.status;
            console.log(`📞 Contact check result: ${status}`);
            return result;
        }
        catch (error) {
            const metaError = error.response?.data?.error;
            // Handle "Unsupported post request" (code 100, subcode 33)
            if (metaError?.code === 100 && metaError?.error_subcode === 33) {
                console.warn(`[Meta API] Contact check not supported for ID ${phoneNumberId}. Bypassing.`);
                return {
                    contacts: [{
                            input: phone.replace(/[^0-9]/g, ''),
                            wa_id: phone.replace(/[^0-9]/g, ''),
                            status: 'valid'
                        }]
                };
            }
            console.error('[Meta API] Contact check failed:', error.response?.data || error.message);
            throw this.handleError(error, 'Failed to check contact');
        }
    }
    // ============================================
    // WEBHOOK METHODS
    // ============================================
    async subscribeToWebhooks(wabaId, accessToken) {
        try {
            console.log(`[Meta API] Subscribing to webhooks for WABA ${wabaId}...`);
            const response = await this.client.post(`${wabaId}/subscribed_apps`, null, {
                params: {
                    access_token: accessToken,
                },
            });
            const success = response.data.success === true;
            console.log(`[Meta API] ${success ? '✅' : '❌'} Webhook subscription: ${success}`);
            return success;
        }
        catch (error) {
            throw this.handleError(error, 'Failed to subscribe to webhooks');
        }
    }
    async unsubscribeFromWebhooks(wabaId, accessToken) {
        try {
            console.log(`[Meta API] Unsubscribing from webhooks for WABA ${wabaId}...`);
            const response = await this.client.delete(`${wabaId}/subscribed_apps`, {
                params: {
                    access_token: accessToken,
                },
            });
            return response.data.success === true;
        }
        catch (error) {
            throw this.handleError(error, 'Failed to unsubscribe from webhooks');
        }
    }
    // ============================================
    // BUSINESS PROFILE
    // ============================================
    async getBusinessProfile(phoneNumberId, accessToken) {
        try {
            console.log(`[Meta API] Fetching business profile for ${phoneNumberId}...`);
            const response = await this.client.get(`${phoneNumberId}/whatsapp_business_profile`, {
                params: {
                    access_token: accessToken,
                    fields: 'about,address,description,email,profile_picture_url,websites,vertical',
                },
            });
            return response.data.data?.[0] || {};
        }
        catch (error) {
            throw this.handleError(error, 'Failed to get business profile');
        }
    }
    async updateBusinessProfile(phoneNumberId, accessToken, profile) {
        try {
            console.log(`[Meta API] Updating business profile for ${phoneNumberId}...`);
            const response = await this.client.post(`${phoneNumberId}/whatsapp_business_profile`, {
                messaging_product: 'whatsapp',
                ...profile,
            }, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            return response.data.success === true;
        }
        catch (error) {
            throw this.handleError(error, 'Failed to update business profile');
        }
    }
    // ============================================
    // MESSAGING
    // ============================================
    async sendMessage(phoneNumberId, accessToken, to, message) {
        try {
            const cleanTo = to.replace(/[^0-9]/g, '');
            console.log(`[Meta API] Sending message to ${cleanTo.substring(0, 5)}...`);
            const payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: cleanTo,
                ...message,
            };
            const response = await this.client.post(`${phoneNumberId}/messages`, payload, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            const messageId = response.data.messages?.[0]?.id;
            console.log(`[Meta API] ✅ Message sent: ${messageId}`);
            return {
                messageId: messageId,
                contacts: response.data.contacts,
            };
        }
        catch (error) {
            console.error('[Meta API] ❌ Failed to send message');
            throw this.handleError(error, 'Failed to send message');
        }
    }
    /**
     * ✅ Enhanced send message with contact extraction
     */
    async sendMessageWithContactInfo(phoneNumberId, accessToken, to, message) {
        try {
            const cleanTo = to.replace(/[^0-9]/g, '');
            console.log(`[Meta API] Sending message to ${cleanTo.substring(0, 5)}...`);
            const payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: cleanTo,
                ...message,
            };
            const response = await this.client.post(`/${phoneNumberId}/messages`, payload, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            const messageId = response.data.messages?.[0]?.id;
            const contact = this.extractContactFromMessageResponse(response.data);
            console.log(`[Meta API] ✅ Message sent: ${messageId}`);
            return {
                messageId,
                contact: contact || undefined,
            };
        }
        catch (error) {
            console.error('[Meta API] ❌ Failed to send message');
            throw this.handleError(error, 'Failed to send message');
        }
    }
    async markMessageAsRead(phoneNumberId, accessToken, messageId) {
        try {
            const response = await this.client.post(`/${phoneNumberId}/messages`, {
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: messageId,
            }, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            return response.data.success === true;
        }
        catch (error) {
            console.error('[Meta API] Failed to mark message as read:', error.message);
            return false;
        }
    }
    // ============================================
    // TEMPLATES
    // ============================================
    async getTemplates(wabaId, accessToken) {
        try {
            console.log(`[Meta API] Fetching templates for WABA ${wabaId}...`);
            const allTemplates = [];
            let url = `/${wabaId}/message_templates`;
            let hasMore = true;
            while (hasMore) {
                const response = await this.client.get(url, {
                    params: {
                        access_token: accessToken,
                        fields: 'id,name,status,category,language,components,quality_score,rejected_reason',
                        limit: 100,
                    },
                });
                const templates = response.data.data || [];
                allTemplates.push(...templates);
                if (response.data.paging?.next) {
                    url = response.data.paging.next;
                }
                else {
                    hasMore = false;
                }
            }
            console.log(`[Meta API] ✅ Found ${allTemplates.length} templates`);
            return allTemplates;
        }
        catch (error) {
            throw this.handleError(error, 'Failed to get templates');
        }
    }
    async getTemplate(templateId, accessToken) {
        try {
            const response = await this.client.get(`/${templateId}`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,name,status,category,language,components,quality_score,rejected_reason',
                },
            });
            return response.data;
        }
        catch (error) {
            throw this.handleError(error, 'Failed to get template');
        }
    }
    async createTemplate(wabaId, accessToken, template) {
        try {
            console.log(`[Meta API] Creating template: ${template.name}...`);
            const response = await this.client.post(`/${wabaId}/message_templates`, {
                ...template,
                allow_category_change: template.allow_category_change ?? true,
            }, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            console.log(`[Meta API] ✅ Template created: ${response.data.id}`);
            return {
                id: response.data.id,
                status: response.data.status,
            };
        }
        catch (error) {
            throw this.handleError(error, 'Failed to create template');
        }
    }
    async deleteTemplate(wabaId, accessToken, templateName) {
        try {
            console.log(`[Meta API] Deleting template: ${templateName}...`);
            const response = await this.client.delete(`/${wabaId}/message_templates`, {
                params: {
                    access_token: accessToken,
                    name: templateName,
                },
            });
            console.log(`[Meta API] ✅ Template deleted: ${templateName}`);
            return response.data.success === true;
        }
        catch (error) {
            throw this.handleError(error, 'Failed to delete template');
        }
    }
    // ============================================
    // MEDIA
    // ============================================
    async uploadMedia(phoneNumberId, accessToken, file, mimeType, filename) {
        try {
            console.log(`[Meta API] Uploading media: ${filename}...`);
            const FormData = require('form-data');
            const formData = new FormData();
            formData.append('messaging_product', 'whatsapp');
            formData.append('file', file, {
                filename: filename,
                contentType: mimeType,
            });
            const response = await this.client.post(`/${phoneNumberId}/media`, formData, {
                headers: {
                    ...formData.getHeaders(),
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            console.log(`[Meta API] ✅ Media uploaded: ${response.data.id}`);
            return { id: response.data.id };
        }
        catch (error) {
            throw this.handleError(error, 'Failed to upload media');
        }
    }
    async getMediaUrl(mediaId, accessToken) {
        try {
            const response = await this.client.get(`/${mediaId}`, {
                params: {
                    access_token: accessToken,
                },
            });
            return response.data.url;
        }
        catch (error) {
            throw this.handleError(error, 'Failed to get media URL');
        }
    }
    async downloadMedia(mediaUrl, accessToken) {
        try {
            const response = await axios_1.default.get(mediaUrl, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                responseType: 'arraybuffer',
            });
            return Buffer.from(response.data);
        }
        catch (error) {
            throw this.handleError(error, 'Failed to download media');
        }
    }
    // ============================================
    // ANALYTICS
    // ============================================
    async getAnalytics(wabaId, accessToken, params) {
        try {
            console.log(`[Meta API] Fetching analytics for WABA ${wabaId}...`);
            const response = await this.client.get(`${wabaId}/analytics`, {
                params: {
                    access_token: accessToken,
                    start: params.start,
                    end: params.end,
                    granularity: params.granularity,
                    metric_types: params.metrics?.join(',') || 'sent,delivered,read',
                },
            });
            return response.data;
        }
        catch (error) {
            throw this.handleError(error, 'Failed to get analytics');
        }
    }
    // ============================================
    // ERROR HANDLING
    // ============================================
    handleError(error, defaultMessage) {
        if (error.response?.data?.error) {
            const metaError = error.response.data.error;
            let errorMessage = metaError.message || defaultMessage;
            if (metaError.code) {
                errorMessage += ` (Error Code: ${metaError.code})`;
            }
            if (metaError.error_subcode) {
                errorMessage += ` (Subcode: ${metaError.error_subcode})`;
            }
            const errorCodes = {
                1: 'Unknown error occurred',
                2: 'Service temporarily unavailable',
                4: 'Application request limit reached',
                10: 'Permission denied',
                100: 'Invalid parameter',
                190: 'Invalid access token',
                200: 'Permission error',
                368: 'Temporarily blocked for policy violations',
                2388001: 'Phone number not verified',
                2388002: 'Message template not found',
                131030: 'Phone number not registered',
                131031: 'Phone number not in correct format',
            };
            if (metaError.code && errorCodes[metaError.code]) {
                errorMessage = `${errorCodes[metaError.code]}: ${metaError.message}`;
            }
            return new Error(errorMessage);
        }
        if (error.code === 'ECONNABORTED') {
            return new Error('Request timeout - Meta API took too long to respond');
        }
        if (error.code === 'ENOTFOUND') {
            return new Error('Network error - Could not reach Meta API');
        }
        return new Error(error.message || defaultMessage);
    }
    // ============================================
    // UTILITY
    // ============================================
    async isTokenValid(accessToken) {
        try {
            const debugInfo = await this.debugToken(accessToken);
            return debugInfo.data.is_valid === true;
        }
        catch {
            return false;
        }
    }
    async getTokenExpiry(accessToken) {
        try {
            const debugInfo = await this.debugToken(accessToken);
            if (debugInfo.data.expires_at) {
                return new Date(debugInfo.data.expires_at * 1000);
            }
            return null;
        }
        catch {
            return null;
        }
    }
    getGraphVersion() {
        return this.graphVersion;
    }
}
exports.metaApi = new MetaApiClient();
exports.default = exports.metaApi;
//# sourceMappingURL=meta.api.js.map
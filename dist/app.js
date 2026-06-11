"use strict";
// src/app.ts - COMPLETE FINAL VERSION WITH WEBHOOK FIX
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
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const errorHandler_1 = require("./middleware/errorHandler");
const requestLogger_1 = require("./middleware/requestLogger");
const logger_1 = require("./utils/logger");
// ============================================
// IMPORT ALL ROUTES
// ============================================
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const contacts_routes_1 = __importDefault(require("./modules/contacts/contacts.routes"));
const campaigns_routes_1 = __importDefault(require("./modules/campaigns/campaigns.routes"));
const templates_routes_1 = __importDefault(require("./modules/templates/templates.routes"));
const webhook_routes_1 = __importDefault(require("./modules/webhooks/webhook.routes"));
const dashboard_routes_1 = __importDefault(require("./modules/dashboard/dashboard.routes"));
const organizations_routes_1 = __importDefault(require("./modules/organizations/organizations.routes"));
const users_routes_1 = __importDefault(require("./modules/users/users.routes"));
const meta_routes_1 = __importDefault(require("./modules/meta/meta.routes"));
const whatsapp_routes_1 = __importDefault(require("./modules/whatsapp/whatsapp.routes"));
const chatbot_routes_1 = __importDefault(require("./modules/chatbot/chatbot.routes"));
const inbox_routes_1 = __importDefault(require("./modules/inbox/inbox.routes"));
const billing_routes_1 = __importDefault(require("./modules/billing/billing.routes"));
const admin_routes_1 = __importDefault(require("./modules/admin/admin.routes"));
const analytics_routes_1 = __importDefault(require("./modules/analytics/analytics.routes"));
const crm_routes_1 = __importDefault(require("./modules/crm/crm.routes"));
const automation_routes_1 = __importDefault(require("./modules/automation/automation.routes"));
const calling_routes_1 = __importDefault(require("./modules/calling/calling.routes"));
const wallet_routes_1 = __importDefault(require("./modules/wallet/wallet.routes"));
const instagram_routes_1 = __importDefault(require("./modules/instagram/instagram.routes"));
// ============================================
// VERIFY IMPORTS
// ============================================
console.log('🔍 Verifying route imports...');
console.log('  webhookRoutes:', typeof webhook_routes_1.default, webhook_routes_1.default !== undefined ? '✅ loaded' : '❌ MISSING');
console.log('  authRoutes:', typeof auth_routes_1.default, auth_routes_1.default !== undefined ? '✅ loaded' : '❌ MISSING');
console.log('  contactsRoutes:', typeof contacts_routes_1.default, contacts_routes_1.default !== undefined ? '✅ loaded' : '❌ MISSING');
console.log('  campaignsRoutes:', typeof campaigns_routes_1.default, campaigns_routes_1.default !== undefined ? '✅ loaded' : '❌ MISSING');
if (webhook_routes_1.default === undefined) {
    console.error('❌ CRITICAL: webhookRoutes failed to import!');
    console.error('   Check: src/modules/webhooks/webhook.routes.ts');
}
const app = (0, express_1.default)();
// ============================================
// TRUST PROXY (for Render/production)
// ============================================
app.set('trust proxy', 1);
// ============================================
// SECURITY MIDDLEWARE
// ============================================
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'none'"],
            scriptSrc: ["'none'"],
            styleSrc: ["'none'"],
            imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com"],
            connectSrc: ["'self'"],
            frameAncestors: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow loading media on different domains
}));
// ============================================
// CORS CONFIGURATION
// ============================================
const allowedOrigins = [
    'https://wabmeta.com',
    'https://www.wabmeta.com',
    'http://localhost:5173',
    'http://localhost:3000',
];
console.log('🔒 CORS Allowed Origins:', allowedOrigins);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // ✅ No origin (mobile apps, postman, Meta webhooks)
        if (!origin)
            return callback(null, true);
        const isVercel = origin.endsWith('.vercel.app') || origin.includes('vercel.app');
        if (allowedOrigins.includes(origin) || isVercel) {
            callback(null, true);
        }
        else {
            console.warn(`⚠️ CORS blocked origin: ${origin}`);
            callback(new Error(`CORS blocked: ${origin}`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'authorization',
        'X-Requested-With',
        'X-Organization-Id',
        'x-organization-id',
        'X-Access-Token',
        'x-access-token',
        'Accept',
        'Origin',
        'X-Hub-Signature-256',
    ],
    exposedHeaders: [
        'Content-Range',
        'X-Content-Range',
        'X-Total-Count',
        'x-new-access-token',
        'x-token-refreshed',
    ],
    maxAge: 600,
    optionsSuccessStatus: 204,
}));
// ============================================
// EXPLICIT PREFLIGHT HANDLER
// ============================================
app.options('*', (0, cors_1.default)());
// ============================================
// BODY PARSING
// ============================================
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((0, cookie_parser_1.default)());
// ============================================
// LOGGING
// ============================================
if (process.env.NODE_ENV === 'development') {
    app.use((0, morgan_1.default)('dev'));
}
// Custom request logger (skip webhook to reduce noise)
app.use((req, res, next) => {
    // Skip detailed logging for webhooks
    if (req.path.includes('/webhooks/')) {
        return next();
    }
    return (0, requestLogger_1.requestLogger)(req, res, next);
});
// ============================================
// STATIC FILES
// ============================================
const uploadsDir = path_1.default.join(process.cwd(), 'uploads');
// Create if not exists
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
    console.log('📁 Created uploads directory:', uploadsDir);
}
console.log('📁 Uploads dir:', uploadsDir);
console.log('📁 Uploads exists:', fs_1.default.existsSync(uploadsDir));
// ✅ Serve with CORS
app.use('/uploads', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express_1.default.static(uploadsDir));
// ============================================
// HEALTH CHECK ROUTES
// ============================================
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'WabMeta API Server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});
// ✅ Health check - sabse upar hona chahiye
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
    });
});
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
    });
});
// ============================================
// INLINE WEBHOOK HANDLERS (GUARANTEED TO WORK)
// ============================================
// GET /api/webhooks/meta - Webhook Verification
app.get('/api/webhooks/meta', (req, res) => {
    console.log('📞 GET /api/webhooks/meta - Verification request');
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    console.log('  Params:', { mode, token: token ? 'present' : 'missing' });
    const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN ||
        process.env.WEBHOOK_VERIFY_TOKEN ||
        'wabmeta_webhook_verify_2024';
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook verified, sending challenge');
        res.status(200).send(challenge);
    }
    else {
        console.error('❌ Webhook verification failed');
        console.error(`  Expected token: ${VERIFY_TOKEN}`);
        console.error(`  Received token: ${token}`);
        res.status(403).send('Forbidden');
    }
});
// POST /api/webhooks/meta - Receive WhatsApp Messages
app.post('/api/webhooks/meta', async (req, res) => {
    console.log('📥 POST /api/webhooks/meta - Webhook received');
    // Respond immediately to Meta (required within 5 seconds)
    res.status(200).send('EVENT_RECEIVED');
    try {
        // Import webhook service dynamically to avoid circular dependency issues
        const { webhookService } = await Promise.resolve().then(() => __importStar(require('./modules/webhooks/webhook.service')));
        console.log('📨 Processing webhook payload...');
        // Process webhook
        const result = await webhookService.handleWebhook(req.body);
        // Log webhook
        await webhookService.logWebhook(req.body, result.status, result.error || result.reason);
        console.log('✅ Webhook processed:', result);
    }
    catch (error) {
        console.error('❌ Webhook processing error:', error.message);
        // Try to log the error
        try {
            const { webhookService } = await Promise.resolve().then(() => __importStar(require('./modules/webhooks/webhook.service')));
            await webhookService.logWebhook(req.body, 'failed', error.message);
        }
        catch (logError) {
            console.error('Failed to log webhook error:', logError);
        }
    }
});
// Test route for webhook
app.get('/api/webhooks/test', (req, res) => {
    console.log('✅ GET /api/webhooks/test - Test route hit');
    res.json({
        success: true,
        message: 'Webhook routes are working!',
        timestamp: new Date().toISOString(),
    });
});
console.log('✅ Inline webhook handlers registered');
// ============================================
// API ROUTES
// ============================================
// Support for legacy/misconfigured frontend paths (/api/v1/api/* -> /api/*)
app.use((req, res, next) => {
    if (req.url.startsWith('/api/v1/api')) {
        req.url = req.url.replace('/api/v1/api', '/api');
    }
    next();
});
console.log('🔧 Registering API routes...');
try {
    // Test route
    app.get('/api/test', (req, res) => {
        res.json({ success: true, message: 'API is working' });
    });
    console.log('  ✅ /api/test');
    // Public routes
    app.use('/api/auth', auth_routes_1.default);
    console.log('  ✅ /api/auth');
    // Note: /api/webhooks is handled by inline handlers above
    // But we still mount the router for any additional routes
    if (webhook_routes_1.default !== undefined) {
        app.use('/api/webhooks', webhook_routes_1.default);
        console.log('  ✅ /api/webhooks (router)');
    }
    // Protected routes
    app.use('/api/contacts', contacts_routes_1.default);
    console.log('  ✅ /api/contacts');
    app.use('/api/campaigns', campaigns_routes_1.default);
    console.log('  ✅ /api/campaigns');
    app.use('/api/templates', templates_routes_1.default);
    console.log('  ✅ /api/templates');
    app.use('/api/dashboard', dashboard_routes_1.default);
    console.log('  ✅ /api/dashboard');
    app.use('/api/organizations', organizations_routes_1.default);
    console.log('  ✅ /api/organizations');
    app.use('/api/users', users_routes_1.default);
    console.log('  ✅ /api/users');
    app.use('/api/meta', meta_routes_1.default);
    console.log('  ✅ /api/meta');
    app.use('/api/whatsapp', whatsapp_routes_1.default);
    console.log('  ✅ /api/whatsapp');
    app.use('/api/inbox', inbox_routes_1.default);
    console.log('  ✅ /api/inbox');
    app.use('/api/billing', billing_routes_1.default);
    console.log('  ✅ /api/billing');
    app.use('/api/admin', admin_routes_1.default);
    console.log('  ✅ /api/admin');
    app.use('/api/analytics', analytics_routes_1.default);
    console.log('  ✅ /api/analytics');
    app.use('/api/crm', crm_routes_1.default);
    console.log('  ✅ /api/crm');
    app.use('/api/automations', automation_routes_1.default);
    console.log('  ✅ /api/automations');
    app.use('/api/calling', calling_routes_1.default);
    console.log('  ✅ /api/calling');
    app.use('/api/chatbots', chatbot_routes_1.default);
    console.log('  ✅ /api/chatbots');
    app.use('/api', wallet_routes_1.default);
    console.log('  ✅ /api (wallet)');
    app.use('/api/instagram', instagram_routes_1.default);
    console.log('  ✅ /api/instagram');
    logger_1.logger.info('✅ All API routes registered successfully');
}
catch (error) {
    logger_1.logger.error('❌ CRITICAL ERROR registering routes', error);
}
// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
    console.warn(`⚠️ 404: ${req.method} ${req.path}`);
    // Special logging for webhook 404s (should not happen now)
    if (req.path.includes('/webhooks/')) {
        console.error('🔥 WEBHOOK 404 - THIS SHOULD NOT HAPPEN!');
        console.error('Request details:', {
            method: req.method,
            path: req.path,
            fullUrl: req.originalUrl,
            query: req.query,
        });
    }
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.path}`,
    });
});
// ============================================
// ERROR HANDLER
// ============================================
app.use(errorHandler_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map
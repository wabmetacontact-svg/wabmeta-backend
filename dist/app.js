"use strict";
// src/app.ts - FINAL FIXED VERSION
// ✅ FIX 1: Inline webhook handlers REMOVED (duplicate processing fix)
// ✅ FIX 2: GET / simple 'OK' response (Render ping flood fix)
// ✅ FIX 3: Logger skip for health/root paths
// ✅ FIX 4: Clean route registration
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
// ROUTE IMPORTS
// ============================================
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const contacts_routes_1 = __importDefault(require("./modules/contacts/contacts.routes"));
const campaigns_routes_1 = __importDefault(require("./modules/campaigns/campaigns.routes"));
const templates_routes_1 = __importDefault(require("./modules/templates/templates.routes"));
const webhook_routes_1 = __importDefault(require("./modules/webhooks/webhook.routes"));
const wallet_webhook_1 = __importDefault(require("./modules/wallet/wallet.webhook"));
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
const app = (0, express_1.default)();
// ============================================
// TRUST PROXY (Render/production ke liye)
// ============================================
app.set('trust proxy', 1);
// ============================================
// SECURITY
// ============================================
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'none'"],
            scriptSrc: ["'none'"],
            styleSrc: ["'none'"],
            imgSrc: [
                "'self'",
                'data:',
                'blob:',
                'https://res.cloudinary.com',
            ],
            connectSrc: ["'self'"],
            frameAncestors: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
// ============================================
// CORS
// ============================================
const allowedOrigins = [
    'https://wabmeta.com',
    'https://www.wabmeta.com',
    'http://localhost:5173',
    'http://localhost:3000',
];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        const isVercel = origin.endsWith('.vercel.app') || origin.includes('vercel.app');
        if (allowedOrigins.includes(origin) || isVercel) {
            callback(null, true);
        }
        else {
            console.warn(`⚠️ CORS blocked: ${origin}`);
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
app.options('*', (0, cors_1.default)());
// ============================================
// BODY PARSING
// ✅ rawBody capture - webhook signature verify ke liye
// ============================================
app.use(express_1.default.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
        req.rawBody = buf;
    },
}));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((0, cookie_parser_1.default)());
// ============================================
// LOGGING
// ✅ FIX: Root path, health, webhooks skip karo
// ============================================
if (process.env.NODE_ENV === 'development') {
    app.use((0, morgan_1.default)('dev'));
}
app.use((req, res, next) => {
    const skipExact = ['/'];
    const skipPrefix = ['/health', '/api/health', '/api/webhooks'];
    if (skipExact.includes(req.path) ||
        skipPrefix.some((p) => req.path.startsWith(p))) {
        return next();
    }
    return (0, requestLogger_1.requestLogger)(req, res, next);
});
// ============================================
// STATIC FILES
// ============================================
const uploadsDir = path_1.default.join(process.cwd(), 'uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express_1.default.static(uploadsDir));
// ============================================
// HEALTH CHECKS
// ✅ FIX: GET / = simple 'OK' (Render keepalive ping)
// Pehle full JSON tha + 1168ms DB query - ab instant
// ============================================
app.get('/', (_req, res) => {
    res.status(200).send('OK');
});
app.get('/api/health', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
    });
});
app.get('/health', (_req, res) => {
    res.json({
        success: true,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
    });
});
// ============================================
// URL NORMALIZATION
// ============================================
app.use((req, _res, next) => {
    if (req.url.startsWith('/api/v1/api')) {
        req.url = req.url.replace('/api/v1/api', '/api');
    }
    next();
});
// ============================================
// API ROUTES
// ✅ CRITICAL: webhookRoutes SIRF yahan register hai
// app.ts mein koi inline webhook handler NAHI
// Double processing completely removed
// ============================================
app.use('/api/auth', auth_routes_1.default);
app.use('/api/webhooks', wallet_webhook_1.default);
app.use('/api/webhooks', webhook_routes_1.default);
app.use('/api/contacts', contacts_routes_1.default);
app.use('/api/campaigns', campaigns_routes_1.default);
app.use('/api/templates', templates_routes_1.default);
app.use('/api/dashboard', dashboard_routes_1.default);
app.use('/api/organizations', organizations_routes_1.default);
app.use('/api/users', users_routes_1.default);
app.use('/api/meta', meta_routes_1.default);
app.use('/api/whatsapp', whatsapp_routes_1.default);
app.use('/api/inbox', inbox_routes_1.default);
app.use('/api/billing', billing_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
app.use('/api/analytics', analytics_routes_1.default);
app.use('/api/crm', crm_routes_1.default);
app.use('/api/automations', automation_routes_1.default);
app.use('/api/calling', calling_routes_1.default);
app.use('/api/chatbots', chatbot_routes_1.default);
app.use('/api', wallet_routes_1.default);
app.use('/api/instagram', instagram_routes_1.default);
logger_1.logger.info('✅ All API routes registered');
// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
    if (req.path.includes('/webhooks/')) {
        console.error('🔥 WEBHOOK 404:', req.method, req.path);
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
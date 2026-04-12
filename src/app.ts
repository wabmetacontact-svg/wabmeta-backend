// src/app.ts - COMPLETE FINAL VERSION WITH WEBHOOK FIX

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { logger } from './utils/logger';

// ============================================
// IMPORT ALL ROUTES
// ============================================
import authRoutes from './modules/auth/auth.routes';
import contactsRoutes from './modules/contacts/contacts.routes';
import campaignsRoutes from './modules/campaigns/campaigns.routes';
import templatesRoutes from './modules/templates/templates.routes';
import webhookRoutes from './modules/webhooks/webhook.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import organizationsRoutes from './modules/organizations/organizations.routes';
import usersRoutes from './modules/users/users.routes';
import metaRoutes from './modules/meta/meta.routes';
import whatsappRoutes from './modules/whatsapp/whatsapp.routes';
import chatbotRoutes from './modules/chatbot/chatbot.routes';
import inboxRoutes from './modules/inbox/inbox.routes';
import billingRoutes from './modules/billing/billing.routes';
import adminRoutes from './modules/admin/admin.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import crmRoutes from './modules/crm/crm.routes';
import automationRoutes from './modules/automation/automation.routes';


// ============================================
// VERIFY IMPORTS
// ============================================
console.log('🔍 Verifying route imports...');
console.log('  webhookRoutes:', typeof webhookRoutes, webhookRoutes !== undefined ? '✅ loaded' : '❌ MISSING');
console.log('  authRoutes:', typeof authRoutes, authRoutes !== undefined ? '✅ loaded' : '❌ MISSING');
console.log('  contactsRoutes:', typeof contactsRoutes, contactsRoutes !== undefined ? '✅ loaded' : '❌ MISSING');
console.log('  campaignsRoutes:', typeof campaignsRoutes, campaignsRoutes !== undefined ? '✅ loaded' : '❌ MISSING');

if (webhookRoutes === undefined) {
  console.error('❌ CRITICAL: webhookRoutes failed to import!');
  console.error('   Check: src/modules/webhooks/webhook.routes.ts');
}

const app: Application = express();

// ============================================
// TRUST PROXY (for Render/production)
// ============================================
app.set('trust proxy', 1);

// ============================================
// SECURITY MIDDLEWARE
// ============================================
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow loading media on different domains
  })
);

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

app.use(
  cors({
    origin: (origin, callback) => {
      // ✅ No origin (mobile apps, postman, Meta webhooks)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
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
  })
);

// ============================================
// EXPLICIT PREFLIGHT HANDLER
// ============================================
app.options('*', cors());

// ============================================
// BODY PARSING
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ============================================
// LOGGING
// ============================================
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Custom request logger (skip webhook to reduce noise)
app.use((req: Request, res: Response, next: NextFunction) => {
  // Skip detailed logging for webhooks
  if (req.path.includes('/webhooks/')) {
    return next();
  }
  return requestLogger(req, res, next);
});

// ============================================
// STATIC FILES
// ============================================
const uploadsDir = path.join(process.cwd(), 'uploads');

// Create if not exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory:', uploadsDir);
}

console.log('📁 Uploads dir:', uploadsDir);
console.log('📁 Uploads exists:', fs.existsSync(uploadsDir));

// ✅ Serve with CORS
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(uploadsDir));

// ============================================
// HEALTH CHECK ROUTES
// ============================================
app.get('/', (req: Request, res: Response) => {
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

app.get('/health', (req: Request, res: Response) => {
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
app.get('/api/webhooks/meta', (req: Request, res: Response) => {
  console.log('📞 GET /api/webhooks/meta - Verification request');

  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  console.log('  Params:', { mode, token: token ? 'present' : 'missing' });

  const VERIFY_TOKEN =
    process.env.META_VERIFY_TOKEN ||
    process.env.WEBHOOK_VERIFY_TOKEN ||
    'wabmeta_webhook_verify_2024';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified, sending challenge');
    res.status(200).send(challenge);
  } else {
    console.error('❌ Webhook verification failed');
    console.error(`  Expected token: ${VERIFY_TOKEN}`);
    console.error(`  Received token: ${token}`);
    res.status(403).send('Forbidden');
  }
});

// POST /api/webhooks/meta - Receive WhatsApp Messages
app.post('/api/webhooks/meta', async (req: Request, res: Response) => {
  console.log('📥 POST /api/webhooks/meta - Webhook received');

  // Respond immediately to Meta (required within 5 seconds)
  res.status(200).send('EVENT_RECEIVED');

  try {
    // Import webhook service dynamically to avoid circular dependency issues
    const { webhookService } = await import('./modules/webhooks/webhook.service');

    console.log('📨 Processing webhook payload...');

    // Process webhook
    const result = await webhookService.handleWebhook(req.body);

    // Log webhook
    await webhookService.logWebhook(req.body, result.status, result.error || result.reason);

    console.log('✅ Webhook processed:', result);
  } catch (error: any) {
    console.error('❌ Webhook processing error:', error.message);

    // Try to log the error
    try {
      const { webhookService } = await import('./modules/webhooks/webhook.service');
      await webhookService.logWebhook(req.body, 'failed', error.message);
    } catch (logError) {
      console.error('Failed to log webhook error:', logError);
    }
  }
});

// Test route for webhook
app.get('/api/webhooks/test', (req: Request, res: Response) => {
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
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.url.startsWith('/api/v1/api')) {
    req.url = req.url.replace('/api/v1/api', '/api');
  }
  next();
});

console.log('🔧 Registering API routes...');

try {
  // Test route
  app.get('/api/test', (req: Request, res: Response) => {
    res.json({ success: true, message: 'API is working' });
  });
  console.log('  ✅ /api/test');

  // Public routes
  app.use('/api/auth', authRoutes);
  console.log('  ✅ /api/auth');

  // Note: /api/webhooks is handled by inline handlers above
  // But we still mount the router for any additional routes
  if (webhookRoutes !== undefined) {
    app.use('/api/webhooks', webhookRoutes);
    console.log('  ✅ /api/webhooks (router)');
  }

  // Protected routes
  app.use('/api/contacts', contactsRoutes);
  console.log('  ✅ /api/contacts');

  app.use('/api/campaigns', campaignsRoutes);
  console.log('  ✅ /api/campaigns');

  app.use('/api/templates', templatesRoutes);
  console.log('  ✅ /api/templates');

  app.use('/api/dashboard', dashboardRoutes);
  console.log('  ✅ /api/dashboard');

  app.use('/api/organizations', organizationsRoutes);
  console.log('  ✅ /api/organizations');

  app.use('/api/users', usersRoutes);
  console.log('  ✅ /api/users');

  app.use('/api/meta', metaRoutes);
  console.log('  ✅ /api/meta');

  app.use('/api/whatsapp', whatsappRoutes);
  console.log('  ✅ /api/whatsapp');


  app.use('/api/inbox', inboxRoutes);
  console.log('  ✅ /api/inbox');

  app.use('/api/billing', billingRoutes);
  console.log('  ✅ /api/billing');

  app.use('/api/admin', adminRoutes);
  console.log('  ✅ /api/admin');

  app.use('/api/analytics', analyticsRoutes);
  console.log('  ✅ /api/analytics');

  app.use('/api/crm', crmRoutes);
  console.log('  ✅ /api/crm');

  app.use('/api/automations', automationRoutes);
  console.log('  ✅ /api/automations');

  app.use('/api/chatbots', chatbotRoutes);
  console.log('  ✅ /api/chatbots');

  logger.info('✅ All API routes registered successfully');
} catch (error: any) {
  logger.error('❌ CRITICAL ERROR registering routes', error);
}

// ============================================
// 404 HANDLER
// ============================================
app.use((req: Request, res: Response) => {
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
app.use(errorHandler);

export default app;
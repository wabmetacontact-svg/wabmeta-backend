// src/app.ts - FINAL FIXED VERSION
// ✅ FIX 1: Inline webhook handlers REMOVED (duplicate processing fix)
// ✅ FIX 2: GET / simple 'OK' response (Render ping flood fix)
// ✅ FIX 3: Logger skip for health/root paths
// ✅ FIX 4: Clean route registration

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { logger } from './utils/logger';

// ============================================
// ROUTE IMPORTS
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
import callingRoutes from './modules/calling/calling.routes';
import walletRoutes from './modules/wallet/wallet.routes';
import instagramRoutes from './modules/instagram/instagram.routes';

const app: Application = express();

// ============================================
// TRUST PROXY (Render/production ke liye)
// ============================================
app.set('trust proxy', 1);

// ============================================
// SECURITY
// ============================================
app.use(
  helmet({
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
  })
);

// ============================================
// CORS
// ============================================
const allowedOrigins = [
  'https://wabmeta.com',
  'https://www.wabmeta.com',
  'http://localhost:5173',
  'http://localhost:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isVercel =
        origin.endsWith('.vercel.app') || origin.includes('vercel.app');
      if (allowedOrigins.includes(origin) || isVercel) {
        callback(null, true);
      } else {
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
  })
);

app.options('*', cors());

// ============================================
// BODY PARSING
// ✅ rawBody capture - webhook signature verify ke liye
// ============================================
app.use(
  express.json({
    limit: '10mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ============================================
// LOGGING
// ✅ FIX: Root path, health, webhooks skip karo
// ============================================
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use((req: Request, res: Response, next: NextFunction) => {
  const skipExact = ['/'];
  const skipPrefix = ['/health', '/api/health', '/api/webhooks'];

  if (
    skipExact.includes(req.path) ||
    skipPrefix.some((p) => req.path.startsWith(p))
  ) {
    return next();
  }

  return requestLogger(req, res, next);
});

// ============================================
// STATIC FILES
// ============================================
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(uploadsDir)
);

// ============================================
// HEALTH CHECKS
// ✅ FIX: GET / = simple 'OK' (Render keepalive ping)
// Pehle full JSON tha + 1168ms DB query - ab instant
// ============================================
app.get('/', (_req: Request, res: Response) => {
  res.status(200).send('OK');
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

app.get('/health', (_req: Request, res: Response) => {
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
app.use((req: Request, _res: Response, next: NextFunction) => {
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
app.use('/api/auth', authRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/calling', callingRoutes);
app.use('/api/chatbots', chatbotRoutes);
app.use('/api', walletRoutes);
app.use('/api/instagram', instagramRoutes);

logger.info('✅ All API routes registered');

// ============================================
// 404 HANDLER
// ============================================
app.use((req: Request, res: Response) => {
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
app.use(errorHandler);

export default app;
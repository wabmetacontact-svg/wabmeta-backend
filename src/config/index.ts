// src/config/index.ts - COMPLETE

import dotenv from 'dotenv';

dotenv.config();

const getEnv = (key: string, defaultValue?: string): string => {
  return process.env[key] || defaultValue || '';
};

export const config = {
  // App
  app: {
    name: 'WabMeta',
    env: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
    port: parseInt(process.env.PORT || '5000', 10),
    isDevelopment: process.env.NODE_ENV !== 'production',
    isProduction: process.env.NODE_ENV === 'production',
  },

  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  database: {
    url: getEnv('DATABASE_URL'),
  },
  databaseUrl: getEnv('DATABASE_URL'),

  // Frontend
  frontendUrl: getEnv('FRONTEND_URL', 'http://localhost:5173'),
  frontend: {
    url: getEnv('FRONTEND_URL', 'http://localhost:5173'),
    corsOrigins: [
      'https://wabmeta.com',
      'https://www.wabmeta.com',
      'http://localhost:3000',
      'http://localhost:5173',
    ],
  },

  // JWT
  jwt: {
    secret: getEnv('JWT_SECRET', 'your-secret-key-change-in-production'),
    accessSecret: getEnv('JWT_ACCESS_SECRET', getEnv('JWT_SECRET', 'access-secret')),
    refreshSecret: getEnv('JWT_REFRESH_SECRET', getEnv('JWT_SECRET', 'refresh-secret')),
    accessExpiresIn: getEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
    expiresIn: getEnv('JWT_EXPIRES_IN', '7d'),
  },
  jwtSecret: getEnv('JWT_SECRET', 'your-secret-key-change-in-production'),

  // Encryption
  encryption: {
    key: getEnv('ENCRYPTION_KEY', 'your-32-character-encryption-key!'),
  },
  encryptionKey: getEnv('ENCRYPTION_KEY', 'your-32-character-encryption-key!'),

  // Meta
  meta: {
    appId: getEnv('META_APP_ID'),
    appSecret: getEnv('META_APP_SECRET'),
    webhookVerifyToken: getEnv('META_VERIFY_TOKEN', getEnv('WEBHOOK_VERIFY_TOKEN', 'webhook-token')),
    configId: getEnv('META_CONFIG_ID'),
    redirectUri: getEnv('META_REDIRECT_URI', 'https://wabmeta.com/meta/callback'),
    graphApiVersion: getEnv('META_GRAPH_API_VERSION', 'v22.0'),
  },

  // Google OAuth
  google: {
    clientId: getEnv('GOOGLE_CLIENT_ID'),
    clientSecret: getEnv('GOOGLE_CLIENT_SECRET'),
    redirectUri: getEnv('GOOGLE_REDIRECT_URI', 'https://wabmeta.com/api/v1/auth/google/callback'),
  },

  // Email
  email: {
    enabled: getEnv('EMAIL_ENABLED') === 'true',
    resendApiKey: getEnv('RESEND_API_KEY'),
    from: getEnv('EMAIL_FROM', 'noreply@wabmeta.com'),
    fromName: getEnv('EMAIL_FROM_NAME', 'WabMeta'),
    smtp: {
      host: getEnv('SMTP_HOST'),
      port: parseInt(getEnv('SMTP_PORT', '587'), 10),
      auth: {
        user: getEnv('SMTP_USER'),
        pass: getEnv('SMTP_PASS'),
      }
    },
  },

  // Razorpay
  razorpay: {
    keyId: getEnv('RAZORPAY_KEY_ID'),
    keySecret: getEnv('RAZORPAY_KEY_SECRET'),
  },
  // Redis
  redis: {
    url: getEnv('REDIS_URL'),
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folder: process.env.CLOUDINARY_FOLDER || 'wabmeta-templates',
  },
} as const;

export default config;
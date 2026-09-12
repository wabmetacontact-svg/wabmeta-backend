"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const getEnv = (key, defaultValue) => {
    return process.env[key] || defaultValue || '';
};
exports.config = {
    app: {
        name: 'WabMeta',
        env: (process.env.NODE_ENV || 'development'),
        port: parseInt(process.env.PORT || '5000', 10),
        isDevelopment: process.env.NODE_ENV !== 'production',
        isProduction: process.env.NODE_ENV === 'production',
    },
    port: parseInt(process.env.PORT || '5000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    database: {
        url: getEnv('DATABASE_URL'),
    },
    databaseUrl: getEnv('DATABASE_URL'),
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
    jwt: {
        secret: getEnv('JWT_SECRET', 'your-secret-key-change-in-production'),
        accessSecret: getEnv('JWT_ACCESS_SECRET', getEnv('JWT_SECRET', 'access-secret')),
        refreshSecret: getEnv('JWT_REFRESH_SECRET', getEnv('JWT_SECRET', 'refresh-secret')),
        accessExpiresIn: getEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
        refreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
        expiresIn: getEnv('JWT_EXPIRES_IN', '7d'),
    },
    jwtSecret: getEnv('JWT_SECRET', 'your-secret-key-change-in-production'),
    encryption: {
        key: getEnv('ENCRYPTION_KEY', 'your-32-character-encryption-key!'),
    },
    encryptionKey: getEnv('ENCRYPTION_KEY', 'your-32-character-encryption-key!'),
    meta: {
        appId: getEnv('META_APP_ID'),
        appSecret: getEnv('META_APP_SECRET'),
        webhookVerifyToken: getEnv('META_WEBHOOK_VERIFY_TOKEN', getEnv('META_VERIFY_TOKEN', getEnv('WEBHOOK_VERIFY_TOKEN', 'webhook-token'))),
        configId: getEnv('META_CONFIG_ID'),
        redirectUri: getEnv('META_REDIRECT_URI', 'https://wabmeta.com/meta/callback'),
        // Embedded Signup sirf Facebook ke JS SDK se chalta hai, jo React
        // Native me nahi chal sakta. Isliye mobile app is chhote page ko
        // apne in-app browser me kholti hai - ye page wahi FB.login flow
        // chalata hai aur code ko app par deep-link kar deta hai.
        // Page ka domain Meta App > Facebook Login > Allowed Domains me hona
        // chahiye (wabmeta.com already hai, kyunki dashboard wahi use karta hai).
        mobileSignupUrl: getEnv('META_MOBILE_SIGNUP_URL', 'https://wabmeta.com/mobile-connect.html'),
        // In-app browser se app me wapas aane ke liye
        mobileAppScheme: getEnv('META_MOBILE_APP_SCHEME', 'wabmeta://meta-callback'),
        graphApiVersion: getEnv('META_GRAPH_API_VERSION', 'v22.0'),
    },
    google: {
        clientId: getEnv('GOOGLE_CLIENT_ID'),
        clientSecret: getEnv('GOOGLE_CLIENT_SECRET'),
        redirectUri: getEnv('GOOGLE_REDIRECT_URI', 'https://wabmeta.com/api/v1/auth/google/callback'),
    },
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
            },
        },
    },
    razorpay: {
        keyId: getEnv('RAZORPAY_KEY_ID'),
        keySecret: getEnv('RAZORPAY_KEY_SECRET'),
    },
    redis: {
        url: getEnv('REDIS_URL'),
    },
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
        apiKey: process.env.CLOUDINARY_API_KEY || '',
        apiSecret: process.env.CLOUDINARY_API_SECRET || '',
        folder: process.env.CLOUDINARY_FOLDER || 'wabmeta-templates',
    },
    // ✅ Cloudflare R2 Storage Config
    r2: {
        accountId: getEnv('R2_ACCOUNT_ID'),
        accessKeyId: getEnv('R2_ACCESS_KEY_ID'),
        secretAccessKey: getEnv('R2_SECRET_ACCESS_KEY'),
        bucketName: getEnv('R2_BUCKET_NAME', 'wabmeta-media'),
        publicUrl: getEnv('R2_PUBLIC_URL', ''),
    },
    // ✅ NEW: Platform WhatsApp config
    platform: {
        whatsapp: {
            phoneNumberId: getEnv('PLATFORM_WA_PHONE_ID'),
            accessToken: getEnv('PLATFORM_WA_ACCESS_TOKEN'),
            otpTemplate: getEnv('PLATFORM_OTP_TEMPLATE', 'wabmeta_otp'),
            welcomeTemplate: getEnv('PLATFORM_WELCOME_TEMPLATE', 'wabmeta_welcome'),
        },
    },
};
exports.default = exports.config;
//# sourceMappingURL=index.js.map
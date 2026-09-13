import dotenv from 'dotenv';
dotenv.config();

const getEnv = (key: string, defaultValue?: string): string => {
  return process.env[key] || defaultValue || '';
};

export const config = {
  app: {
    name: 'WabMeta',
    env: (process.env.NODE_ENV || 'development') as
      | 'development'
      | 'production'
      | 'test',
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
    // No hardcoded fallback. These used to default to
    // 'your-secret-key-change-in-production' / 'access-secret', so a missing or
    // misspelled JWT_SECRET in the environment meant the server silently signed
    // tokens with a value published in this repository - anyone could mint one.
    // validateJwtSecrets() below refuses to start production without them.
    secret: getEnv('JWT_SECRET'),
    accessSecret: getEnv('JWT_ACCESS_SECRET', getEnv('JWT_SECRET')),
    refreshSecret: getEnv('JWT_REFRESH_SECRET', getEnv('JWT_SECRET')),
    accessExpiresIn: getEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
    expiresIn: getEnv('JWT_EXPIRES_IN', '7d'),
  },
  jwtSecret: getEnv('JWT_SECRET'),

  encryption: {
    key: getEnv('ENCRYPTION_KEY', 'your-32-character-encryption-key!'),
  },
  encryptionKey: getEnv('ENCRYPTION_KEY', 'your-32-character-encryption-key!'),

  meta: {
    appId: getEnv('META_APP_ID'),
    appSecret: getEnv('META_APP_SECRET'),
    webhookVerifyToken: getEnv(
      'META_WEBHOOK_VERIFY_TOKEN',
      getEnv('META_VERIFY_TOKEN', getEnv('WEBHOOK_VERIFY_TOKEN', 'webhook-token'))
    ),
    configId: getEnv('META_CONFIG_ID'),
    redirectUri: getEnv(
      'META_REDIRECT_URI',
      'https://wabmeta.com/meta/callback'
    ),
    // Embedded Signup sirf Facebook ke JS SDK se chalta hai, jo React
    // Native me nahi chal sakta. Isliye mobile app is chhote page ko
    // apne in-app browser me kholti hai - ye page wahi FB.login flow
    // chalata hai aur code ko app par deep-link kar deta hai.
    // Page ka domain Meta App > Facebook Login > Allowed Domains me hona
    // chahiye (wabmeta.com already hai, kyunki dashboard wahi use karta hai).
    mobileSignupUrl: getEnv(
      'META_MOBILE_SIGNUP_URL',
      'https://wabmeta.com/mobile-connect.html'
    ),
    // In-app browser se app me wapas aane ke liye
    mobileAppScheme: getEnv('META_MOBILE_APP_SCHEME', 'wabmeta://meta-callback'),
    graphApiVersion: getEnv('META_GRAPH_API_VERSION', 'v22.0'),
  },

  google: {
    clientId: getEnv('GOOGLE_CLIENT_ID'),
    clientSecret: getEnv('GOOGLE_CLIENT_SECRET'),
    redirectUri: getEnv(
      'GOOGLE_REDIRECT_URI',
      'https://wabmeta.com/api/v1/auth/google/callback'
    ),
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
} as const;

/**
 * Signing secrets must exist, and must be long enough to be worth having.
 *
 * Mirrors validateEncryptionKey(): the caller (server.ts) exits in production
 * and only warns in development, so a local checkout still runs.
 *
 * A short secret is reported as a failure too - a 6-character JWT_SECRET is
 * brute-forceable offline from a single captured token, which is the same
 * outcome as having no secret at all.
 */
export const MIN_JWT_SECRET_LENGTH = 32;

export interface JwtSecretInput {
  secret: string;
  accessSecret: string;
  refreshSecret: string;
  /** JWT_ACCESS_SECRET / JWT_REFRESH_SECRET apne aap set hain, ya JWT_SECRET se aaye hain. */
  accessExplicit: boolean;
  refreshExplicit: boolean;
}

export interface JwtSecretReport {
  /** false = production ko start nahi hona chahiye. */
  ok: boolean;
  problems: string[];
}

/**
 * Pure check - config aur process.env dono se aazad, isliye seedha test hota
 * hai. dotenv config import par .env padh leta hai, to env ko test me hilana
 * bharosemand nahi.
 */
export function checkJwtSecrets(input: JwtSecretInput): JwtSecretReport {
  const problems: string[] = [];
  let fatal = 0;

  const checks: [string, string][] = [
    ['JWT_SECRET', input.secret],
    ['JWT_ACCESS_SECRET (or JWT_SECRET)', input.accessSecret],
    ['JWT_REFRESH_SECRET (or JWT_SECRET)', input.refreshSecret],
  ];

  for (const [name, value] of checks) {
    if (!value) {
      problems.push(`${name} is not set`);
      fatal++;
    } else if (value.length < MIN_JWT_SECRET_LENGTH) {
      problems.push(
        `${name} is only ${value.length} chars, need at least ${MIN_JWT_SECRET_LENGTH}`
      );
      fatal++;
    }
  }

  // Access aur refresh ek hi secret par hon to refresh token wahan bhi chal
  // jata hai jahan access token chahiye. Batane layak hai, rokne layak nahi.
  if (
    input.accessSecret &&
    input.accessSecret === input.refreshSecret &&
    !input.accessExplicit &&
    !input.refreshExplicit
  ) {
    problems.push(
      'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET both fall back to JWT_SECRET - set them separately'
    );
  }

  return { ok: fatal === 0, problems };
}

export function validateJwtSecrets(): JwtSecretReport {
  return checkJwtSecrets({
    secret: config.jwt.secret,
    accessSecret: config.jwt.accessSecret,
    refreshSecret: config.jwt.refreshSecret,
    accessExplicit: !!process.env.JWT_ACCESS_SECRET,
    refreshExplicit: !!process.env.JWT_REFRESH_SECRET,
  });
}

export default config;
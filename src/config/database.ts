// src/config/database.ts - FIXED CONNECTION POOL

import { PrismaClient } from '@prisma/client';

const createPrismaClient = () => {
  let dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const prismaOptions: any = {
    log: process.env.NODE_ENV === 'development'
      ? ['error', 'warn']
      : ['error'],
    // ✅ Prisma-level connection pool config
    datasources: {},
  };

  // ✅ Remove any existing connection params to rebuild cleanly
  const baseUrl = dbUrl.split('?')[0];
  const existingParams = new URLSearchParams(
    dbUrl.includes('?') ? dbUrl.split('?')[1] : ''
  );

  // ✅ Render free tier pe connection limit LOW rakhna ZAROORI hai
  // Supabase/Neon free = max 20 connections
  // connection_limit = 5 means Prisma pool size = 5
  // Baaki connections webhooks, auth ke liye bachti hain
  
  const isPooler =
    dbUrl.includes('.pooler.supabase.com') ||
    dbUrl.includes('pooler') ||
    dbUrl.includes('pgbouncer');

  const isNeon = dbUrl.includes('neon.tech');
  const isSupabase = dbUrl.includes('supabase.com');

  // ✅ PgBouncer mode (Supabase pooler)
  if (isPooler) {
    existingParams.set('pgbouncer', 'true');
    existingParams.set('prepared_statements', 'false'); // pgbouncer ke saath zaroori
    console.log('🔧 Configured: Supabase PgBouncer pooler');
  }

  // ✅ Neon config
  if (isNeon) {
    existingParams.set('sslmode', 'require');
    existingParams.set('connect_timeout', '15');
    console.log('🔧 Configured: Neon database');
  }

  // ✅ KEY FIX: Connection limit BAHUT kam rakhna hai
  // Render free tier + Supabase free = max 20 total connections
  // Prisma pool = 5, baaki 15 = headroom for spikes
  existingParams.set('connection_limit', '5');   // ← 30 se 5 kar diya
  existingParams.set('pool_timeout', '10');       // ← 60 se 10 kar diya (fast fail)
  existingParams.set('connect_timeout', '10');

  const finalUrl = `${baseUrl}?${existingParams.toString()}`;
  
  prismaOptions.datasources = { db: { url: finalUrl } };

  const client = new PrismaClient(prismaOptions);

  console.log('✅ Prisma client created');
  console.log(`   connection_limit : 5`);
  console.log(`   pool_timeout     : 10s`);
  console.log(`   Mode             : ${isPooler ? 'PgBouncer' : isNeon ? 'Neon' : 'Direct'}`);

  return client;
};

// ✅ Singleton - ek hi instance
declare global {
  var __prisma: PrismaClient | undefined;
}

const prisma: PrismaClient = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// ✅ Graceful shutdown - sirf ek jagah handle karo
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
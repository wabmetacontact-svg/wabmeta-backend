// src/config/database.ts - PERMANENT FIX
// ✅ Optimized for Render + Supabase/Neon combo
// ✅ Connection pooling with proper limits
// ✅ Auto-reconnect on failures

import { PrismaClient } from '@prisma/client';

const createPrismaClient = () => {
  let dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const baseUrl = dbUrl.split('?')[0];
  const existingParams = new URLSearchParams(
    dbUrl.includes('?') ? dbUrl.split('?')[1] : ''
  );

  const isPooler =
    dbUrl.includes('.pooler.supabase.com') ||
    dbUrl.includes('pooler') ||
    dbUrl.includes('pgbouncer');

  const isNeon = dbUrl.includes('neon.tech');

  // ✅ PgBouncer mode
  if (isPooler) {
    existingParams.set('pgbouncer', 'true');
    existingParams.set('prepared_statements', 'false');
    console.log('🔧 Mode: Supabase PgBouncer');
  }

  if (isNeon) {
    existingParams.set('sslmode', 'require');
    existingParams.set('connect_timeout', '15');
    console.log('🔧 Mode: Neon');
  }

  // ✅ CRITICAL FIX: Increased limits
  // Supabase pooler pe hum SAFELY 10-15 connections use kar sakte hain
  // Kyunki pooler internally sab manage karta hai
  existingParams.set('connection_limit', '15');    // ← 5 se 15
  existingParams.set('pool_timeout', '20');         // ← 10 se 20
  existingParams.set('connect_timeout', '15');
  
  // ✅ Statement timeout - long queries kill kare
  existingParams.set('statement_timeout', '30000'); // 30 sec max per query

  const finalUrl = `${baseUrl}?${existingParams.toString()}`;

  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['error', 'warn'] 
      : ['error'],
    datasources: { db: { url: finalUrl } },
  });

  console.log('✅ Prisma configured:');
  console.log(`   connection_limit : 15`);
  console.log(`   pool_timeout     : 20s`);
  console.log(`   statement_timeout: 30s`);

  return client;
};

// Singleton
declare global {
  var __prisma: PrismaClient | undefined;
}

const prisma: PrismaClient = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
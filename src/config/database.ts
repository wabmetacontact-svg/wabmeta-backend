// src/config/database.ts - RENDER PAID PLAN OPTIMIZED
// ✅ 2GB RAM = Higher connection pool
// ✅ Always-on = No cold start issues

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

  if (isPooler) {
    existingParams.set('pgbouncer', 'true');
    existingParams.set('prepared_statements', 'false');
    console.log('🔧 DB Mode: Supabase PgBouncer');
  }

  if (isNeon) {
    existingParams.set('sslmode', 'require');
    console.log('🔧 DB Mode: Neon');
  }

  // ✅ PAID PLAN SETTINGS (2GB RAM, 1 CPU)
  existingParams.set('connection_limit', '20');
  existingParams.set('pool_timeout', '30');
  existingParams.set('connect_timeout', '20');
  existingParams.set('statement_timeout', '30000');
  existingParams.set('idle_in_transaction_session_timeout', '60000');

  const finalUrl = `${baseUrl}?${existingParams.toString()}`;

  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['error', 'warn'] 
      : ['error'],
    datasources: { db: { url: finalUrl } },
    errorFormat: 'minimal',
  });

  console.log('✅ Prisma configured (RENDER PAID PLAN):');
  console.log(`   connection_limit : 20`);
  console.log(`   pool_timeout     : 30s`);
  console.log(`   statement_timeout: 30s`);

  return client;
};

// ✅ Singleton pattern
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const prisma: PrismaClient = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// ✅ Graceful shutdown
const gracefulShutdown = async () => {
  console.log('🔌 Closing Prisma connections...');
  await prisma.$disconnect();
  console.log('✅ Prisma disconnected');
};

process.on('beforeExit', gracefulShutdown);
process.on('SIGINT', async () => {
  await gracefulShutdown();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await gracefulShutdown();
  process.exit(0);
});

export default prisma;
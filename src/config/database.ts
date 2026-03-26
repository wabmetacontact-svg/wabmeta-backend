// src/config/database.ts - OPTIMIZED

import { PrismaClient } from '@prisma/client';

const createPrismaClient = () => {
  let dbUrl = process.env.DATABASE_URL;
  const prismaOptions: any = {
    log: process.env.NODE_ENV === 'development'
      ? ['error', 'warn']
      : ['error'],
  };

  // Auto-configure for Supabase pooler
  if (dbUrl && (dbUrl.includes('.pooler.supabase.com') || dbUrl.includes('pooler'))) {
    if (!dbUrl.includes('pgbouncer=true')) {
      dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'pgbouncer=true';
    }
    if (!dbUrl.includes('connection_limit=')) {
      dbUrl += '&connection_limit=20';
    }
    if (!dbUrl.includes('pool_timeout=')) {
      dbUrl += '&pool_timeout=60';
    }
    prismaOptions.datasources = { db: { url: dbUrl } };
    console.log('🔧 Auto-configured database pooler');
  }

  // Auto-configure for Neon pooler
  if (dbUrl && dbUrl.includes('neon.tech')) {
    if (!dbUrl.includes('sslmode=require')) {
      dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'sslmode=require';
    }
    if (!dbUrl.includes('connect_timeout=')) {
      dbUrl += '&connect_timeout=30';
    }
    prismaOptions.datasources = { db: { url: dbUrl } };
    console.log('🔧 Auto-configured Neon database');
  }

  return new PrismaClient(prismaOptions);
};

// Singleton
declare global {
  var prisma: PrismaClient | undefined;
}

const prisma = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

// Graceful shutdown
const shutdown = async () => {
  console.log('🔌 Disconnecting database...');
  await prisma.$disconnect();
};

process.on('beforeExit', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default prisma;
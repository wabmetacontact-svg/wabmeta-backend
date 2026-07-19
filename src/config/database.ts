// src/config/database.ts - IMPROVED LOGGING
import { PrismaClient } from '@prisma/client';
import { dbLog } from '../utils/logger';

const createPrismaClient = () => {
  let dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const baseUrl = dbUrl.split('?')[0];
  const existingParams = new URLSearchParams(
    dbUrl.includes('?') ? dbUrl.split('?')[1] : ''
  );

  const isPooler = dbUrl.includes('.pooler.supabase.com') ||
                   dbUrl.includes('pooler') ||
                   dbUrl.includes('pgbouncer');
  const isNeon   = dbUrl.includes('neon.tech');

  if (isPooler) {
    existingParams.set('pgbouncer', 'true');
    existingParams.set('prepared_statements', 'false');
    dbLog.info('Database mode configured', { mode: 'Supabase PgBouncer' });
  }

  if (isNeon) {
    existingParams.set('sslmode', 'require');
    dbLog.info('Database mode configured', { mode: 'Neon' });
  }

  // Paid plan settings
  existingParams.set('connection_limit', '20');
  existingParams.set('pool_timeout', '30');
  existingParams.set('connect_timeout', '20');
  existingParams.set('statement_timeout', '30000');
  existingParams.set('idle_in_transaction_session_timeout', '60000');

  const finalUrl = `${baseUrl}?${existingParams.toString()}`;

  const client = new PrismaClient({
    log: [
      { level: 'error', emit: 'event' },
      { level: 'warn',  emit: 'event' },
    ],
    datasources: { db: { url: finalUrl } },
    errorFormat: 'minimal',
  });

  // ✅ Structured error logging
  (client as any).$on('error', (e: any) => {
    dbLog.error('Prisma error', new Error(e.message), {
      target: e.target,
    });
  });

  (client as any).$on('warn', (e: any) => {
    dbLog.warn('Prisma warning', {
      message: e.message,
      target: e.target,
    });
  });

  dbLog.info('Prisma configured', {
    connectionLimit:  20,
    poolTimeout:      '30s',
    statementTimeout: '30s',
    plan:             'RENDER_PAID',
  });

  return client;
};

// Singleton
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const prisma: PrismaClient = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// Graceful shutdown
const gracefulShutdown = async () => {
  dbLog.info('Closing Prisma connections');
  await prisma.$disconnect();
  dbLog.info('Prisma disconnected');
};

process.on('beforeExit', gracefulShutdown);
process.on('SIGINT',  async () => { await gracefulShutdown(); process.exit(0); });
process.on('SIGTERM', async () => { await gracefulShutdown(); process.exit(0); });

export default prisma;
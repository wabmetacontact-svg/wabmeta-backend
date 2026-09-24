// src/config/database.ts - IMPROVED LOGGING
import { PrismaClient } from '@prisma/client';
import { dbLog } from '../utils/logger';

/**
 * Hosts we know speak TLS, so the connection can demand it.
 *
 * Without sslmode, libpq's default is "prefer": it encrypts when the server
 * offers TLS and falls back to plaintext when it does not. A silent fallback is
 * the problem - the database is reachable over the public internet, so every
 * query, including the credentials, could travel unencrypted and nothing in the
 * logs would say so. "require" refuses to connect rather than fall back.
 *
 * It is deliberately a list of known hosts and not "everything but localhost":
 * a managed Postgres without TLS would stop connecting the moment it deployed,
 * and that is not a failure mode worth risking for a guess. Local Postgres
 * (docker, tests on localhost:5433) has no certificate and is untouched.
 *
 * Note this encrypts but does not verify the server's identity - Prisma only
 * accepts sslmode prefer/disable/require, so pinning Amazon's CA would need
 * sslcert with the RDS bundle shipped in the image.
 */
const TLS_HOSTS = ['rds.amazonaws.com', 'neon.tech'];

/**
 * Apply this deployment's connection settings to a raw DATABASE_URL.
 *
 * Exported for the tests: the client itself is built once at module load, so
 * without a pure function here there is no way to assert what URL Prisma gets.
 */
export const buildDatabaseUrl = (dbUrl: string): string => {
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
    dbLog.info('Database mode configured', { mode: 'Neon' });
  }

  // An sslmode already in the URL wins, so a deployment can still override this
  // from the environment without a code change.
  if (!existingParams.has('sslmode') && TLS_HOSTS.some(h => baseUrl.includes(h))) {
    existingParams.set('sslmode', 'require');
    dbLog.info('Database TLS required', { sslmode: 'require' });
  }

  // Paid plan settings
  existingParams.set('connection_limit', '20');
  existingParams.set('pool_timeout', '30');
  existingParams.set('connect_timeout', '20');
  existingParams.set('statement_timeout', '30000');
  existingParams.set('idle_in_transaction_session_timeout', '60000');

  return `${baseUrl}?${existingParams.toString()}`;
};

const createPrismaClient = () => {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const finalUrl = buildDatabaseUrl(dbUrl);

  const client = new PrismaClient({
    log: [
      { level: 'error', emit: 'event' },
      { level: 'warn',  emit: 'event' },
    ],
    datasources: { db: { url: finalUrl } },
    errorFormat: 'minimal',
    // ✅ NEW: Increase default transaction timeouts
    transactionOptions: {
      maxWait:  10000,  // 10s max wait for a connection  
      timeout:  30000,  // 30s transaction timeout (was 5s)
    },
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
/**
 * Runs before EVERY test file, via `setupFiles` in vitest.config.ts.
 *
 * On 2026-09-07 the whole production database was emptied by a test run.
 * The guard existed, but it lived inside `beforeAll` -- and vitest still runs
 * `afterAll` when `beforeAll` throws. Those afterAll hooks called
 * `deleteMany({ where: { id: organizationId } })` with `organizationId` still
 * undefined, and Prisma treats an undefined filter as "no filter": every row
 * in the table. The connection was live, and it was pointing at production.
 *
 * So the check moved here. setupFiles run before the test file is even
 * collected, so a throw here means no PrismaClient is constructed, no hooks
 * are registered, and nothing can delete anything.
 *
 * To run the tests:
 *   docker start wabmeta-testdb
 *   DATABASE_URL=postgresql://wabmeta:testpass@localhost:5433/wabmeta_test npm test
 */

const url = process.env.DATABASE_URL || '';

// Named hosts that must never see a test run, whatever else the URL says.
const FORBIDDEN = [/rds\.amazonaws\.com/i, /render\.com/i, /neon\.tech/i, /supabase\.co/i];

if (!url) {
  throw new Error(
    'Refusing to run tests: DATABASE_URL is not set, so imported modules would load .env ' +
      '-- which points at production. Set it to the local test DB on port 5433.'
  );
}

for (const host of FORBIDDEN) {
  if (host.test(url)) {
    throw new Error(
      `Refusing to run tests: DATABASE_URL points at a managed/remote database (${host}). ` +
        'Tests only ever run against the local test DB on port 5433.'
    );
  }
}

if (!/@localhost:5433\//.test(url)) {
  throw new Error(
    'Refusing to run tests: DATABASE_URL must be the local test DB on port 5433. ' +
      `Got host "${url.replace(/\/\/[^@]*@/, '//***@')}".`
  );
}

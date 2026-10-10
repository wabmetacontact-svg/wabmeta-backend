/**
 * withJobLock against a real Postgres - the bug it replaces only shows up with
 * a real connection pool.
 *
 * Requires the local test DB:
 *   DATABASE_URL=postgresql://wabmeta:wabmeta@localhost:5433/wabmeta_test
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import prisma from '../config/database';
import { withJobLock } from './withLock';

const NAME = 'test:with-job-lock';
const KEY = `lock:${NAME}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  if (!/@localhost:5433\//.test(process.env.DATABASE_URL || '')) {
    throw new Error('Refusing to run: DATABASE_URL must be the local test DB on port 5433.');
  }
  await prisma.systemSetting.deleteMany({ where: { key: KEY } });
});

afterEach(async () => {
  await prisma.systemSetting.deleteMany({ where: { key: KEY } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('withJobLock', () => {
  it('runs the job, returns its value and leaves no row behind', async () => {
    expect(await withJobLock(NAME, async () => 42)).toBe(42);
    expect(await prisma.systemSetting.findUnique({ where: { key: KEY } })).toBeNull();
  });

  it('is free again after a job that ran parallel queries', async () => {
    // The old advisory lock stranded itself exactly here: the parallel queries
    // spread over the pool, the unlock ran on a different connection, and every
    // later tick was skipped for good.
    await withJobLock(NAME, async () => {
      await Promise.all(Array.from({ length: 10 }, () => prisma.$queryRaw`SELECT pg_sleep(0.05)::text`));
    });

    expect(await withJobLock(NAME, async () => 'ran again')).toBe('ran again');
  });

  it('keeps a second caller out while the first is running', async () => {
    let inner: unknown = 'not attempted';
    await withJobLock(NAME, async () => {
      inner = await withJobLock(NAME, async () => 'should not run');
    });
    expect(inner).toBeUndefined();
  });

  it('lets exactly one of many simultaneous callers in', async () => {
    let ran = 0;
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        withJobLock(NAME, async () => {
          ran++;
          await sleep(200);
          return 'ran';
        })
      )
    );
    expect(ran).toBe(1);
    expect(results.filter((r) => r === 'ran')).toHaveLength(1);
  });

  it('survives the job throwing, rather than wedging the job', async () => {
    await expect(
      withJobLock(NAME, async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    expect(await withJobLock(NAME, async () => 'after the crash')).toBe('after the crash');
  });

  it('can be taken over once a dead holder has let it expire', async () => {
    await prisma.$executeRaw`
      INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
      VALUES (${KEY}, jsonb_build_object('holder', 'a-dead-instance', 'until', now() - interval '1 minute'), now())
    `;
    expect(await withJobLock(NAME, async () => 'taken over')).toBe('taken over');
  });

  it('is neither taken nor freed while somebody else holds it', async () => {
    await prisma.$executeRaw`
      INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
      VALUES (${KEY}, jsonb_build_object('holder', 'other', 'until', now() + interval '1 minute'), now())
    `;

    expect(await withJobLock(NAME, async () => 'should not run')).toBeUndefined();

    const row = await prisma.systemSetting.findUniqueOrThrow({ where: { key: KEY } });
    expect((row.value as any).holder).toBe('other');
  });

  it('keeps its lease past the TTL while the job is still running', async () => {
    // A job longer than the TTL - a big broadcast, the nightly Meta sync. Without
    // the heartbeat a second instance would take the expired lease halfway
    // through and run the same job twice.
    let second: unknown = 'not attempted';
    const first = withJobLock(
      NAME,
      async () => {
        await sleep(400);
        second = await withJobLock(NAME, async () => 'should not run', { ttlMs: 150, renewMs: 50 });
        await sleep(100);
        return 'first done';
      },
      { ttlMs: 150, renewMs: 50 }
    );

    expect(await first).toBe('first done');
    expect(second).toBeUndefined();
  });
});

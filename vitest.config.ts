import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Refuses to run against anything but the local test DB. Must stay first:
    // it throws before a test file is collected, so no hook can ever fire
    // against production. See src/test/guard-test-db.ts.
    setupFiles: ['./src/test/guard-test-db.ts'],
    // These tests talk to a real Postgres, so they must not run in parallel
    // against the same rows -- concurrency is what they are measuring.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});

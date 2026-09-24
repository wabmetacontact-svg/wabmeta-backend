// The database is reachable over the public internet, and without an sslmode
// libpq quietly falls back to plaintext when TLS is unavailable. These tests
// pin the "require" that stops that fallback from coming back, and pin that
// local Postgres (which has no certificate) is left alone.

import { describe, it, expect } from 'vitest';
import { buildDatabaseUrl } from './database';

const paramsOf = (url: string) =>
  new URLSearchParams(url.split('?')[1] ?? '');

describe('buildDatabaseUrl', () => {
  it('requires TLS for an RDS host', () => {
    const url = buildDatabaseUrl(
      'postgresql://u:p@database-1.abc.ap-south-1.rds.amazonaws.com:5432/postgres'
    );
    expect(paramsOf(url).get('sslmode')).toBe('require');
  });

  it('requires TLS for a Neon host', () => {
    const url = buildDatabaseUrl('postgresql://u:p@ep-cool.neon.tech/db');
    expect(paramsOf(url).get('sslmode')).toBe('require');
  });

  it('leaves local Postgres without an sslmode', () => {
    const url = buildDatabaseUrl('postgresql://u:p@localhost:5433/wabmeta_test');
    expect(paramsOf(url).has('sslmode')).toBe(false);
  });

  it('keeps an sslmode already set in the URL', () => {
    const url = buildDatabaseUrl(
      'postgresql://u:p@database-1.abc.ap-south-1.rds.amazonaws.com:5432/postgres?sslmode=disable'
    );
    expect(paramsOf(url).get('sslmode')).toBe('disable');
  });

  it('keeps the pool settings and the existing query parameters', () => {
    const url = buildDatabaseUrl(
      'postgresql://u:p@database-1.abc.ap-south-1.rds.amazonaws.com:5432/postgres?schema=public'
    );
    const params = paramsOf(url);
    expect(params.get('schema')).toBe('public');
    expect(params.get('connection_limit')).toBe('20');
    expect(params.get('pool_timeout')).toBe('30');
    expect(params.get('statement_timeout')).toBe('30000');
  });

  it('still configures pgbouncer for a pooled host', () => {
    const url = buildDatabaseUrl(
      'postgresql://u:p@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'
    );
    const params = paramsOf(url);
    expect(params.get('pgbouncer')).toBe('true');
    expect(params.get('prepared_statements')).toBe('false');
  });

  it('does not lose the credentials or the database name', () => {
    const url = buildDatabaseUrl(
      'postgresql://u:p@database-1.abc.ap-south-1.rds.amazonaws.com:5432/postgres'
    );
    expect(url.startsWith(
      'postgresql://u:p@database-1.abc.ap-south-1.rds.amazonaws.com:5432/postgres?'
    )).toBe(true);
  });
});

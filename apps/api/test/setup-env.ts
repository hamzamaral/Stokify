export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  'postgresql://stokify:stokify@localhost:5432/stokify_test?schema=public';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = E2E_DATABASE_URL;
process.env.JWT_ACCESS_SECRET ??= 'e2e-access-secret-at-least-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'e2e-refresh-secret-at-least-32-characters';
process.env.SEED_ON_EMPTY = 'true';
process.env.LOG_LEVEL = 'error';
process.env.THROTTLE_LIMIT = '10000';

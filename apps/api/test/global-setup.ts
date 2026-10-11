import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { E2E_DATABASE_URL } from './setup-env';

/** Test veritabanını sıfırlar; demo verisi uygulama açılışında SeedService tarafından yüklenir. */
export default function globalSetup() {
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
    cwd: join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
    stdio: 'ignore',
  });
}

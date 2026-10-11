import { PrismaClient } from '@prisma/client';
import { isDatabaseEmpty, runSeed } from '../src/database/seed/seeder';

const prisma = new PrismaClient();

async function main() {
  const force = process.argv.includes('--force');
  if (!force && !(await isDatabaseEmpty(prisma))) {
    console.log('Veritabanı boş değil, seed atlandı. Sıfırlamak için: npm run db:reset');
    return;
  }
  await runSeed(prisma);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

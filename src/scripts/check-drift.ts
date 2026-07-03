// scripts/check-drift.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const result = await prisma.$queryRawUnsafe(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND (
      (table_name = 'User' AND column_name = 'tokenVersion')
      OR (table_name = 'Organization' AND column_name IN ('featureConnectionLocked', 'customLabels', 'featureInboxLocked'))
    )
    ORDER BY table_name, column_name;
  `);

    console.log('--- COLUMN CHECK ---');
    console.log(JSON.stringify(result, null, 2));

    const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('Lead', 'AutomationSequence', 'InstagramAccount', 'Pipeline')
    ORDER BY table_name;
  `);

    console.log('--- TABLE CHECK ---');
    console.log(JSON.stringify(tables, null, 2));
}

main()
    .catch((e) => {
        console.error('Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

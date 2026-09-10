// prisma/seed-local-test.ts
//
// LOCAL TESTING ONLY. Creates one login-able org owner so you can reach the
// dashboard/inbox on a local database. Idempotent (safe to run repeatedly).
//
// Run against the LOCAL db only, e.g.:
//   DATABASE_URL="postgresql://wabmeta:wabmeta@localhost:5433/wabmeta_dev" \
//   npx ts-node prisma/seed-local-test.ts
//
// Refuses to run unless DATABASE_URL points at localhost, so it can never touch
// production.

import { PrismaClient, PlanType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const url = process.env.DATABASE_URL || '';
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error('Refusing to run: DATABASE_URL must point at localhost. Got:', url.replace(/:[^:@]*@/, ':***@'));
  process.exit(1);
}

const prisma = new PrismaClient();

const TEST_EMAIL = 'test@local.dev';
const TEST_PASSWORD = 'Test@1234';

async function main() {
  // Ensure a plan exists to attach a subscription to.
  let plan = await prisma.plan.findFirst({ where: { type: PlanType.MONTHLY } });
  if (!plan) plan = await prisma.plan.findFirst();
  if (!plan) {
    console.error('No Plan rows found. Run the main seed first: npx prisma db seed');
    process.exit(1);
  }

  const password = await bcrypt.hash(TEST_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: { password, status: 'ACTIVE', emailVerified: true },
    create: {
      email: TEST_EMAIL,
      password,
      firstName: 'Local',
      lastName: 'Tester',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  let organization = await prisma.organization.findFirst({ where: { ownerId: user.id } });
  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: 'Local Test Org',
        slug: 'local-test-' + Math.random().toString(36).slice(2, 7),
        ownerId: user.id,
        planType: PlanType.MONTHLY,
        featureCsvUpload: true,
      },
    });
    await prisma.organizationMember.create({
      data: { organizationId: organization.id, userId: user.id, role: 'OWNER', joinedAt: new Date() },
    });
    await prisma.subscription.create({
      data: {
        organizationId: organization.id,
        planId: plan.id,
        status: 'ACTIVE',
        billingCycle: 'monthly',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log('\n✅ Local test account ready:');
  console.log('   Email:   ', TEST_EMAIL);
  console.log('   Password:', TEST_PASSWORD);
  console.log('   Org:     ', organization.name, `(${organization.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

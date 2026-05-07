const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const automations = await prisma.automation.findMany({
    select: { id: true, name: true, trigger: true, isActive: true }
  });
  console.log(automations);
}
main().finally(() => prisma.$disconnect());

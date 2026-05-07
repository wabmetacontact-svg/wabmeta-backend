const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const contacts = await prisma.contact.findMany({
    select: { id: true, phone: true, firstName: true }
  });
  console.log(contacts);
}
main().finally(() => prisma.$disconnect());

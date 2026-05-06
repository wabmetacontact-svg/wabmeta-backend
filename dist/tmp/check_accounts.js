"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function check() {
    const accounts = await prisma.whatsAppAccount.findMany({
        select: { id: true, phoneNumberId: true, phoneNumber: true, displayName: true }
    });
    console.log('WhatsApp Accounts in DB:');
    console.table(accounts);
    await prisma.$disconnect();
}
check();
//# sourceMappingURL=check_accounts.js.map
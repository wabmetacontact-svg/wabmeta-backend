"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function checkMessage() {
    const messages = await prisma.message.findMany({
        where: {
            type: 'TEMPLATE'
        },
        orderBy: { createdAt: 'desc' },
        take: 10
    });
    console.log('Template Messages:', JSON.stringify(messages, null, 2));
}
checkMessage().finally(() => prisma.$disconnect());
//# sourceMappingURL=check_msg.js.map
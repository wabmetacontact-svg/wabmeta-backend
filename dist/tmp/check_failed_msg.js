"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function checkFailedMessage() {
    const msgId = 'cmmf08tkz0001lrumlqouqfud';
    const msg = await prisma.message.findUnique({
        where: { id: msgId }
    });
    if (msg) {
        console.log('✅ Found message:', JSON.stringify(msg, null, 2));
    }
    else {
        console.log('❌ Message not found');
    }
}
checkFailedMessage().finally(() => prisma.$disconnect());
//# sourceMappingURL=check_failed_msg.js.map
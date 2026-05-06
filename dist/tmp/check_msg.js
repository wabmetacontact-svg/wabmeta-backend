"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function checkMessage() {
    const waId = 'wamid.HBgMOTE2MzcyOTgxMTE5FQIAERggQTVBRTVDMTk1MTZFNDVGNDE0MDRENUI1RkM3Nzk5MjgA';
    console.log(`Checking for waMessageId: ${waId}`);
    const msg = await prisma.message.findFirst({
        where: {
            OR: [
                { waMessageId: waId },
                { wamId: waId }
            ]
        }
    });
    if (msg) {
        console.log('✅ Found message:', JSON.stringify(msg, null, 2));
    }
    else {
        console.log('❌ Message not found');
        // Check some recent messages to see format
        const recent = await prisma.message.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { id: true, waMessageId: true, wamId: true, content: true }
        });
        console.log('Recent messages:', JSON.stringify(recent, null, 2));
    }
}
checkMessage().finally(() => prisma.$disconnect());
//# sourceMappingURL=check_msg.js.map
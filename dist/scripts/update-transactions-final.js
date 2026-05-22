"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🚀 Starting FINAL transaction cleanup...');
    // Update credits to 'Credit by WabMeta'
    const updateDescCredit = await prisma.walletTransaction.updateMany({
        where: {
            OR: [
                { description: { contains: 'Manual credit by admin' } },
                { description: { contains: 'Credit by Meta' } },
                { note: { contains: 'Manual credit by admin' } },
                { note: { contains: 'Credit by Meta' } }
            ]
        },
        data: {
            description: 'Adjustment by Meta: Credit by WabMeta',
            note: 'Credit by WabMeta'
        },
    });
    // Update debits to 'Debit by Meta'
    const updateDescDebit = await prisma.walletTransaction.updateMany({
        where: {
            OR: [
                { description: { contains: 'Manual debit by admin' } },
                { description: { contains: 'Debit by Meta' } },
                { note: { contains: 'Manual debit by admin' } },
                { note: { contains: 'Debit by Meta' } }
            ]
        },
        data: {
            description: 'Adjustment by Meta: Debit by Meta',
            note: 'Debit by Meta'
        },
    });
    console.log(`✅ FINAL SYNC COMPLETE: Updated credits and debits.`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=update-transactions-final.js.map
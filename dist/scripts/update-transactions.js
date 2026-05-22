"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🚀 Starting transaction cleanup...');
    // Update descriptions
    const updateDesc = await prisma.walletTransaction.updateMany({
        where: {
            description: {
                contains: 'Admin adjustment',
            },
        },
        data: {
            description: {
                set: 'Adjustment by Meta', // Simplified for existing ones or we could do string replace if supported
            },
        },
    });
    // Since prisma updateMany doesn't support string replace easily, 
    // let's do a more targeted update for those exact strings.
    await prisma.walletTransaction.updateMany({
        where: {
            description: 'Admin adjustment: Manual credit by admin'
        },
        data: {
            description: 'Adjustment by Meta: Manual credit by admin'
        }
    });
    // Update notes
    const updateNotes = await prisma.walletTransaction.updateMany({
        where: {
            note: 'Manual credit by admin',
        },
        data: {
            note: 'Adjustment by Meta',
        },
    });
    console.log(`✅ Updated ${updateDesc.count} descriptions and ${updateNotes.count} notes.`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=update-transactions.js.map
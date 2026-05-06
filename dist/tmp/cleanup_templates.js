"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const whatsapp_api_1 = require("../modules/whatsapp/whatsapp.api");
const meta_service_1 = require("../modules/meta/meta.service");
const prisma = new client_1.PrismaClient();
async function cleanupTemplates() {
    const orgId = 'cmmd5zbvl0015l7hip9hebzod';
    const waAccountId = 'cmmd63y59001ll7hiyqtmbyf1';
    const data = await meta_service_1.metaService.getAccountWithToken(waAccountId);
    if (!data)
        return;
    const { accessToken } = data;
    const wabaId = data.account.wabaId;
    console.log('--- Syncing and Marking Ghost Templates ---');
    const metaTemplates = await whatsapp_api_1.whatsappApi.listMessageTemplates(wabaId, accessToken);
    const metaNamesSorted = metaTemplates.map(t => `${t.name}:${t.language}`);
    console.log('Current Name:Lang in Meta:', metaNamesSorted);
    const dbTemplates = await prisma.template.findMany({
        where: {
            organizationId: orgId,
            wabaId: wabaId
        }
    });
    for (const dt of dbTemplates) {
        const key = `${dt.name}:${dt.language}`;
        if (!metaNamesSorted.includes(key)) {
            console.log(`⚠️ Marking ghost template as REJECTED (Deleted in Meta): ${dt.name} (${dt.language})`);
            await prisma.template.update({
                where: { id: dt.id },
                data: {
                    status: 'REJECTED',
                    rejectionReason: 'This template has been deleted from Meta Business Suite.'
                }
            });
        }
        else {
            console.log(`✅ Template verified in Meta: ${dt.name} (${dt.language})`);
        }
    }
    console.log('Sync/Cleanup complete.');
}
cleanupTemplates().finally(() => prisma.$disconnect());
//# sourceMappingURL=cleanup_templates.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const whatsapp_api_1 = require("../modules/whatsapp/whatsapp.api");
const meta_service_1 = require("../modules/meta/meta.service");
async function listAllTemplates() {
    const waAccountId = 'cmmd63y59001ll7hiyqtmbyf1';
    const data = await meta_service_1.metaService.getAccountWithToken(waAccountId);
    if (!data)
        return;
    const { accessToken } = data;
    const wabaId = data.account.wabaId;
    console.log('--- Listing ALL Templates from Meta ---');
    const templates = await whatsapp_api_1.whatsappApi.listMessageTemplates(wabaId, accessToken);
    console.log(JSON.stringify(templates.map(t => ({ name: t.name, language: t.language, status: t.status })), null, 2));
}
listAllTemplates().catch(console.error);
//# sourceMappingURL=list_all_meta_templates.js.map
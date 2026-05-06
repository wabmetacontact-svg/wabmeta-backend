"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const whatsapp_api_1 = require("../modules/whatsapp/whatsapp.api");
const meta_service_1 = require("../modules/meta/meta.service");
async function checkTemplateInMeta() {
    const waAccountId = 'cmmd63y59001ll7hiyqtmbyf1';
    const data = await meta_service_1.metaService.getAccountWithToken(waAccountId);
    if (!data)
        throw new Error('Account not found');
    const { accessToken } = data;
    const wabaId = data.account.wabaId;
    console.log('--- Listing Templates from Meta ---');
    const templates = await whatsapp_api_1.whatsappApi.listMessageTemplates(wabaId, accessToken);
    const marketing = templates.filter(t => t.name.startsWith('marketing'));
    console.log('Marketing Templates in Meta:');
    console.log(JSON.stringify(marketing, null, 2));
}
checkTemplateInMeta().catch(console.error);
//# sourceMappingURL=check_meta_templates.js.map
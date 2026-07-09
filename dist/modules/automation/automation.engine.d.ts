interface AutomationAction {
    id: string;
    type: string;
    config: any;
}
interface TriggerContext {
    organizationId: string;
    contactId?: string;
    phone?: string;
    message?: string;
    conversationId?: string;
    metadata?: any;
}
declare class AutomationEngine {
    private isContactInTargetGroups;
    triggerUnknownMessage(context: TriggerContext): Promise<void>;
    private contactExistedBefore;
    triggerKeyword(context: TriggerContext): Promise<boolean>;
    triggerNewContact(context: TriggerContext): Promise<void>;
    triggerWebhook(organizationId: string, automationId: string, context: TriggerContext): Promise<void>;
    triggerScheduled(): Promise<void>;
    triggerInactivity(): Promise<void>;
    handleButtonClick(context: {
        organizationId: string;
        contactId: string;
        buttonId: string;
        conversationId: string;
    }): Promise<void>;
    private executeSequence;
    private actionSendText;
    private actionSendMedia;
    private actionSendButtons;
    private actionSendTemplate;
    private actionWaitForResponse;
    private actionAddToGroup;
    handleUserResponse(context: {
        organizationId: string;
        contactId: string;
        response: string;
        conversationId?: string;
        phone?: string;
    }): Promise<void>;
    private getDefaultAccount;
    private replaceVariables;
    private actionDelay;
    private actionAddTag;
    private actionCreateLead;
    executeActions(automationId: string, actions: AutomationAction[], context: TriggerContext): Promise<void>;
}
export declare const automationEngine: AutomationEngine;
export default automationEngine;
//# sourceMappingURL=automation.engine.d.ts.map
export declare class ChatbotEngine {
    processMessage(conversationId: string, organizationId: string, messageContent: string, senderPhone: string, isNewConversation: boolean, rawMessage?: any): Promise<void>;
    private createNewSession;
    private handleExistingSession;
    private processUserInput;
    private readonly INTEREST_SIGNALS;
    private readonly DISINTEREST_SIGNALS;
    private detectInterestFromInput;
    private autoCreateInterestedLead;
    private matchButtonInput;
    private matchListInput;
    private executeFlow;
    private executeMessageNode;
    private executeButtonNode;
    private executeListNode;
    private executeConditionNode;
    private executeAINode;
    private buildEnhancedSystemPrompt;
    private findMatchingChatbot;
    private sendText;
    private sendButtonMessage;
    private sendListMessage;
    private findButtonEdge;
    private findListEdge;
    private getNextNodeId;
    private executeAction;
    private findContact;
    private evaluateCondition;
    private replaceVariables;
    private sleep;
    clearSession(organizationId: string, conversationId: string): Promise<void>;
    getSessionInfo(organizationId: string, conversationId: string): Promise<{
        chatbotId: string;
        currentNodeId: string;
        waitingForInput: boolean;
        expectedInputType: "text" | "button" | "list" | "any";
        messageCount: number;
        aiNodeActive: boolean;
        historyLength: number;
        startedAt: Date;
        lastActivityAt: Date;
    } | null>;
}
export declare const chatbotEngine: ChatbotEngine;
//# sourceMappingURL=chatbot.engine.d.ts.map
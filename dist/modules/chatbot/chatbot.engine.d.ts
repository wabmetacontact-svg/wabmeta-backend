export declare class ChatbotEngine {
    processMessage(conversationId: string, organizationId: string, messageContent: string, senderPhone: string, isNewConversation: boolean): Promise<void>;
    private createNewSession;
    private handleExistingSession;
    private processUserInput;
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
interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}
declare class AIService {
    private genAI;
    private readonly PRIMARY_MODEL;
    private readonly FALLBACK_MODEL;
    constructor();
    generateResponse(systemPrompt: string, userMessage: string, chatHistory?: ChatMessage[]): Promise<string>;
    private sleep;
    private callModel;
    private buildSystemInstruction;
    private buildGeminiHistory;
    private handleError;
    summarizeConversation(messages: ChatMessage[]): Promise<string>;
}
export declare const aiService: AIService;
export {};
//# sourceMappingURL=ai.service.d.ts.map
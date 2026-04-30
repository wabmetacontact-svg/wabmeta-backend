// src/modules/chatbot/chatbot.types.ts

export interface FlowNode {
  id: string;
  type: 'start' | 'message' | 'button' | 'list' | 'condition' | 'delay' | 'action' | 'ai';
  position: { x: number; y: number };
  data: {
    label?: string;
    message?: string;
    messageType?: 'text' | 'image' | 'video' | 'document' | 'audio' | 'list';
    mediaUrl?: string;
    systemPrompt?: string;
    buttons?: Array<{
      id: string;
      text: string;
      type: 'reply' | 'url' | 'phone';
      value?: string;
    }>;
    listButtonText?: string;
    listSections?: Array<{
      title?: string;
      rows: Array<{
        id: string;
        title: string;
        description?: string;
      }>;
    }>;
    condition?: {
      type: 'keyword' | 'contains' | 'exact' | 'regex';
      value: string;
    };
    delay?: number; // in seconds
    action?: {
      type: 'assign' | 'tag' | 'webhook' | 'variable';
      value: string;
    };
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface ChatbotInput {
  name: string;
  description?: string;
  flowData?: FlowData;
  triggerKeywords?: string[];
  isDefault?: boolean;
  welcomeMessage?: string;
  fallbackMessage?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'PAUSED';
}

export interface ChatbotResponse {
  id: string;
  name: string;
  description: string | null;
  flowData: FlowData;
  triggerKeywords: string[];
  isDefault: boolean;
  welcomeMessage: string | null;
  fallbackMessage: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED';
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatbotStats {
  totalConversations: number;
  messagesHandled: number;
  fallbackTriggered: number;
  avgResponseTime: number;
}

// Session state for ongoing conversations
export interface ChatbotSession {
  conversationId: string;
  chatbotId: string;
  currentNodeId: string;
  variables: Record<string, any>;
  chatHistory?: any[];
  lastInteractionAt: Date;
  messageCount: number;
}
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

class AIService {
  async generateResponse(systemPrompt: string, userMessage: string, chatHistory: any[] = []): Promise<string> {
    try {
      if (!process.env.GEMINI_API_KEY) {
        console.error("❌ GEMINI_API_KEY is not set in .env");
        return "I'm sorry, my AI services are currently unavailable. Please check the API configuration.";
      }

      // Convert history to Gemini format
      const history = chatHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      const chat = model.startChat({
        history: [
           { role: 'user', parts: [{ text: `System Instructions (strictly follow these): ${systemPrompt}` }] },
           { role: 'model', parts: [{ text: 'Understood. I will strictly follow these instructions.' }] },
           ...history
        ],
      });

      const result = await chat.sendMessage(userMessage);
      const response = result.response;
      return response.text();
    } catch (error) {
      console.error("🤖 AI Service Error:", error);
      return "Sorry, I am facing some technical difficulties. Please try again later.";
    }
  }
}

export const aiService = new AIService();

import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

class AIService {
  async generateResponse(systemPrompt: string, userMessage: string, chatHistory: any[] = []): Promise<string> {
    try {
      if (!process.env.GROQ_API_KEY) {
        console.error("❌ GROQ_API_KEY is not set in .env");
        return "I'm sorry, my AI services are currently unavailable. Please check the API configuration.";
      }

      // Convert history to Groq format
      const messages = [
        { role: 'system', content: systemPrompt },
        ...chatHistory.map(msg => ({
          role: msg.role === 'model' ? 'assistant' : msg.role,
          content: msg.content
        })),
        { role: 'user', content: userMessage }
      ];

      const completion = await groq.chat.completions.create({
        messages: messages as any,
        model: "llama-3.1-70b-versatile",
        temperature: 0.7,
        max_tokens: 1024,
      });

      return completion.choices[0]?.message?.content || "I couldn't generate a response.";
    } catch (error: any) {
      console.error("🤖 Groq AI Service Error:", error);
      if (error.status === 429) {
        return "I'm processing too many requests right now. Please try again in a minute.";
      }
      return "Sorry, I am facing some technical difficulties with my Meta AI engine. Please try again later.";
    }
  }
}

export const aiService = new AIService();

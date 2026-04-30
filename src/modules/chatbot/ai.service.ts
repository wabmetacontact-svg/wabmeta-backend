import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

class AIService {
  private getClient() {
    if (!process.env.GROQ_API_KEY) {
      return null;
    }
    return new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  async generateResponse(systemPrompt: string, userMessage: string, chatHistory: any[] = []): Promise<string> {
    try {
      const groq = this.getClient();
      
      if (!groq) {
        console.error("❌ GROQ_API_KEY is not set in environment variables");
        return "I'm sorry, my AI services are currently unavailable. Please add GROQ_API_KEY to your environment variables.";
      }

      // Convert history to Groq format
      const messages = [
        { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
        ...chatHistory.map(msg => ({
          role: msg.role === 'model' ? 'assistant' : msg.role,
          content: msg.content
        })),
        { role: 'user', content: userMessage }
      ];

      const completion = await groq.chat.completions.create({
        messages: messages as any,
        model: "llama3-8b-8192", // More reliable free tier model
        temperature: 0.7,
        max_tokens: 1024,
      });

      return completion.choices[0]?.message?.content || "I couldn't generate a response.";
    } catch (error: any) {
      console.error("🤖 Groq AI Service Error:", error);
      
      // Detailed error message for the user if it's an API issue
      if (error?.status === 429) {
        return "I'm processing too many requests right now. Please try again in a minute.";
      }
      if (error?.status === 401) {
        return "AI Authentication failed. Please check if the GROQ_API_KEY is correct.";
      }
      
      return "Sorry, I am facing some technical difficulties with my Meta AI engine. Please check the logs or try again later.";
    }
  }
}

export const aiService = new AIService();

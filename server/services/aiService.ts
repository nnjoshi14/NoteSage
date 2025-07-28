import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

export type AIProvider = "openai" | "gemini" | "grok";

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
}

export interface AIInsight {
  type: "pattern" | "suggestion" | "connection";
  title: string;
  description: string;
  relevantNoteIds?: string[];
  relevantPersonIds?: string[];
}

export interface ExtractedTodo {
  title: string;
  description?: string;
}

export class AIProviderError extends Error {
  constructor(message: string, public provider: AIProvider) {
    super(message);
    this.name = 'AIProviderError';
  }
}

class AIServiceImpl {
  private getOpenAIClient(apiKey: string): OpenAI {
    return new OpenAI({ apiKey });
  }

  private getGeminiClient(apiKey: string): GoogleGenAI {
    return new GoogleGenAI({ apiKey });
  }

  private getGrokClient(apiKey: string): OpenAI {
    return new OpenAI({ 
      baseURL: "https://api.x.ai/v1", 
      apiKey 
    });
  }

  async extractTodosFromNote(noteContent: string, config: AIConfig): Promise<ExtractedTodo[]> {
    try {
      const prompt = `Extract actionable todos from the following note content. Return only clear, specific action items that need to be done. Format as JSON with a 'todos' array containing objects with 'title' and optional 'description' fields.

Note content:
${noteContent}

Return format: {"todos": [{"title": "Action item", "description": "Optional details"}]}`;

      let result: any;

      switch (config.provider) {
        case "openai":
          const openai = this.getOpenAIClient(config.apiKey);
          const openaiResponse = await openai.chat.completions.create({
            model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          });
          result = JSON.parse(openaiResponse.choices[0].message.content || "{}");
          break;

        case "gemini":
          const gemini = this.getGeminiClient(config.apiKey);
          const geminiResponse = await gemini.models.generateContent({
            model: "gemini-2.5-pro",
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "object",
                properties: {
                  todos: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" }
                      },
                      required: ["title"]
                    }
                  }
                },
                required: ["todos"]
              }
            },
            contents: prompt,
          });
          result = JSON.parse(geminiResponse.text || "{}");
          break;

        case "grok":
          const grok = this.getGrokClient(config.apiKey);
          const grokResponse = await grok.chat.completions.create({
            model: "grok-2-1212",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          });
          result = JSON.parse(grokResponse.choices[0].message.content || "{}");
          break;

        default:
          throw new AIProviderError(`Unsupported AI provider: ${config.provider}`, config.provider);
      }

      return Array.isArray(result.todos) ? result.todos : [];
    } catch (error) {
      console.error(`Error extracting todos with ${config.provider}:`, error);
      throw new AIProviderError(`Failed to extract todos: ${error.message}`, config.provider);
    }
  }

  async generateInsights(
    notes: Array<{ id: string; title: string; content: string }>,
    people: Array<{ id: string; name: string }>,
    connections: Array<{ noteId: string; personId: string }>,
    config: AIConfig
  ): Promise<AIInsight[]> {
    try {
      const notesText = notes.slice(0, 10).map(n => `Note: ${n.title}\n${n.content}`).join('\n\n');
      const peopleText = people.slice(0, 10).map(p => `Person: ${p.name}`).join('\n');
      const connectionsText = connections.map(c => `Note-Person connection: ${c.noteId} -> ${c.personId}`).join('\n');

      const prompt = `Analyze this knowledge base and generate insights about patterns, connections, and suggestions. Focus on meaningful relationships and actionable suggestions.

NOTES:
${notesText}

PEOPLE:
${peopleText}

CONNECTIONS:
${connectionsText}

Generate insights as JSON with an 'insights' array containing objects with: type ("pattern"|"suggestion"|"connection"), title, description, and optional relevantNoteIds/relevantPersonIds arrays.`;

      let result: any;

      switch (config.provider) {
        case "openai":
          const openai = this.getOpenAIClient(config.apiKey);
          const openaiResponse = await openai.chat.completions.create({
            model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          });
          result = JSON.parse(openaiResponse.choices[0].message.content || "{}");
          break;

        case "gemini":
          const gemini = this.getGeminiClient(config.apiKey);
          const geminiResponse = await gemini.models.generateContent({
            model: "gemini-2.5-pro",
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "object",
                properties: {
                  insights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["pattern", "suggestion", "connection"] },
                        title: { type: "string" },
                        description: { type: "string" },
                        relevantNoteIds: { type: "array", items: { type: "string" } },
                        relevantPersonIds: { type: "array", items: { type: "string" } }
                      },
                      required: ["type", "title", "description"]
                    }
                  }
                },
                required: ["insights"]
              }
            },
            contents: prompt,
          });
          result = JSON.parse(geminiResponse.text || "{}");
          break;

        case "grok":
          const grok = this.getGrokClient(config.apiKey);
          const grokResponse = await grok.chat.completions.create({
            model: "grok-2-1212",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          });
          result = JSON.parse(grokResponse.choices[0].message.content || "{}");
          break;

        default:
          throw new AIProviderError(`Unsupported AI provider: ${config.provider}`, config.provider);
      }

      return Array.isArray(result.insights) ? result.insights : [];
    } catch (error) {
      console.error(`Error generating insights with ${config.provider}:`, error);
      throw new AIProviderError(`Failed to generate insights: ${error.message}`, config.provider);
    }
  }

  async analyzeRelationships(
    noteContent: string,
    peopleList: Array<{ id: string; name: string }>,
    config: AIConfig
  ): Promise<string[]> {
    try {
      const peopleNames = peopleList.map(p => `${p.id}: ${p.name}`).join('\n');
      
      const prompt = `Analyze this note content and identify which people are mentioned or referenced. Return a JSON object with a 'mentionedPeople' array containing the IDs of mentioned people.

Note content: ${noteContent}

Known people:
${peopleNames}

Return format: {"mentionedPeople": ["id1", "id2"]}`;

      let result: any;

      switch (config.provider) {
        case "openai":
          const openai = this.getOpenAIClient(config.apiKey);
          const openaiResponse = await openai.chat.completions.create({
            model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          });
          result = JSON.parse(openaiResponse.choices[0].message.content || "{}");
          break;

        case "gemini":
          const gemini = this.getGeminiClient(config.apiKey);
          const geminiResponse = await gemini.models.generateContent({
            model: "gemini-2.5-pro",
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "object",
                properties: {
                  mentionedPeople: {
                    type: "array",
                    items: { type: "string" }
                  }
                },
                required: ["mentionedPeople"]
              }
            },
            contents: prompt,
          });
          result = JSON.parse(geminiResponse.text || "{}");
          break;

        case "grok":
          const grok = this.getGrokClient(config.apiKey);
          const grokResponse = await grok.chat.completions.create({
            model: "grok-2-1212",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          });
          result = JSON.parse(grokResponse.choices[0].message.content || "{}");
          break;

        default:
          throw new AIProviderError(`Unsupported AI provider: ${config.provider}`, config.provider);
      }

      return Array.isArray(result.mentionedPeople) ? result.mentionedPeople : [];
    } catch (error) {
      console.error(`Error analyzing relationships with ${config.provider}:`, error);
      throw new AIProviderError(`Failed to analyze relationships: ${error.message}`, config.provider);
    }
  }

  async summarizeNote(content: string, config: AIConfig): Promise<string> {
    try {
      const prompt = `Summarize the key points of this note content in 2-3 sentences:

${content}`;

      let result: string;

      switch (config.provider) {
        case "openai":
          const openai = this.getOpenAIClient(config.apiKey);
          const openaiResponse = await openai.chat.completions.create({
            model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
            messages: [{ role: "user", content: prompt }],
          });
          result = openaiResponse.choices[0].message.content || "";
          break;

        case "gemini":
          const gemini = this.getGeminiClient(config.apiKey);
          const geminiResponse = await gemini.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
          });
          result = geminiResponse.text || "";
          break;

        case "grok":
          const grok = this.getGrokClient(config.apiKey);
          const grokResponse = await grok.chat.completions.create({
            model: "grok-2-1212",
            messages: [{ role: "user", content: prompt }],
          });
          result = grokResponse.choices[0].message.content || "";
          break;

        default:
          throw new AIProviderError(`Unsupported AI provider: ${config.provider}`, config.provider);
      }

      return result;
    } catch (error) {
      console.error(`Error summarizing note with ${config.provider}:`, error);
      throw new AIProviderError(`Failed to summarize note: ${error.message}`, config.provider);
    }
  }
}

const aiServiceImpl = new AIServiceImpl();

// Graceful fallback functions for when AI is not configured
export async function extractTodosFromNote(
  noteContent: string, 
  config?: AIConfig
): Promise<ExtractedTodo[]> {
  if (!config?.apiKey) {
    return []; // Graceful fallback when no AI config
  }
  return aiServiceImpl.extractTodosFromNote(noteContent, config);
}

export async function generateInsights(
  notes: Array<{ id: string; title: string; content: string }>,
  people: Array<{ id: string; name: string }>,
  connections: Array<{ noteId: string; personId: string }>,
  config?: AIConfig
): Promise<AIInsight[]> {
  if (!config?.apiKey) {
    return []; // Graceful fallback when no AI config
  }
  return aiServiceImpl.generateInsights(notes, people, connections, config);
}

export async function analyzeRelationships(
  noteContent: string,
  peopleList: Array<{ id: string; name: string }>,
  config?: AIConfig
): Promise<string[]> {
  if (!config?.apiKey) {
    return []; // Graceful fallback when no AI config
  }
  return aiServiceImpl.analyzeRelationships(noteContent, peopleList, config);
}

export async function summarizeNote(
  content: string,
  config?: AIConfig
): Promise<string> {
  if (!config?.apiKey) {
    return ""; // Graceful fallback when no AI config
  }
  return aiServiceImpl.summarizeNote(content, config);
}

// For backward compatibility
export class AIService {
  async extractTodosFromNote(content: string, config?: AIConfig): Promise<ExtractedTodo[]> {
    return extractTodosFromNote(content, config);
  }

  async generateInsights(
    notes: Array<{ id: string; title: string; content: string }>,
    people: Array<{ id: string; name: string }>,
    connections: Array<{ noteId: string; personId: string }>,
    config?: AIConfig
  ): Promise<AIInsight[]> {
    return generateInsights(notes, people, connections, config);
  }

  async analyzeRelationships(
    noteContent: string,
    peopleList: Array<{ id: string; name: string }>,
    config?: AIConfig
  ): Promise<string[]> {
    return analyzeRelationships(noteContent, peopleList, config);
  }

  async summarizeNote(content: string, config?: AIConfig): Promise<string> {
    return summarizeNote(content, config);
  }
}

export const aiService = new AIService();
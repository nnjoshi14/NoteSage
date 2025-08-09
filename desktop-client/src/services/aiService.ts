import axios, { AxiosInstance } from 'axios';

export interface AIProvider {
  id: string;
  name: string;
  baseUrl: string;
  requiresApiKey: boolean;
}

export interface AIConfig {
  provider: string;
  apiKey: string;
  enabled: boolean;
}

export interface TodoExtractionResult {
  todos: Array<{
    text: string;
    assignedPerson?: string;
    dueDate?: string;
    priority?: 'low' | 'medium' | 'high';
  }>;
  confidence: number;
}

export interface PeopleMentionAnalysis {
  mentions: Array<{
    name: string;
    context: string;
    confidence: number;
    suggestedPersonId?: string;
  }>;
  relationships: Array<{
    person1: string;
    person2: string;
    relationshipType: string;
    confidence: number;
  }>;
}

export interface InsightResult {
  insights: Array<{
    type: 'pattern' | 'suggestion' | 'connection' | 'trend';
    title: string;
    description: string;
    confidence: number;
    actionable?: boolean;
    relatedNotes?: string[];
    relatedPeople?: string[];
  }>;
  summary: string;
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI GPT',
    baseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    requiresApiKey: true,
  },
  {
    id: 'grok',
    name: 'Grok (X.AI)',
    baseUrl: 'https://api.x.ai/v1',
    requiresApiKey: true,
  },
];

class AIService {
  private client: AxiosInstance | null = null;
  private config: AIConfig | null = null;
  private isAvailable: boolean = false;

  constructor() {
    // Don't auto-load config in constructor to avoid issues in tests
    // Config will be loaded when needed
  }

  async initialize(): Promise<void> {
    await this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      // Load AI config from secure storage via IPC
      const config = await window.electronAPI?.getAIConfig();
      if (config) {
        this.config = config;
        this.initializeClient();
      }
    } catch (error) {
      console.warn('Failed to load AI config:', error);
      this.isAvailable = false;
    }
  }

  private initializeClient(): void {
    if (!this.config || !this.config.enabled) {
      this.isAvailable = false;
      return;
    }

    const provider = AI_PROVIDERS.find(p => p.id === this.config!.provider);
    if (!provider) {
      console.error('Unknown AI provider:', this.config.provider);
      this.isAvailable = false;
      return;
    }

    this.client = axios.create({
      baseURL: provider.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    });

    this.isAvailable = true;
  }

  async updateConfig(config: AIConfig): Promise<void> {
    try {
      // Save config securely via IPC
      await window.electronAPI?.setAIConfig(config);
      this.config = config;
      this.initializeClient();
    } catch (error) {
      console.error('Failed to update AI config:', error);
      throw new Error('Failed to save AI configuration');
    }
  }

  getConfig(): AIConfig | null {
    return this.config;
  }

  isServiceAvailable(): boolean {
    return this.isAvailable && this.config?.enabled === true;
  }

  async testConnection(): Promise<boolean> {
    if (!this.isServiceAvailable() || !this.client) {
      return false;
    }

    try {
      const provider = AI_PROVIDERS.find(p => p.id === this.config!.provider);
      
      if (provider?.id === 'openai') {
        await this.client.get('/models');
      } else if (provider?.id === 'gemini') {
        await this.client.get('/models');
      } else if (provider?.id === 'grok') {
        await this.client.get('/models');
      }
      
      return true;
    } catch (error) {
      console.error('AI service connection test failed:', error);
      return false;
    }
  }

  async extractTodos(noteContent: string): Promise<TodoExtractionResult> {
    if (!this.isServiceAvailable()) {
      throw new Error('AI service is not available');
    }

    try {
      const prompt = this.buildTodoExtractionPrompt(noteContent);
      const response = await this.makeAIRequest(prompt);
      
      return this.parseTodoExtractionResponse(response);
    } catch (error) {
      console.error('Todo extraction failed:', error);
      if (!this.isServiceAvailable()) {
        throw new Error('AI service is not available');
      }
      throw new Error('Failed to extract todos from note content');
    }
  }

  async analyzePeopleMentions(noteContent: string, existingPeople: Array<{id: string, name: string}>): Promise<PeopleMentionAnalysis> {
    if (!this.isServiceAvailable()) {
      throw new Error('AI service is not available');
    }

    try {
      const prompt = this.buildPeopleMentionPrompt(noteContent, existingPeople);
      const response = await this.makeAIRequest(prompt);
      
      return this.parsePeopleMentionResponse(response);
    } catch (error) {
      console.error('People mention analysis failed:', error);
      if (!this.isServiceAvailable()) {
        throw new Error('AI service is not available');
      }
      throw new Error('Failed to analyze people mentions');
    }
  }

  async generateInsights(notes: Array<{id: string, title: string, content: string, createdAt: string}>, people: Array<{id: string, name: string}>): Promise<InsightResult> {
    if (!this.isServiceAvailable()) {
      throw new Error('AI service is not available');
    }

    try {
      const prompt = this.buildInsightGenerationPrompt(notes, people);
      const response = await this.makeAIRequest(prompt);
      
      return this.parseInsightResponse(response);
    } catch (error) {
      console.error('Insight generation failed:', error);
      if (!this.isServiceAvailable()) {
        throw new Error('AI service is not available');
      }
      throw new Error('Failed to generate insights');
    }
  }

  private async makeAIRequest(prompt: string): Promise<string> {
    if (!this.client || !this.config) {
      throw new Error('AI client not initialized');
    }

    const provider = AI_PROVIDERS.find(p => p.id === this.config!.provider);
    
    if (provider?.id === 'openai') {
      const response = await this.client.post('/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      });
      return response.data.choices[0].message.content;
    } else if (provider?.id === 'gemini') {
      const response = await this.client.post('/models/gemini-pro:generateContent', {
        contents: [{ parts: [{ text: prompt }] }],
      });
      return response.data.candidates[0].content.parts[0].text;
    } else if (provider?.id === 'grok') {
      const response = await this.client.post('/chat/completions', {
        model: 'grok-beta',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      });
      return response.data.choices[0].message.content;
    }

    throw new Error('Unsupported AI provider');
  }

  private buildTodoExtractionPrompt(noteContent: string): string {
    return `
Analyze the following note content and extract actionable todo items. Return the result as JSON.

Note content:
${noteContent}

Please identify:
1. Clear action items or tasks
2. Assigned people (if mentioned with @)
3. Due dates (if mentioned)
4. Priority level (if indicated)

Return JSON format:
{
  "todos": [
    {
      "text": "Complete the report",
      "assignedPerson": "John Smith",
      "dueDate": "2024-01-15",
      "priority": "high"
    }
  ],
  "confidence": 0.85
}

Only extract clear, actionable items. Ignore vague statements or completed tasks.
`;
  }

  private buildPeopleMentionPrompt(noteContent: string, existingPeople: Array<{id: string, name: string}>): string {
    const peopleList = existingPeople.map(p => `- ${p.name} (ID: ${p.id})`).join('\n');
    
    return `
Analyze the following note content for people mentions and relationships. Return the result as JSON.

Note content:
${noteContent}

Existing people in database:
${peopleList}

Please identify:
1. People mentioned in the text (including @mentions)
2. Relationships between people
3. Match mentions to existing people when possible

Return JSON format:
{
  "mentions": [
    {
      "name": "John Smith",
      "context": "discussed project timeline",
      "confidence": 0.9,
      "suggestedPersonId": "existing-person-id-if-match"
    }
  ],
  "relationships": [
    {
      "person1": "John Smith",
      "person2": "Sarah Johnson",
      "relationshipType": "colleague",
      "confidence": 0.8
    }
  ]
}
`;
  }

  private buildInsightGenerationPrompt(notes: Array<{id: string, title: string, content: string, createdAt: string}>, people: Array<{id: string, name: string}>): string {
    const noteSummary = notes.slice(0, 10).map(n => `- ${n.title} (${n.createdAt})`).join('\n');
    const peopleList = people.slice(0, 20).map(p => p.name).join(', ');
    
    return `
Analyze the user's knowledge base and generate insights. Return the result as JSON.

Recent notes:
${noteSummary}

People in network:
${peopleList}

Please identify:
1. Patterns in note-taking or topics
2. Suggestions for better organization
3. Important connections between notes/people
4. Trends over time

Return JSON format:
{
  "insights": [
    {
      "type": "pattern",
      "title": "Frequent Meeting Notes",
      "description": "You create many meeting notes but rarely follow up on action items",
      "confidence": 0.8,
      "actionable": true,
      "relatedNotes": ["note-id-1", "note-id-2"]
    }
  ],
  "summary": "Your knowledge base shows strong focus on project management with opportunities for better task tracking."
}

Focus on actionable insights that help improve productivity and knowledge management.
`;
  }

  private parseTodoExtractionResponse(response: string): TodoExtractionResult {
    try {
      const parsed = JSON.parse(response);
      return {
        todos: parsed.todos || [],
        confidence: parsed.confidence || 0.5,
      };
    } catch (error) {
      console.error('Failed to parse todo extraction response:', error);
      return { todos: [], confidence: 0 };
    }
  }

  private parsePeopleMentionResponse(response: string): PeopleMentionAnalysis {
    try {
      const parsed = JSON.parse(response);
      return {
        mentions: parsed.mentions || [],
        relationships: parsed.relationships || [],
      };
    } catch (error) {
      console.error('Failed to parse people mention response:', error);
      return { mentions: [], relationships: [] };
    }
  }

  private parseInsightResponse(response: string): InsightResult {
    try {
      const parsed = JSON.parse(response);
      return {
        insights: parsed.insights || [],
        summary: parsed.summary || 'No insights available.',
      };
    } catch (error) {
      console.error('Failed to parse insight response:', error);
      return { insights: [], summary: 'Failed to generate insights.' };
    }
  }
}

export const aiService = new AIService();
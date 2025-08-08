import { aiService, AI_PROVIDERS } from '../aiService';

// Mock the window.electronAPI
const mockElectronAPI = {
  getAIConfig: jest.fn(),
  setAIConfig: jest.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
  })),
}));

describe('AIService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AI Providers', () => {
    it('should have correct provider configurations', () => {
      expect(AI_PROVIDERS).toHaveLength(3);
      
      const openai = AI_PROVIDERS.find(p => p.id === 'openai');
      expect(openai).toBeDefined();
      expect(openai?.name).toBe('OpenAI GPT');
      expect(openai?.baseUrl).toBe('https://api.openai.com/v1');
      expect(openai?.requiresApiKey).toBe(true);

      const gemini = AI_PROVIDERS.find(p => p.id === 'gemini');
      expect(gemini).toBeDefined();
      expect(gemini?.name).toBe('Google Gemini');
      expect(gemini?.baseUrl).toBe('https://generativelanguage.googleapis.com/v1');
      expect(gemini?.requiresApiKey).toBe(true);

      const grok = AI_PROVIDERS.find(p => p.id === 'grok');
      expect(grok).toBeDefined();
      expect(grok?.name).toBe('Grok (X.AI)');
      expect(grok?.baseUrl).toBe('https://api.x.ai/v1');
      expect(grok?.requiresApiKey).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    it('should load config from electron API', async () => {
      const mockConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        enabled: true,
      };

      mockElectronAPI.getAIConfig.mockResolvedValue(mockConfig);

      // Create a new instance to trigger config loading
      const service = new (aiService.constructor as any)();
      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for async loading

      expect(mockElectronAPI.getAIConfig).toHaveBeenCalled();
    });

    it('should update config via electron API', async () => {
      const newConfig = {
        provider: 'gemini',
        apiKey: 'new-key',
        enabled: true,
      };

      mockElectronAPI.setAIConfig.mockResolvedValue(undefined);

      await aiService.updateConfig(newConfig);

      expect(mockElectronAPI.setAIConfig).toHaveBeenCalledWith(newConfig);
    });

    it('should handle config loading errors gracefully', async () => {
      mockElectronAPI.getAIConfig.mockRejectedValue(new Error('Config error'));

      // Should not throw
      const service = new (aiService.constructor as any)();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(service.isServiceAvailable()).toBe(false);
    });
  });

  describe('Service Availability', () => {
    it('should return false when no config is loaded', () => {
      expect(aiService.isServiceAvailable()).toBe(false);
    });

    it('should return false when AI is disabled', async () => {
      const disabledConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        enabled: false,
      };

      mockElectronAPI.setAIConfig.mockResolvedValue(undefined);
      await aiService.updateConfig(disabledConfig);

      expect(aiService.isServiceAvailable()).toBe(false);
    });

    it('should return true when properly configured and enabled', async () => {
      const validConfig = {
        provider: 'openai',
        apiKey: 'test-key',
        enabled: true,
      };

      mockElectronAPI.setAIConfig.mockResolvedValue(undefined);
      await aiService.updateConfig(validConfig);

      expect(aiService.isServiceAvailable()).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when AI service is not available for todo extraction', async () => {
      await expect(aiService.extractTodos('test content')).rejects.toThrow(
        'AI service is not available'
      );
    });

    it('should throw error when AI service is not available for people analysis', async () => {
      await expect(aiService.analyzePeopleMentions('test content', [])).rejects.toThrow(
        'AI service is not available'
      );
    });

    it('should throw error when AI service is not available for insights', async () => {
      await expect(aiService.generateInsights([], [])).rejects.toThrow(
        'AI service is not available'
      );
    });
  });

  describe('Response Parsing', () => {
    it('should parse todo extraction response correctly', () => {
      const mockResponse = JSON.stringify({
        todos: [
          {
            text: 'Complete the report',
            assignedPerson: 'John Smith',
            dueDate: '2024-01-15',
            priority: 'high'
          }
        ],
        confidence: 0.85
      });

      // Access private method for testing
      const result = (aiService as any).parseTodoExtractionResponse(mockResponse);

      expect(result.todos).toHaveLength(1);
      expect(result.todos[0].text).toBe('Complete the report');
      expect(result.todos[0].assignedPerson).toBe('John Smith');
      expect(result.todos[0].dueDate).toBe('2024-01-15');
      expect(result.todos[0].priority).toBe('high');
      expect(result.confidence).toBe(0.85);
    });

    it('should handle malformed todo extraction response', () => {
      const malformedResponse = 'invalid json';

      const result = (aiService as any).parseTodoExtractionResponse(malformedResponse);

      expect(result.todos).toEqual([]);
      expect(result.confidence).toBe(0);
    });

    it('should parse people mention response correctly', () => {
      const mockResponse = JSON.stringify({
        mentions: [
          {
            name: 'John Smith',
            context: 'discussed project timeline',
            confidence: 0.9,
            suggestedPersonId: 'person-123'
          }
        ],
        relationships: [
          {
            person1: 'John Smith',
            person2: 'Sarah Johnson',
            relationshipType: 'colleague',
            confidence: 0.8
          }
        ]
      });

      const result = (aiService as any).parsePeopleMentionResponse(mockResponse);

      expect(result.mentions).toHaveLength(1);
      expect(result.mentions[0].name).toBe('John Smith');
      expect(result.mentions[0].context).toBe('discussed project timeline');
      expect(result.mentions[0].confidence).toBe(0.9);
      expect(result.mentions[0].suggestedPersonId).toBe('person-123');

      expect(result.relationships).toHaveLength(1);
      expect(result.relationships[0].person1).toBe('John Smith');
      expect(result.relationships[0].person2).toBe('Sarah Johnson');
      expect(result.relationships[0].relationshipType).toBe('colleague');
      expect(result.relationships[0].confidence).toBe(0.8);
    });

    it('should parse insight response correctly', () => {
      const mockResponse = JSON.stringify({
        insights: [
          {
            type: 'pattern',
            title: 'Frequent Meeting Notes',
            description: 'You create many meeting notes but rarely follow up on action items',
            confidence: 0.8,
            actionable: true,
            relatedNotes: ['note-1', 'note-2']
          }
        ],
        summary: 'Your knowledge base shows strong focus on project management.'
      });

      const result = (aiService as any).parseInsightResponse(mockResponse);

      expect(result.insights).toHaveLength(1);
      expect(result.insights[0].type).toBe('pattern');
      expect(result.insights[0].title).toBe('Frequent Meeting Notes');
      expect(result.insights[0].description).toBe('You create many meeting notes but rarely follow up on action items');
      expect(result.insights[0].confidence).toBe(0.8);
      expect(result.insights[0].actionable).toBe(true);
      expect(result.insights[0].relatedNotes).toEqual(['note-1', 'note-2']);
      expect(result.summary).toBe('Your knowledge base shows strong focus on project management.');
    });
  });

  describe('Prompt Building', () => {
    it('should build todo extraction prompt correctly', () => {
      const noteContent = 'Meeting notes with action items';
      
      const prompt = (aiService as any).buildTodoExtractionPrompt(noteContent);

      expect(prompt).toContain('Meeting notes with action items');
      expect(prompt).toContain('extract actionable todo items');
      expect(prompt).toContain('JSON format');
      expect(prompt).toContain('assignedPerson');
      expect(prompt).toContain('dueDate');
      expect(prompt).toContain('priority');
    });

    it('should build people mention prompt correctly', () => {
      const noteContent = 'Meeting with @john about project';
      const existingPeople = [{ id: 'person-1', name: 'John Smith' }];
      
      const prompt = (aiService as any).buildPeopleMentionPrompt(noteContent, existingPeople);

      expect(prompt).toContain('Meeting with @john about project');
      expect(prompt).toContain('John Smith (ID: person-1)');
      expect(prompt).toContain('people mentions and relationships');
      expect(prompt).toContain('JSON format');
    });

    it('should build insight generation prompt correctly', () => {
      const notes = [
        { id: 'note-1', title: 'Meeting Notes', content: 'content', createdAt: '2024-01-01' }
      ];
      const people = [{ id: 'person-1', name: 'John Smith' }];
      
      const prompt = (aiService as any).buildInsightGenerationPrompt(notes, people);

      expect(prompt).toContain('Meeting Notes (2024-01-01)');
      expect(prompt).toContain('John Smith');
      expect(prompt).toContain('knowledge base and generate insights');
      expect(prompt).toContain('JSON format');
    });
  });
});
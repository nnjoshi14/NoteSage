import { configureStore } from '@reduxjs/toolkit';
import aiReducer, {
  initializeAI,
  updateAIConfig,
  testAIConnection,
  extractTodos,
  analyzePeopleMentions,
  generateInsights,
  clearError,
  clearLastResults,
  setAIAvailable,
} from '../aiSlice';

// Mock the AI service
jest.mock('@/services/aiService', () => ({
  aiService: {
    getConfig: jest.fn(),
    isServiceAvailable: jest.fn(),
    updateConfig: jest.fn(),
    testConnection: jest.fn(),
    extractTodos: jest.fn(),
    analyzePeopleMentions: jest.fn(),
    generateInsights: jest.fn(),
  },
}));

import { aiService } from '@/services/aiService';

describe('aiSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        ai: aiReducer,
      },
    });
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState().ai;
      
      expect(state.config).toBeNull();
      expect(state.isAvailable).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.lastTodoExtraction).toBeNull();
      expect(state.lastPeopleMentionAnalysis).toBeNull();
      expect(state.insights).toBeNull();
      expect(state.insightsLastUpdated).toBeNull();
    });
  });

  describe('synchronous actions', () => {
    it('should clear error', () => {
      // Set an error first
      store.dispatch({ type: 'ai/initializeAI/rejected', payload: 'Test error' });
      
      store.dispatch(clearError());
      
      const state = store.getState().ai;
      expect(state.error).toBeNull();
    });

    it('should clear last results', () => {
      // Set some results first
      const mockTodoResult = { todos: [], confidence: 0.5 };
      const mockPeopleResult = { mentions: [], relationships: [] };
      
      store.dispatch({ type: 'ai/extractTodos/fulfilled', payload: mockTodoResult });
      store.dispatch({ type: 'ai/analyzePeopleMentions/fulfilled', payload: mockPeopleResult });
      
      store.dispatch(clearLastResults());
      
      const state = store.getState().ai;
      expect(state.lastTodoExtraction).toBeNull();
      expect(state.lastPeopleMentionAnalysis).toBeNull();
    });

    it('should set AI available status', () => {
      store.dispatch(setAIAvailable(true));
      
      const state = store.getState().ai;
      expect(state.isAvailable).toBe(true);
    });
  });

  describe('initializeAI', () => {
    it('should handle successful initialization', async () => {
      const mockConfig = { provider: 'openai', apiKey: 'test-key', enabled: true };
      aiService.getConfig.mockReturnValue(mockConfig);
      aiService.isServiceAvailable.mockReturnValue(true);

      await store.dispatch(initializeAI());

      const state = store.getState().ai;
      expect(state.config).toEqual(mockConfig);
      expect(state.isAvailable).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle initialization failure', async () => {
      aiService.getConfig.mockImplementation(() => {
        throw new Error('Initialization failed');
      });

      await store.dispatch(initializeAI());

      const state = store.getState().ai;
      expect(state.config).toBeNull();
      expect(state.isAvailable).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Initialization failed');
    });
  });

  describe('updateAIConfig', () => {
    it('should handle successful config update', async () => {
      const newConfig = { provider: 'gemini', apiKey: 'new-key', enabled: true };
      aiService.updateConfig.mockResolvedValue(undefined);
      aiService.isServiceAvailable.mockReturnValue(true);

      await store.dispatch(updateAIConfig(newConfig));

      const state = store.getState().ai;
      expect(state.config).toEqual(newConfig);
      expect(state.isAvailable).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle config update failure', async () => {
      const newConfig = { provider: 'openai', apiKey: 'test-key', enabled: true };
      aiService.updateConfig.mockRejectedValue(new Error('Update failed'));

      await store.dispatch(updateAIConfig(newConfig));

      const state = store.getState().ai;
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Update failed');
    });
  });

  describe('testAIConnection', () => {
    it('should handle successful connection test', async () => {
      aiService.testConnection.mockResolvedValue(true);

      await store.dispatch(testAIConnection());

      const state = store.getState().ai;
      expect(state.isAvailable).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle failed connection test', async () => {
      aiService.testConnection.mockResolvedValue(false);

      await store.dispatch(testAIConnection());

      const state = store.getState().ai;
      expect(state.isAvailable).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Connection test failed - please check your configuration');
    });

    it('should handle connection test error', async () => {
      aiService.testConnection.mockRejectedValue(new Error('Connection error'));

      await store.dispatch(testAIConnection());

      const state = store.getState().ai;
      expect(state.isAvailable).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Connection error');
    });
  });

  describe('extractTodos', () => {
    it('should handle successful todo extraction', async () => {
      const mockResult = {
        todos: [
          { text: 'Complete report', assignedPerson: 'John', dueDate: '2024-01-15', priority: 'high' }
        ],
        confidence: 0.9
      };
      aiService.extractTodos.mockResolvedValue(mockResult);

      await store.dispatch(extractTodos('test note content'));

      const state = store.getState().ai;
      expect(state.lastTodoExtraction).toEqual(mockResult);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle todo extraction failure', async () => {
      aiService.extractTodos.mockRejectedValue(new Error('Extraction failed'));

      await store.dispatch(extractTodos('test note content'));

      const state = store.getState().ai;
      expect(state.lastTodoExtraction).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Extraction failed');
    });
  });

  describe('analyzePeopleMentions', () => {
    it('should handle successful people mention analysis', async () => {
      const mockResult = {
        mentions: [
          { name: 'John Smith', context: 'meeting discussion', confidence: 0.9 }
        ],
        relationships: [
          { person1: 'John', person2: 'Sarah', relationshipType: 'colleague', confidence: 0.8 }
        ]
      };
      aiService.analyzePeopleMentions.mockResolvedValue(mockResult);

      await store.dispatch(analyzePeopleMentions({
        noteContent: 'test content',
        existingPeople: [{ id: '1', name: 'John Smith' }]
      }));

      const state = store.getState().ai;
      expect(state.lastPeopleMentionAnalysis).toEqual(mockResult);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle people mention analysis failure', async () => {
      aiService.analyzePeopleMentions.mockRejectedValue(new Error('Analysis failed'));

      await store.dispatch(analyzePeopleMentions({
        noteContent: 'test content',
        existingPeople: []
      }));

      const state = store.getState().ai;
      expect(state.lastPeopleMentionAnalysis).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Analysis failed');
    });
  });

  describe('generateInsights', () => {
    it('should handle successful insight generation', async () => {
      const mockResult = {
        insights: [
          {
            type: 'pattern',
            title: 'Meeting Pattern',
            description: 'Frequent meetings detected',
            confidence: 0.8,
            actionable: true
          }
        ],
        summary: 'Your knowledge base shows meeting-heavy workflow'
      };
      aiService.generateInsights.mockResolvedValue(mockResult);

      await store.dispatch(generateInsights({
        notes: [{ id: '1', title: 'Test', content: 'content', createdAt: '2024-01-01' }],
        people: [{ id: '1', name: 'John' }]
      }));

      const state = store.getState().ai;
      expect(state.insights).toEqual(mockResult);
      expect(state.insightsLastUpdated).toBeDefined();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle insight generation failure', async () => {
      aiService.generateInsights.mockRejectedValue(new Error('Generation failed'));

      await store.dispatch(generateInsights({
        notes: [],
        people: []
      }));

      const state = store.getState().ai;
      expect(state.insights).toBeNull();
      expect(state.insightsLastUpdated).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Generation failed');
    });
  });

  describe('loading states', () => {
    it('should set loading state during async operations', () => {
      store.dispatch({ type: 'ai/initializeAI/pending' });
      expect(store.getState().ai.isLoading).toBe(true);

      store.dispatch({ type: 'ai/updateAIConfig/pending' });
      expect(store.getState().ai.isLoading).toBe(true);

      store.dispatch({ type: 'ai/testAIConnection/pending' });
      expect(store.getState().ai.isLoading).toBe(true);

      store.dispatch({ type: 'ai/extractTodos/pending' });
      expect(store.getState().ai.isLoading).toBe(true);

      store.dispatch({ type: 'ai/analyzePeopleMentions/pending' });
      expect(store.getState().ai.isLoading).toBe(true);

      store.dispatch({ type: 'ai/generateInsights/pending' });
      expect(store.getState().ai.isLoading).toBe(true);
    });
  });
});
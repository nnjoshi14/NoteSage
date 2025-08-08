import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { aiService, AIConfig, TodoExtractionResult, PeopleMentionAnalysis, InsightResult } from '@/services/aiService';

export interface AIState {
  config: AIConfig | null;
  isAvailable: boolean;
  isLoading: boolean;
  error: string | null;
  lastTodoExtraction: TodoExtractionResult | null;
  lastPeopleMentionAnalysis: PeopleMentionAnalysis | null;
  insights: InsightResult | null;
  insightsLastUpdated: string | null;
}

const initialState: AIState = {
  config: null,
  isAvailable: false,
  isLoading: false,
  error: null,
  lastTodoExtraction: null,
  lastPeopleMentionAnalysis: null,
  insights: null,
  insightsLastUpdated: null,
};

// Async thunks
export const initializeAI = createAsyncThunk(
  'ai/initialize',
  async (_, { rejectWithValue }) => {
    try {
      await aiService.initialize();
      const config = aiService.getConfig();
      const isAvailable = aiService.isServiceAvailable();
      return { config, isAvailable };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to initialize AI');
    }
  }
);

export const updateAIConfig = createAsyncThunk(
  'ai/updateConfig',
  async (config: AIConfig, { rejectWithValue }) => {
    try {
      await aiService.updateConfig(config);
      const isAvailable = aiService.isServiceAvailable();
      return { config, isAvailable };
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to update AI config');
    }
  }
);

export const testAIConnection = createAsyncThunk(
  'ai/testConnection',
  async (_, { rejectWithValue }) => {
    try {
      const isConnected = await aiService.testConnection();
      return isConnected;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Connection test failed');
    }
  }
);

export const extractTodos = createAsyncThunk(
  'ai/extractTodos',
  async (noteContent: string, { rejectWithValue }) => {
    try {
      const result = await aiService.extractTodos(noteContent);
      return result;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Todo extraction failed');
    }
  }
);

export const analyzePeopleMentions = createAsyncThunk(
  'ai/analyzePeopleMentions',
  async (
    { noteContent, existingPeople }: { 
      noteContent: string; 
      existingPeople: Array<{id: string, name: string}> 
    },
    { rejectWithValue }
  ) => {
    try {
      const result = await aiService.analyzePeopleMentions(noteContent, existingPeople);
      return result;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'People mention analysis failed');
    }
  }
);

export const generateInsights = createAsyncThunk(
  'ai/generateInsights',
  async (
    {
      notes,
      people,
    }: {
      notes: Array<{id: string, title: string, content: string, createdAt: string}>;
      people: Array<{id: string, name: string}>;
    },
    { rejectWithValue }
  ) => {
    try {
      const result = await aiService.generateInsights(notes, people);
      return result;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Insight generation failed');
    }
  }
);

const aiSlice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearLastResults: (state) => {
      state.lastTodoExtraction = null;
      state.lastPeopleMentionAnalysis = null;
    },
    setAIAvailable: (state, action: PayloadAction<boolean>) => {
      state.isAvailable = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Initialize AI
      .addCase(initializeAI.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(initializeAI.fulfilled, (state, action) => {
        state.isLoading = false;
        state.config = action.payload.config;
        state.isAvailable = action.payload.isAvailable;
      })
      .addCase(initializeAI.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAvailable = false;
      })

      // Update AI config
      .addCase(updateAIConfig.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateAIConfig.fulfilled, (state, action) => {
        state.isLoading = false;
        state.config = action.payload.config;
        state.isAvailable = action.payload.isAvailable;
      })
      .addCase(updateAIConfig.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Test AI connection
      .addCase(testAIConnection.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(testAIConnection.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAvailable = action.payload;
        if (!action.payload) {
          state.error = 'Connection test failed - please check your configuration';
        }
      })
      .addCase(testAIConnection.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAvailable = false;
      })

      // Extract todos
      .addCase(extractTodos.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(extractTodos.fulfilled, (state, action) => {
        state.isLoading = false;
        state.lastTodoExtraction = action.payload;
      })
      .addCase(extractTodos.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Analyze people mentions
      .addCase(analyzePeopleMentions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(analyzePeopleMentions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.lastPeopleMentionAnalysis = action.payload;
      })
      .addCase(analyzePeopleMentions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Generate insights
      .addCase(generateInsights.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(generateInsights.fulfilled, (state, action) => {
        state.isLoading = false;
        state.insights = action.payload;
        state.insightsLastUpdated = new Date().toISOString();
      })
      .addCase(generateInsights.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, clearLastResults, setAIAvailable } = aiSlice.actions;
export default aiSlice.reducer;
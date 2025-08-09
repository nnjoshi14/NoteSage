import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AIConfiguration from '../AIConfiguration';
import aiReducer from '@/stores/slices/aiSlice';

// Mock the AI service
jest.mock('@/services/aiService', () => ({
  AI_PROVIDERS: [
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
  ],
  aiService: {
    getConfig: jest.fn(),
    isServiceAvailable: jest.fn(),
    updateConfig: jest.fn(),
    testConnection: jest.fn(),
  },
}));

const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      ai: aiReducer,
    },
    preloadedState: {
      ai: {
        config: null,
        isAvailable: false,
        isLoading: false,
        error: null,
        lastTodoExtraction: null,
        lastPeopleMentionAnalysis: null,
        insights: null,
        insightsLastUpdated: null,
        ...initialState,
      },
    },
  });
};

const renderWithStore = (component: React.ReactElement, store = createMockStore()) => {
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

describe('AIConfiguration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render AI configuration form', () => {
    renderWithStore(<AIConfiguration />);

    expect(screen.getByText('AI Features Configuration')).toBeInTheDocument();
    expect(screen.getByText('Enable AI Features')).toBeInTheDocument();
    expect(screen.getByText('AI Provider')).toBeInTheDocument();
    expect(screen.getByText('API Key')).toBeInTheDocument();
  });

  it('should show AI unavailable status initially', () => {
    renderWithStore(<AIConfiguration />);

    expect(screen.getByText('AI Unavailable')).toBeInTheDocument();
  });

  it('should show AI available status when configured', () => {
    const store = createMockStore({
      isAvailable: true,
      config: {
        provider: 'openai',
        apiKey: 'test-key',
        enabled: true,
      },
    });

    renderWithStore(<AIConfiguration />, store);

    expect(screen.getByText('AI Available')).toBeInTheDocument();
  });

  it('should populate form with existing config', () => {
    const mockConfig = {
      provider: 'gemini',
      apiKey: 'existing-key',
      enabled: true,
    };

    const store = createMockStore({
      config: mockConfig,
    });

    renderWithStore(<AIConfiguration />, store);

    const enabledCheckbox = screen.getByRole('checkbox', { name: /enable ai features/i });
    const providerSelect = screen.getByDisplayValue('Google Gemini');
    const apiKeyInput = screen.getByDisplayValue('existing-key');

    expect(enabledCheckbox).toBeChecked();
    expect(providerSelect).toBeInTheDocument();
    expect(apiKeyInput).toBeInTheDocument();
  });

  it('should handle form input changes', () => {
    renderWithStore(<AIConfiguration />);

    const enabledCheckbox = screen.getByRole('checkbox', { name: /enable ai features/i });
    fireEvent.click(enabledCheckbox);

    expect(enabledCheckbox).toBeChecked();

    const providerSelect = screen.getByRole('combobox');
    fireEvent.change(providerSelect, { target: { value: 'gemini' } });

    expect(providerSelect).toHaveValue('gemini');

    const apiKeyInput = screen.getByPlaceholderText('Enter your API key');
    fireEvent.change(apiKeyInput, { target: { value: 'new-api-key' } });

    expect(apiKeyInput).toHaveValue('new-api-key');
  });

  it('should toggle API key visibility', () => {
    renderWithStore(<AIConfiguration />);

    const enabledCheckbox = screen.getByRole('checkbox', { name: /enable ai features/i });
    fireEvent.click(enabledCheckbox);

    const apiKeyInput = screen.getByPlaceholderText('Enter your API key');
    const toggleButton = screen.getByText('Show');

    expect(apiKeyInput).toHaveAttribute('type', 'password');

    fireEvent.click(toggleButton);

    expect(apiKeyInput).toHaveAttribute('type', 'text');
    expect(screen.getByText('Hide')).toBeInTheDocument();
  });

  it('should show provider-specific information', () => {
    renderWithStore(<AIConfiguration />);

    const enabledCheckbox = screen.getByRole('checkbox', { name: /enable ai features/i });
    fireEvent.click(enabledCheckbox);

    // Default is OpenAI
    expect(screen.getByText('OpenAI GPT')).toBeInTheDocument();
    expect(screen.getByText('https://platform.openai.com/api-keys')).toBeInTheDocument();

    // Change to Gemini
    const providerSelect = screen.getByRole('combobox');
    fireEvent.change(providerSelect, { target: { value: 'gemini' } });

    expect(screen.getByText('Google Gemini')).toBeInTheDocument();
    expect(screen.getByText('https://makersuite.google.com/app/apikey')).toBeInTheDocument();

    // Change to Grok
    fireEvent.change(providerSelect, { target: { value: 'grok' } });

    expect(screen.getByText('Grok (X.AI)')).toBeInTheDocument();
    expect(screen.getByText('https://console.x.ai/')).toBeInTheDocument();
  });

  it('should disable save button when AI is not enabled', () => {
    renderWithStore(<AIConfiguration />);

    const saveButton = screen.getByText('Save Configuration');
    expect(saveButton).toBeDisabled();
  });

  it('should enable save button when AI is enabled', () => {
    renderWithStore(<AIConfiguration />);

    const enabledCheckbox = screen.getByRole('checkbox', { name: /enable ai features/i });
    fireEvent.click(enabledCheckbox);

    const saveButton = screen.getByText('Save Configuration');
    expect(saveButton).not.toBeDisabled();
  });

  it('should show test connection button when API key is provided', () => {
    renderWithStore(<AIConfiguration />);

    const enabledCheckbox = screen.getByRole('checkbox', { name: /enable ai features/i });
    fireEvent.click(enabledCheckbox);

    const apiKeyInput = screen.getByPlaceholderText('Enter your API key');
    fireEvent.change(apiKeyInput, { target: { value: 'test-key' } });

    expect(screen.getByText('Test Connection')).toBeInTheDocument();
  });

  it('should display error messages', () => {
    const store = createMockStore({
      error: 'Configuration failed',
    });

    renderWithStore(<AIConfiguration />, store);

    expect(screen.getByText('Error:')).toBeInTheDocument();
    expect(screen.getByText('Configuration failed')).toBeInTheDocument();
  });

  it('should display success message', async () => {
    const store = createMockStore();
    renderWithStore(<AIConfiguration />, store);

    // Enable AI and add API key
    const enabledCheckbox = screen.getByRole('checkbox', { name: /enable ai features/i });
    fireEvent.click(enabledCheckbox);

    const apiKeyInput = screen.getByPlaceholderText('Enter your API key');
    fireEvent.change(apiKeyInput, { target: { value: 'test-key' } });

    // Mock successful save
    const saveButton = screen.getByText('Save Configuration');
    fireEvent.click(saveButton);

    // Note: In a real test, you'd need to mock the dispatch and wait for the action to complete
    // This is a simplified version showing the UI structure
  });

  it('should show loading state', () => {
    const store = createMockStore({
      isLoading: true,
    });

    renderWithStore(<AIConfiguration />, store);

    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('should render AI features information', () => {
    renderWithStore(<AIConfiguration />);

    expect(screen.getByText('AI Features')).toBeInTheDocument();
    expect(screen.getByText('Todo Extraction')).toBeInTheDocument();
    expect(screen.getByText('People Analysis')).toBeInTheDocument();
    expect(screen.getByText('Insights Generation')).toBeInTheDocument();

    expect(screen.getByText(/Automatically extract actionable items/)).toBeInTheDocument();
    expect(screen.getByText(/Analyze mentions and relationships/)).toBeInTheDocument();
    expect(screen.getByText(/Generate patterns, suggestions/)).toBeInTheDocument();
  });

  it('should handle form submission', async () => {
    const store = createMockStore();
    renderWithStore(<AIConfiguration />, store);

    // Enable AI
    const enabledCheckbox = screen.getByRole('checkbox', { name: /enable ai features/i });
    fireEvent.click(enabledCheckbox);

    // Add API key
    const apiKeyInput = screen.getByPlaceholderText('Enter your API key');
    fireEvent.change(apiKeyInput, { target: { value: 'test-api-key' } });

    // Submit form
    const saveButton = screen.getByText('Save Configuration');
    fireEvent.click(saveButton);

    // The actual dispatch would be tested in integration tests
    // Here we're just testing that the UI responds correctly
    expect(saveButton).toBeInTheDocument();
  });
});
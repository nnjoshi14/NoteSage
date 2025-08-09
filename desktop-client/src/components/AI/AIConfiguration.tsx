import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { updateAIConfig, testAIConnection, clearError } from '@/stores/slices/aiSlice';
import { AI_PROVIDERS, AIConfig } from '@/services/aiService';
import './AIConfiguration.css';

const AIConfiguration: React.FC = () => {
  const dispatch = useAppDispatch();
  const { config, isAvailable, isLoading, error } = useAppSelector(state => state.ai);
  
  const [formData, setFormData] = useState<AIConfig>({
    provider: 'openai',
    apiKey: '',
    enabled: false,
  });
  
  const [showApiKey, setShowApiKey] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failure' | null>(null);

  useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  useEffect(() => {
    if (error) {
      setTestResult('failure');
    }
  }, [error]);

  const handleInputChange = (field: keyof AIConfig, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    
    // Clear previous test results when config changes
    setTestResult(null);
    if (error) {
      dispatch(clearError());
    }
  };

  const handleSave = async () => {
    try {
      await dispatch(updateAIConfig(formData)).unwrap();
      setTestResult('success');
    } catch {
      setTestResult('failure');
    }
  };

  const handleTestConnection = async () => {
    if (!formData.apiKey || !formData.enabled) {
      return;
    }

    // Save config first, then test
    try {
      await dispatch(updateAIConfig(formData)).unwrap();
      await dispatch(testAIConnection()).unwrap();
      setTestResult('success');
    } catch {
      setTestResult('failure');
    }
  };

  const selectedProvider = AI_PROVIDERS.find(p => p.id === formData.provider);

  return (
    <div className="ai-configuration">
      <div className="ai-config-header">
        <h3>AI Features Configuration</h3>
        <div className={`ai-status ${isAvailable ? 'available' : 'unavailable'}`}>
          <span className="status-indicator"></span>
          {isAvailable ? 'AI Available' : 'AI Unavailable'}
        </div>
      </div>

      <div className="ai-config-form">
        <div className="form-group">
          <label htmlFor="ai-enabled">
            <input
              id="ai-enabled"
              type="checkbox"
              checked={formData.enabled}
              onChange={(e) => handleInputChange('enabled', e.target.checked)}
            />
            Enable AI Features
          </label>
          <small className="form-text">
            Enable AI-powered todo extraction, people analysis, and insights generation
          </small>
        </div>

        {formData.enabled && (
          <>
            <div className="form-group">
              <label htmlFor="ai-provider">AI Provider</label>
              <select
                id="ai-provider"
                value={formData.provider}
                onChange={(e) => handleInputChange('provider', e.target.value)}
                className="form-control"
              >
                {AI_PROVIDERS.map(provider => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
              {selectedProvider && (
                <small className="form-text">
                  Base URL: {selectedProvider.baseUrl}
                </small>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="ai-api-key">API Key</label>
              <div className="api-key-input">
                <input
                  id="ai-api-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={formData.apiKey}
                  onChange={(e) => handleInputChange('apiKey', e.target.value)}
                  className="form-control"
                  placeholder="Enter your API key"
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <small className="form-text">
                Your API key is stored securely and never transmitted except to the AI provider
              </small>
            </div>

            <div className="ai-provider-info">
              <h4>Provider Information</h4>
              {formData.provider === 'openai' && (
                <div className="provider-details">
                  <p><strong>OpenAI GPT</strong></p>
                  <p>Get your API key from: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI Platform</a></p>
                  <p>Supports: Todo extraction, people analysis, insights generation</p>
                </div>
              )}
              {formData.provider === 'gemini' && (
                <div className="provider-details">
                  <p><strong>Google Gemini</strong></p>
                  <p>Get your API key from: <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a></p>
                  <p>Supports: Todo extraction, people analysis, insights generation</p>
                </div>
              )}
              {formData.provider === 'grok' && (
                <div className="provider-details">
                  <p><strong>Grok (X.AI)</strong></p>
                  <p>Get your API key from: <a href="https://console.x.ai/" target="_blank" rel="noopener noreferrer">X.AI Console</a></p>
                  <p>Supports: Todo extraction, people analysis, insights generation</p>
                </div>
              )}
            </div>
          </>
        )}

        {error && (
          <div className="alert alert-danger">
            <strong>Error:</strong> {error}
          </div>
        )}

        {testResult === 'success' && (
          <div className="alert alert-success">
            <strong>Success:</strong> AI configuration saved and connection verified!
          </div>
        )}

        {testResult === 'failure' && (
          <div className="alert alert-warning">
            <strong>Warning:</strong> Configuration saved but connection test failed. Please verify your API key.
          </div>
        )}

        <div className="ai-config-actions">
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isLoading || !formData.enabled}
          >
            {isLoading ? 'Saving...' : 'Save Configuration'}
          </button>
          
          {formData.enabled && formData.apiKey && (
            <button
              className="btn btn-outline-primary"
              onClick={handleTestConnection}
              disabled={isLoading}
            >
              {isLoading ? 'Testing...' : 'Test Connection'}
            </button>
          )}
        </div>
      </div>

      <div className="ai-features-info">
        <h4>AI Features</h4>
        <div className="features-grid">
          <div className="feature-card">
            <h5>Todo Extraction</h5>
            <p>Automatically extract actionable items from your notes with assigned people and due dates.</p>
          </div>
          <div className="feature-card">
            <h5>People Analysis</h5>
            <p>Analyze mentions and relationships between people in your knowledge base.</p>
          </div>
          <div className="feature-card">
            <h5>Insights Generation</h5>
            <p>Generate patterns, suggestions, and connections from your notes and activities.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIConfiguration;
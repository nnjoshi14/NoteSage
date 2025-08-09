import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { generateInsights, clearError } from '@/stores/slices/aiSlice';
import { InsightResult } from '@/services/aiService';
import './AIInsights.css';

const AIInsights: React.FC = () => {
  const dispatch = useAppDispatch();
  const { 
    insights, 
    insightsLastUpdated, 
    isAvailable, 
    isLoading, 
    error 
  } = useAppSelector(state => state.ai);
  
  const { items: notes } = useAppSelector(state => state.notes);
  const { items: people } = useAppSelector(state => state.people);
  
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    // Auto-generate insights on component mount if AI is available and we have data
    if (isAvailable && notes.length > 0 && !insights) {
      handleGenerateInsights();
    }
  }, [isAvailable, notes.length]);

  useEffect(() => {
    // Set up auto-refresh if enabled
    if (autoRefresh && isAvailable) {
      const interval = setInterval(() => {
        handleGenerateInsights();
      }, 5 * 60 * 1000); // Refresh every 5 minutes

      return () => clearInterval(interval);
    }
  }, [autoRefresh, isAvailable]);

  const handleGenerateInsights = async () => {
    if (!isAvailable || notes.length === 0) {
      return;
    }

    const notesData = notes.map(note => ({
      id: note.id,
      title: note.title,
      content: typeof note.content === 'string' ? note.content : JSON.stringify(note.content),
      createdAt: note.createdAt,
    }));

    const peopleData = people.map(person => ({
      id: person.id,
      name: person.name,
    }));

    try {
      await dispatch(generateInsights({ notes: notesData, people: peopleData })).unwrap();
    } catch (error) {
      console.error('Failed to generate insights:', error);
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'pattern':
        return '🔍';
      case 'suggestion':
        return '💡';
      case 'connection':
        return '🔗';
      case 'trend':
        return '📈';
      default:
        return '📊';
    }
  };

  const getInsightTypeLabel = (type: string) => {
    switch (type) {
      case 'pattern':
        return 'Pattern';
      case 'suggestion':
        return 'Suggestion';
      case 'connection':
        return 'Connection';
      case 'trend':
        return 'Trend';
      default:
        return 'Insight';
    }
  };

  if (!isAvailable) {
    return (
      <div className="ai-insights">
        <div className="ai-unavailable">
          <h3>AI Insights</h3>
          <div className="unavailable-message">
            <p>AI features are not available. Please configure an AI provider in Settings to enable insights generation.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-insights">
      <div className="insights-header">
        <div className="header-content">
          <h3>AI Insights</h3>
          {insightsLastUpdated && (
            <small className="last-updated">
              Last updated: {new Date(insightsLastUpdated).toLocaleString()}
            </small>
          )}
        </div>
        
        <div className="insights-controls">
          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          
          <button
            className="btn btn-primary btn-sm"
            onClick={handleGenerateInsights}
            disabled={isLoading || notes.length === 0}
          >
            {isLoading ? 'Generating...' : 'Refresh Insights'}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <strong>Error:</strong> {error}
          <button 
            className="btn-close"
            onClick={() => dispatch(clearError())}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}

      {isLoading && (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Analyzing your knowledge base...</p>
        </div>
      )}

      {notes.length === 0 && (
        <div className="empty-state">
          <p>Create some notes to start generating insights about your knowledge base.</p>
        </div>
      )}

      {insights && !isLoading && (
        <div className="insights-content">
          {insights.summary && (
            <div className="insights-summary">
              <h4>Summary</h4>
              <p>{insights.summary}</p>
            </div>
          )}

          {insights.insights && insights.insights.length > 0 && (
            <div className="insights-list">
              <h4>Insights ({insights.insights.length})</h4>
              <div className="insights-grid">
                {insights.insights.map((insight, index) => (
                  <div 
                    key={index} 
                    className={`insight-card ${insight.actionable ? 'actionable' : ''}`}
                  >
                    <div className="insight-header">
                      <span className="insight-icon">{getInsightIcon(insight.type)}</span>
                      <div className="insight-meta">
                        <span className="insight-type">{getInsightTypeLabel(insight.type)}</span>
                        <div className="confidence-bar">
                          <div 
                            className="confidence-fill"
                            style={{ width: `${insight.confidence * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    
                    <h5 className="insight-title">{insight.title}</h5>
                    <p className="insight-description">{insight.description}</p>
                    
                    {insight.actionable && (
                      <div className="actionable-badge">
                        <span>Actionable</span>
                      </div>
                    )}
                    
                    {(insight.relatedNotes || insight.relatedPeople) && (
                      <div className="insight-relations">
                        {insight.relatedNotes && insight.relatedNotes.length > 0 && (
                          <div className="related-items">
                            <small>Related notes: {insight.relatedNotes.length}</small>
                          </div>
                        )}
                        {insight.relatedPeople && insight.relatedPeople.length > 0 && (
                          <div className="related-items">
                            <small>Related people: {insight.relatedPeople.length}</small>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!insights.insights || insights.insights.length === 0) && (
            <div className="no-insights">
              <p>No specific insights found. Try adding more notes or connecting more people to generate meaningful patterns.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIInsights;
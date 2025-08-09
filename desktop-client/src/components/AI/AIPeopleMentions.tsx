import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { analyzePeopleMentions, clearLastResults } from '@/stores/slices/aiSlice';
import { PeopleMentionAnalysis } from '@/services/aiService';
import './AIPeopleMentions.css';

interface AIPeopleMentionsProps {
  noteContent: string;
  onMentionsAnalyzed?: (analysis: PeopleMentionAnalysis) => void;
}

const AIPeopleMentions: React.FC<AIPeopleMentionsProps> = ({
  noteContent,
  onMentionsAnalyzed,
}) => {
  const dispatch = useAppDispatch();
  const { 
    lastPeopleMentionAnalysis, 
    isAvailable, 
    isLoading, 
    error 
  } = useAppSelector(state => state.ai);
  
  const { items: people } = useAppSelector(state => state.people);
  
  const [showResults, setShowResults] = useState(false);

  const handleAnalyzeMentions = async () => {
    if (!isAvailable || !noteContent.trim()) {
      return;
    }

    const existingPeople = people.map(person => ({
      id: person.id,
      name: person.name,
    }));

    try {
      const result = await dispatch(analyzePeopleMentions({ 
        noteContent, 
        existingPeople 
      })).unwrap();
      
      setShowResults(true);
      
      if (onMentionsAnalyzed) {
        onMentionsAnalyzed(result);
      }
    } catch (error) {
      console.error('People mention analysis failed:', error);
    }
  };

  const handleClearResults = () => {
    dispatch(clearLastResults());
    setShowResults(false);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#28a745';
    if (confidence >= 0.6) return '#ffc107';
    return '#dc3545';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  const getRelationshipIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'colleague':
        return '👥';
      case 'manager':
        return '👔';
      case 'friend':
        return '👫';
      case 'family':
        return '👨‍👩‍👧‍👦';
      case 'client':
        return '🤝';
      case 'partner':
        return '🤝';
      default:
        return '🔗';
    }
  };

  if (!isAvailable) {
    return (
      <div className="ai-people-mentions">
        <div className="ai-unavailable">
          <p>AI people mention analysis is not available. Please configure an AI provider in Settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-people-mentions">
      <div className="analysis-header">
        <h4>AI People Mention Analysis</h4>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleAnalyzeMentions}
          disabled={isLoading || !noteContent.trim()}
        >
          {isLoading ? 'Analyzing...' : 'Analyze Mentions'}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger">
          <strong>Error:</strong> {error}
        </div>
      )}

      {isLoading && (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Analyzing people mentions and relationships...</p>
        </div>
      )}

      {lastPeopleMentionAnalysis && showResults && !isLoading && (
        <div className="analysis-results">
          <div className="results-header">
            <h5>Analysis Results</h5>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={handleClearResults}
            >
              Clear
            </button>
          </div>

          {lastPeopleMentionAnalysis.mentions.length > 0 && (
            <div className="mentions-section">
              <h6>People Mentions ({lastPeopleMentionAnalysis.mentions.length})</h6>
              <div className="mentions-list">
                {lastPeopleMentionAnalysis.mentions.map((mention, index) => (
                  <div key={index} className="mention-item">
                    <div className="mention-content">
                      <div className="mention-header">
                        <span className="person-name">{mention.name}</span>
                        <div className="confidence-indicator">
                          <span 
                            className="confidence-badge"
                            style={{ backgroundColor: getConfidenceColor(mention.confidence) }}
                          >
                            {getConfidenceLabel(mention.confidence)}
                          </span>
                          <span className="confidence-value">
                            {Math.round(mention.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                      
                      <div className="mention-context">
                        <strong>Context:</strong> {mention.context}
                      </div>
                      
                      {mention.suggestedPersonId && (
                        <div className="suggested-match">
                          <span className="match-indicator">✓</span>
                          Matches existing person in your database
                        </div>
                      )}
                      
                      {!mention.suggestedPersonId && (
                        <div className="new-person-suggestion">
                          <span className="new-indicator">+</span>
                          New person - consider adding to your contacts
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lastPeopleMentionAnalysis.relationships.length > 0 && (
            <div className="relationships-section">
              <h6>Detected Relationships ({lastPeopleMentionAnalysis.relationships.length})</h6>
              <div className="relationships-list">
                {lastPeopleMentionAnalysis.relationships.map((relationship, index) => (
                  <div key={index} className="relationship-item">
                    <div className="relationship-content">
                      <div className="relationship-header">
                        <span className="relationship-icon">
                          {getRelationshipIcon(relationship.relationshipType)}
                        </span>
                        <div className="relationship-details">
                          <div className="relationship-people">
                            <span className="person">{relationship.person1}</span>
                            <span className="relationship-type">
                              {relationship.relationshipType}
                            </span>
                            <span className="person">{relationship.person2}</span>
                          </div>
                          <div className="confidence-indicator">
                            <span 
                              className="confidence-badge"
                              style={{ backgroundColor: getConfidenceColor(relationship.confidence) }}
                            >
                              {getConfidenceLabel(relationship.confidence)}
                            </span>
                            <span className="confidence-value">
                              {Math.round(relationship.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lastPeopleMentionAnalysis.mentions.length === 0 && 
           lastPeopleMentionAnalysis.relationships.length === 0 && (
            <div className="no-results">
              <p>No people mentions or relationships detected in the note content.</p>
              <small>Try adding @mentions or references to people in your note.</small>
            </div>
          )}
        </div>
      )}

      {!noteContent.trim() && (
        <div className="empty-content">
          <p>Add some content to your note to analyze people mentions.</p>
        </div>
      )}
    </div>
  );
};

export default AIPeopleMentions;
import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { extractTodos, clearLastResults } from '@/stores/slices/aiSlice';
import { TodoExtractionResult } from '@/services/aiService';
import './AITodoExtraction.css';

interface AITodoExtractionProps {
  noteContent: string;
  onTodosExtracted?: (todos: TodoExtractionResult['todos']) => void;
}

const AITodoExtraction: React.FC<AITodoExtractionProps> = ({
  noteContent,
  onTodosExtracted,
}) => {
  const dispatch = useAppDispatch();
  const { 
    lastTodoExtraction, 
    isAvailable, 
    isLoading, 
    error 
  } = useAppSelector(state => state.ai);
  
  const [showResults, setShowResults] = useState(false);

  const handleExtractTodos = async () => {
    if (!isAvailable || !noteContent.trim()) {
      return;
    }

    try {
      const result = await dispatch(extractTodos(noteContent)).unwrap();
      setShowResults(true);
      
      if (onTodosExtracted && result.todos.length > 0) {
        onTodosExtracted(result.todos);
      }
    } catch (error) {
      console.error('Todo extraction failed:', error);
    }
  };

  const handleClearResults = () => {
    dispatch(clearLastResults());
    setShowResults(false);
  };

  const handleAcceptTodo = (todoIndex: number) => {
    if (!lastTodoExtraction || !onTodosExtracted) return;
    
    const todo = lastTodoExtraction.todos[todoIndex];
    onTodosExtracted([todo]);
  };

  const handleAcceptAllTodos = () => {
    if (!lastTodoExtraction || !onTodosExtracted) return;
    
    onTodosExtracted(lastTodoExtraction.todos);
    handleClearResults();
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return '#dc3545';
      case 'medium':
        return '#ffc107';
      case 'low':
        return '#28a745';
      default:
        return '#6c757d';
    }
  };

  const getPriorityLabel = (priority?: string) => {
    return priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : 'Normal';
  };

  if (!isAvailable) {
    return (
      <div className="ai-todo-extraction">
        <div className="ai-unavailable">
          <p>AI todo extraction is not available. Please configure an AI provider in Settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-todo-extraction">
      <div className="extraction-header">
        <h4>AI Todo Extraction</h4>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleExtractTodos}
          disabled={isLoading || !noteContent.trim()}
        >
          {isLoading ? 'Extracting...' : 'Extract Todos'}
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
          <p>Analyzing note content for actionable items...</p>
        </div>
      )}

      {lastTodoExtraction && showResults && !isLoading && (
        <div className="extraction-results">
          <div className="results-header">
            <div className="results-info">
              <h5>Extracted Todos ({lastTodoExtraction.todos.length})</h5>
              <div className="confidence-indicator">
                <span>Confidence: </span>
                <div className="confidence-bar">
                  <div 
                    className="confidence-fill"
                    style={{ width: `${lastTodoExtraction.confidence * 100}%` }}
                  ></div>
                </div>
                <span className="confidence-value">
                  {Math.round(lastTodoExtraction.confidence * 100)}%
                </span>
              </div>
            </div>
            
            <div className="results-actions">
              {lastTodoExtraction.todos.length > 0 && onTodosExtracted && (
                <button
                  className="btn btn-success btn-sm"
                  onClick={handleAcceptAllTodos}
                >
                  Accept All
                </button>
              )}
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={handleClearResults}
              >
                Clear
              </button>
            </div>
          </div>

          {lastTodoExtraction.todos.length > 0 ? (
            <div className="todos-list">
              {lastTodoExtraction.todos.map((todo, index) => (
                <div key={index} className="todo-item">
                  <div className="todo-content">
                    <div className="todo-text">{todo.text}</div>
                    
                    <div className="todo-metadata">
                      {todo.priority && (
                        <span 
                          className="priority-badge"
                          style={{ backgroundColor: getPriorityColor(todo.priority) }}
                        >
                          {getPriorityLabel(todo.priority)}
                        </span>
                      )}
                      
                      {todo.assignedPerson && (
                        <span className="assigned-person">
                          👤 {todo.assignedPerson}
                        </span>
                      )}
                      
                      {todo.dueDate && (
                        <span className="due-date">
                          📅 {todo.dueDate}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {onTodosExtracted && (
                    <button
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => handleAcceptTodo(index)}
                    >
                      Accept
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="no-todos">
              <p>No actionable todos found in the note content.</p>
              <small>Try adding more specific action items or tasks to your note.</small>
            </div>
          )}
        </div>
      )}

      {!noteContent.trim() && (
        <div className="empty-content">
          <p>Add some content to your note to extract todos.</p>
        </div>
      )}
    </div>
  );
};

export default AITodoExtraction;
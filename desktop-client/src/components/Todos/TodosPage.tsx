import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setPeople } from '../../stores/slices/peopleSlice';
import { setTodos } from '../../stores/slices/todosSlice';
import { setCurrentNote } from '../../stores/slices/notesSlice';
import { Todo } from '../../stores/slices/todosSlice';
import TodoList from './TodoList';
import TodoForm from './TodoForm';
import CalendarView from './CalendarView';
import SyncTrigger from './SyncTrigger';
import './TodosPage.css';

type ViewMode = 'list' | 'calendar';

const TodosPage: React.FC = () => {
  const dispatch = useDispatch();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // Load cached data
      const [cachedTodos, cachedPeople, cachedNotes] = await Promise.all([
        window.electronAPI.getCachedTodos(),
        window.electronAPI.getCachedPeople(),
        window.electronAPI.getCachedNotes(),
      ]);

      dispatch(setTodos(cachedTodos));
      dispatch(setPeople(cachedPeople));
      // Don't set notes in store to avoid conflicts, just ensure they're loaded
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTodo = () => {
    setEditingTodo(null);
    setShowTodoForm(true);
  };

  const handleEditTodo = (todo: Todo) => {
    setEditingTodo(todo);
    setShowTodoForm(true);
  };

  const handleTodoSaved = (todo: Todo) => {
    setShowTodoForm(false);
    setEditingTodo(null);
    // Reload todos to get updated data
    loadInitialData();
  };

  const handleTodoFormCancel = () => {
    setShowTodoForm(false);
    setEditingTodo(null);
  };

  const handleSyncComplete = (result: any) => {
    // Reload todos after sync
    loadInitialData();
  };

  const handleDateClick = (date: Date) => {
    // Could implement creating a todo for the selected date
    console.log('Date clicked:', date);
  };

  if (isLoading) {
    return (
      <div className="todos-page-loading">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2">Loading todos...</p>
      </div>
    );
  }

  return (
    <div className="todos-page">
      {/* Header */}
      <div className="todos-header">
        <div className="todos-title">
          <h1>Todos</h1>
          <div className="todos-view-toggle">
            <div className="btn-group" role="group">
              <button
                type="button"
                className={`btn btn-outline-secondary ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                <i className="bi bi-list-ul"></i> List
              </button>
              <button
                type="button"
                className={`btn btn-outline-secondary ${viewMode === 'calendar' ? 'active' : ''}`}
                onClick={() => setViewMode('calendar')}
              >
                <i className="bi bi-calendar"></i> Calendar
              </button>
            </div>
          </div>
        </div>

        <div className="todos-actions">
          <button
            className="btn btn-primary"
            onClick={handleCreateTodo}
          >
            <i className="bi bi-plus"></i> Add Todo
          </button>
        </div>
      </div>

      {/* Sync Status */}
      <div className="todos-sync">
        <SyncTrigger onSyncComplete={handleSyncComplete} />
      </div>

      {/* Main Content */}
      <div className="todos-content">
        {showTodoForm ? (
          <div className="todos-form-container">
            <TodoForm
              todo={editingTodo || undefined}
              onSave={handleTodoSaved}
              onCancel={handleTodoFormCancel}
            />
          </div>
        ) : (
          <>
            {viewMode === 'list' ? (
              <TodoList
                onTodoClick={handleEditTodo}
                onCreateTodo={handleCreateTodo}
              />
            ) : (
              <CalendarView
                onTodoClick={handleEditTodo}
                onDateClick={handleDateClick}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TodosPage;
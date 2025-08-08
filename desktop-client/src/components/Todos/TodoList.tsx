import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../stores/store';
import { 
  setTodos, 
  toggleTodoCompleted, 
  setFilters, 
  clearFilters,
  setLoading,
  setError 
} from '../../stores/slices/todosSlice';
import { Todo } from '../../stores/slices/todosSlice';
import { Person } from '../../stores/slices/peopleSlice';
import './TodoList.css';

interface TodoListProps {
  onTodoClick?: (todo: Todo) => void;
  onCreateTodo?: () => void;
}

const TodoList: React.FC<TodoListProps> = ({ onTodoClick, onCreateTodo }) => {
  const dispatch = useDispatch();
  const { todos, filters, isLoading, error } = useSelector((state: RootState) => state.todos);
  const { people } = useSelector((state: RootState) => state.people);
  const [sortBy, setSortBy] = useState<'created_at' | 'due_date' | 'text'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadTodos();
  }, []);

  const loadTodos = async () => {
    dispatch(setLoading(true));
    try {
      const cachedTodos = await window.electronAPI.getCachedTodos();
      dispatch(setTodos(cachedTodos));
    } catch (err) {
      dispatch(setError('Failed to load todos'));
    } finally {
      dispatch(setLoading(false));
    }
  };

  const handleToggleCompleted = async (todoId: string) => {
    try {
      dispatch(toggleTodoCompleted(todoId));
      // Find the todo and update it in cache
      const todo = todos.find(t => t.id === todoId);
      if (todo) {
        const updatedTodo = { ...todo, is_completed: !todo.is_completed };
        await window.electronAPI.cacheTodo(updatedTodo);
      }
    } catch (err) {
      dispatch(setError('Failed to update todo'));
    }
  };

  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    dispatch(setFilters(newFilters));
  };

  const getPersonName = (personId?: string): string => {
    if (!personId) return '';
    const person = people.find(p => p.id === personId);
    return person ? person.name : 'Unknown';
  };

  const filteredAndSortedTodos = todos
    .filter(todo => {
      if (filters.completed !== undefined && todo.is_completed !== filters.completed) {
        return false;
      }
      if (filters.assigned_person_id && todo.assigned_person_id !== filters.assigned_person_id) {
        return false;
      }
      if (filters.note_id && todo.note_id !== filters.note_id) {
        return false;
      }
      if (filters.search && !todo.text.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'due_date':
          aValue = a.due_date || '9999-12-31';
          bValue = b.due_date || '9999-12-31';
          break;
        case 'text':
          aValue = a.text.toLowerCase();
          bValue = b.text.toLowerCase();
          break;
        default:
          aValue = a.created_at;
          bValue = b.created_at;
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const isOverdue = (dateString?: string): boolean => {
    if (!dateString) return false;
    const dueDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  if (isLoading) {
    return (
      <div className="todo-list-loading">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="todo-list">
      {/* Filters and Controls */}
      <div className="todo-list-header">
        <div className="todo-filters">
          <div className="row g-2">
            <div className="col-md-3">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search todos..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange({ search: e.target.value })}
              />
            </div>
            <div className="col-md-2">
              <select
                className="form-select form-select-sm"
                value={filters.completed === undefined ? 'all' : filters.completed ? 'completed' : 'pending'}
                onChange={(e) => {
                  const value = e.target.value;
                  handleFilterChange({ 
                    completed: value === 'all' ? undefined : value === 'completed' 
                  });
                }}
              >
                <option value="all">All Todos</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="col-md-3">
              <select
                className="form-select form-select-sm"
                value={filters.assigned_person_id || ''}
                onChange={(e) => handleFilterChange({ assigned_person_id: e.target.value || undefined })}
              >
                <option value="">All Assignees</option>
                {people.map(person => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <select
                className="form-select form-select-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="created_at">Created Date</option>
                <option value="due_date">Due Date</option>
                <option value="text">Text</option>
              </select>
            </div>
            <div className="col-md-1">
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
            <div className="col-md-1">
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => dispatch(clearFilters())}
                title="Clear Filters"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <div className="todo-actions">
          <button
            className="btn btn-primary btn-sm"
            onClick={onCreateTodo}
          >
            <i className="bi bi-plus"></i> Add Todo
          </button>
          <button
            className="btn btn-outline-secondary btn-sm ms-2"
            onClick={loadTodos}
            title="Refresh"
          >
            <i className="bi bi-arrow-clockwise"></i>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
          <button
            type="button"
            className="btn-close"
            onClick={() => dispatch(setError(undefined))}
          ></button>
        </div>
      )}

      {/* Todo List */}
      <div className="todo-items">
        {filteredAndSortedTodos.length === 0 ? (
          <div className="empty-state">
            <div className="text-center text-muted py-4">
              <i className="bi bi-check-square display-4"></i>
              <p className="mt-2">No todos found</p>
              {Object.keys(filters).length > 0 && (
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => dispatch(clearFilters())}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          filteredAndSortedTodos.map(todo => (
            <div
              key={todo.id}
              className={`todo-item ${todo.is_completed ? 'completed' : ''} ${
                isOverdue(todo.due_date) && !todo.is_completed ? 'overdue' : ''
              }`}
              onClick={() => onTodoClick?.(todo)}
            >
              <div className="todo-checkbox">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={todo.is_completed}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleToggleCompleted(todo.id);
                  }}
                />
              </div>
              
              <div className="todo-content">
                <div className="todo-text">
                  {todo.text}
                  {todo.sync_status === 'pending' && (
                    <span className="sync-indicator" title="Pending sync">
                      <i className="bi bi-cloud-upload text-warning"></i>
                    </span>
                  )}
                </div>
                
                <div className="todo-meta">
                  <span className="todo-id badge bg-secondary">
                    {todo.todo_id}
                  </span>
                  
                  {todo.assigned_person_id && (
                    <span className="todo-assignee">
                      <i className="bi bi-person"></i>
                      {getPersonName(todo.assigned_person_id)}
                    </span>
                  )}
                  
                  {todo.due_date && (
                    <span className={`todo-due-date ${isOverdue(todo.due_date) && !todo.is_completed ? 'overdue' : ''}`}>
                      <i className="bi bi-calendar"></i>
                      {formatDate(todo.due_date)}
                    </span>
                  )}
                  
                  <span className="todo-created">
                    <i className="bi bi-clock"></i>
                    {formatDate(todo.created_at)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      <div className="todo-summary">
        <small className="text-muted">
          Showing {filteredAndSortedTodos.length} of {todos.length} todos
          {filteredAndSortedTodos.length > 0 && (
            <>
              {' • '}
              {filteredAndSortedTodos.filter(t => !t.is_completed).length} pending
              {' • '}
              {filteredAndSortedTodos.filter(t => t.is_completed).length} completed
            </>
          )}
        </small>
      </div>
    </div>
  );
};

export default TodoList;
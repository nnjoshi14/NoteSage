import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../stores/store';
import { addTodo, updateTodo } from '../../stores/slices/todosSlice';
import { Todo } from '../../stores/slices/todosSlice';
import { Note } from '../../stores/slices/notesSlice';
import './TodoForm.css';

interface TodoFormProps {
  todo?: Todo;
  onSave: (todo: Todo) => void;
  onCancel: () => void;
}

const TodoForm: React.FC<TodoFormProps> = ({ todo, onSave, onCancel }) => {
  const dispatch = useDispatch();
  const { people } = useSelector((state: RootState) => state.people);
  const { notes } = useSelector((state: RootState) => state.notes);
  
  const [formData, setFormData] = useState({
    text: '',
    note_id: '',
    assigned_person_id: '',
    due_date: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (todo) {
      setFormData({
        text: todo.text,
        note_id: todo.note_id,
        assigned_person_id: todo.assigned_person_id || '',
        due_date: todo.due_date || '',
      });
    }
  }, [todo]);

  const generateTodoId = async (noteId: string): Promise<string> => {
    // Get existing todos for this note to generate next ID
    const cachedTodos = await window.electronAPI.getCachedTodos();
    const noteTodos = cachedTodos.filter((t: Todo) => t.note_id === noteId);
    
    const existingIds = noteTodos
      .map((t: Todo) => parseInt(t.todo_id.substring(1))) // Remove 't' prefix
      .filter((id: number) => !isNaN(id));
    
    const nextId = Math.max(0, ...existingIds) + 1;
    return `t${nextId}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!formData.text.trim()) {
        throw new Error('Todo text is required');
      }
      
      if (!formData.note_id) {
        throw new Error('Please select a note');
      }

      let todoData: Partial<Todo>;

      if (todo) {
        // Update existing todo
        todoData = {
          ...todo,
          text: formData.text.trim(),
          note_id: formData.note_id,
          assigned_person_id: formData.assigned_person_id || undefined,
          due_date: formData.due_date || undefined,
          updated_at: new Date().toISOString(),
        };
      } else {
        // Create new todo
        const todoId = await generateTodoId(formData.note_id);
        todoData = {
          id: `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          note_id: formData.note_id,
          todo_id: todoId,
          text: formData.text.trim(),
          is_completed: false,
          assigned_person_id: formData.assigned_person_id || undefined,
          due_date: formData.due_date || undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'pending',
        };
      }

      // Save to cache
      const result = await window.electronAPI.cacheTodo(todoData);
      if (!result.success) {
        throw new Error(result.error || 'Failed to save todo');
      }

      // Update Redux store
      if (todo) {
        dispatch(updateTodo(todoData as Todo));
      } else {
        dispatch(addTodo(todoData as Todo));
      }

      onSave(todoData as Todo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save todo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getNoteName = (noteId: string): string => {
    const note = notes.find(n => n.id === noteId);
    return note ? note.title : 'Unknown Note';
  };

  const getPersonName = (personId: string): string => {
    const person = people.find(p => p.id === personId);
    return person ? person.name : 'Unknown Person';
  };

  return (
    <div className="todo-form">
      <div className="todo-form-header">
        <h5 className="mb-0">
          {todo ? 'Edit Todo' : 'Create New Todo'}
        </h5>
        <button
          type="button"
          className="btn-close"
          onClick={onCancel}
          disabled={isLoading}
        ></button>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="todoText" className="form-label">
            Todo Text <span className="text-danger">*</span>
          </label>
          <textarea
            id="todoText"
            className="form-control"
            rows={3}
            value={formData.text}
            onChange={(e) => handleChange('text', e.target.value)}
            placeholder="Enter todo description..."
            disabled={isLoading}
            required
          />
        </div>

        <div className="mb-3">
          <label htmlFor="noteSelect" className="form-label">
            Note <span className="text-danger">*</span>
          </label>
          <select
            id="noteSelect"
            className="form-select"
            value={formData.note_id}
            onChange={(e) => handleChange('note_id', e.target.value)}
            disabled={isLoading || !!todo} // Disable if editing existing todo
            required
          >
            <option value="">Select a note...</option>
            {notes.map(note => (
              <option key={note.id} value={note.id}>
                {note.title}
              </option>
            ))}
          </select>
          {todo && (
            <div className="form-text">
              Currently linked to: <strong>{getNoteName(todo.note_id)}</strong>
            </div>
          )}
        </div>

        <div className="mb-3">
          <label htmlFor="assigneeSelect" className="form-label">
            Assign to Person
          </label>
          <select
            id="assigneeSelect"
            className="form-select"
            value={formData.assigned_person_id}
            onChange={(e) => handleChange('assigned_person_id', e.target.value)}
            disabled={isLoading}
          >
            <option value="">No assignment</option>
            {people.map(person => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label htmlFor="dueDate" className="form-label">
            Due Date
          </label>
          <input
            type="date"
            id="dueDate"
            className="form-control"
            value={formData.due_date}
            onChange={(e) => handleChange('due_date', e.target.value)}
            disabled={isLoading}
          />
        </div>

        {todo && (
          <div className="mb-3">
            <div className="todo-form-meta">
              <div className="row">
                <div className="col-sm-6">
                  <strong>Todo ID:</strong> {todo.todo_id}
                </div>
                <div className="col-sm-6">
                  <strong>Status:</strong>{' '}
                  <span className={`badge ${todo.is_completed ? 'bg-success' : 'bg-warning'}`}>
                    {todo.is_completed ? 'Completed' : 'Pending'}
                  </span>
                </div>
              </div>
              <div className="row mt-2">
                <div className="col-sm-6">
                  <strong>Created:</strong> {new Date(todo.created_at).toLocaleDateString()}
                </div>
                <div className="col-sm-6">
                  <strong>Updated:</strong> {new Date(todo.updated_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="todo-form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                Saving...
              </>
            ) : (
              <>Save Todo</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TodoForm;
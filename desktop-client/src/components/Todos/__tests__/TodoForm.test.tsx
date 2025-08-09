import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import TodoForm from '../TodoForm';
import todosReducer from '../../../stores/slices/todosSlice';
import peopleReducer from '../../../stores/slices/peopleSlice';
import notesReducer from '../../../stores/slices/notesSlice';
import { Todo } from '../../../stores/slices/todosSlice';
import { Person } from '../../../stores/slices/peopleSlice';
import { Note } from '../../../stores/slices/notesSlice';

// Mock electron API
const mockElectronAPI = {
  getCachedTodos: jest.fn(),
  cacheTodo: jest.fn(),
};

(global as any).window = {
  electronAPI: mockElectronAPI,
};

const mockPeople: Person[] = [
  {
    id: 'person1',
    name: 'John Doe',
    email: 'john@example.com',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'person2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

const mockNotes: Note[] = [
  {
    id: 'note1',
    title: 'Project Planning',
    content: 'Planning content',
    category: 'Note',
    tags: [],
    folder_path: '/',
    is_archived: false,
    is_pinned: false,
    is_favorite: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    version: 1,
  },
  {
    id: 'note2',
    title: 'Meeting Notes',
    content: 'Meeting content',
    category: 'Meeting',
    tags: [],
    folder_path: '/',
    is_archived: false,
    is_pinned: false,
    is_favorite: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    version: 1,
  },
];

const mockTodo: Todo = {
  id: 'todo1',
  note_id: 'note1',
  todo_id: 't1',
  text: 'Complete project documentation',
  is_completed: false,
  assigned_person_id: 'person1',
  due_date: '2024-01-20',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
  sync_status: 'synced',
};

const createTestStore = () => {
  return configureStore({
    reducer: {
      todos: todosReducer,
      people: peopleReducer,
      notes: notesReducer,
    },
    preloadedState: {
      todos: {
        todos: [],
        currentTodo: null,
        isLoading: false,
        filters: {},
      },
      people: {
        people: mockPeople,
        currentPerson: null,
        isLoading: false,
        filters: {},
      },
      notes: {
        notes: mockNotes,
        currentNote: null,
        isLoading: false,
        filters: {},
      },
    },
  });
};

const renderTodoForm = (props = {}) => {
  const defaultProps = {
    onSave: jest.fn(),
    onCancel: jest.fn(),
  };

  return render(
    <Provider store={createTestStore()}>
      <TodoForm {...defaultProps} {...props} />
    </Provider>
  );
};

describe('TodoForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.getCachedTodos.mockResolvedValue([]);
    mockElectronAPI.cacheTodo.mockResolvedValue({ success: true });
  });

  it('renders create form correctly', () => {
    renderTodoForm();

    expect(screen.getByText('Create New Todo')).toBeInTheDocument();
    expect(screen.getByLabelText(/Todo Text/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Note/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Assign to Person/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Due Date/)).toBeInTheDocument();
    expect(screen.getByText('Save Todo')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders edit form correctly', () => {
    renderTodoForm({ todo: mockTodo });

    expect(screen.getByText('Edit Todo')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Complete project documentation')).toBeInTheDocument();
    expect(screen.getByDisplayValue('note1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('person1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2024-01-20')).toBeInTheDocument();
  });

  it('populates form fields when editing existing todo', () => {
    renderTodoForm({ todo: mockTodo });

    expect(screen.getByDisplayValue('Complete project documentation')).toBeInTheDocument();
    expect(screen.getByText('Currently linked to:')).toBeInTheDocument();
    expect(screen.getByText('Project Planning')).toBeInTheDocument();
    expect(screen.getByText('Todo ID: t1')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('disables note selection when editing existing todo', () => {
    renderTodoForm({ todo: mockTodo });

    const noteSelect = screen.getByLabelText(/Note/);
    expect(noteSelect).toBeDisabled();
  });

  it('shows validation error for empty todo text', async () => {
    const mockOnSave = jest.fn();
    renderTodoForm({ onSave: mockOnSave });

    const saveButton = screen.getByText('Save Todo');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Todo text is required')).toBeInTheDocument();
    });

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('shows validation error when no note is selected', async () => {
    const mockOnSave = jest.fn();
    renderTodoForm({ onSave: mockOnSave });

    const textArea = screen.getByLabelText(/Todo Text/);
    fireEvent.change(textArea, { target: { value: 'Test todo' } });

    const saveButton = screen.getByText('Save Todo');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Please select a note')).toBeInTheDocument();
    });

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('creates new todo successfully', async () => {
    const mockOnSave = jest.fn();
    mockElectronAPI.getCachedTodos.mockResolvedValue([]);
    
    renderTodoForm({ onSave: mockOnSave });

    // Fill form
    const textArea = screen.getByLabelText(/Todo Text/);
    fireEvent.change(textArea, { target: { value: 'New test todo' } });

    const noteSelect = screen.getByLabelText(/Note/);
    fireEvent.change(noteSelect, { target: { value: 'note1' } });

    const personSelect = screen.getByLabelText(/Assign to Person/);
    fireEvent.change(personSelect, { target: { value: 'person1' } });

    const dueDateInput = screen.getByLabelText(/Due Date/);
    fireEvent.change(dueDateInput, { target: { value: '2024-01-25' } });

    // Submit form
    const saveButton = screen.getByText('Save Todo');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockElectronAPI.cacheTodo).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'New test todo',
          note_id: 'note1',
          todo_id: 't1',
          assigned_person_id: 'person1',
          due_date: '2024-01-25',
          is_completed: false,
        })
      );
    });

    expect(mockOnSave).toHaveBeenCalled();
  });

  it('updates existing todo successfully', async () => {
    const mockOnSave = jest.fn();
    renderTodoForm({ todo: mockTodo, onSave: mockOnSave });

    // Update text
    const textArea = screen.getByDisplayValue('Complete project documentation');
    fireEvent.change(textArea, { target: { value: 'Updated todo text' } });

    // Submit form
    const saveButton = screen.getByText('Save Todo');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockElectronAPI.cacheTodo).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'todo1',
          text: 'Updated todo text',
          note_id: 'note1',
          todo_id: 't1',
        })
      );
    });

    expect(mockOnSave).toHaveBeenCalled();
  });

  it('generates correct todo ID for new todos', async () => {
    const mockOnSave = jest.fn();
    // Mock existing todos in the same note
    mockElectronAPI.getCachedTodos.mockResolvedValue([
      { note_id: 'note1', todo_id: 't1' },
      { note_id: 'note1', todo_id: 't3' },
      { note_id: 'note2', todo_id: 't1' },
    ]);
    
    renderTodoForm({ onSave: mockOnSave });

    // Fill form
    const textArea = screen.getByLabelText(/Todo Text/);
    fireEvent.change(textArea, { target: { value: 'New test todo' } });

    const noteSelect = screen.getByLabelText(/Note/);
    fireEvent.change(noteSelect, { target: { value: 'note1' } });

    // Submit form
    const saveButton = screen.getByText('Save Todo');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockElectronAPI.cacheTodo).toHaveBeenCalledWith(
        expect.objectContaining({
          todo_id: 't4', // Should be next available ID
        })
      );
    });
  });

  it('handles cache error gracefully', async () => {
    const mockOnSave = jest.fn();
    mockElectronAPI.cacheTodo.mockResolvedValue({ 
      success: false, 
      error: 'Cache error' 
    });
    
    renderTodoForm({ onSave: mockOnSave });

    // Fill form
    const textArea = screen.getByLabelText(/Todo Text/);
    fireEvent.change(textArea, { target: { value: 'Test todo' } });

    const noteSelect = screen.getByLabelText(/Note/);
    fireEvent.change(noteSelect, { target: { value: 'note1' } });

    // Submit form
    const saveButton = screen.getByText('Save Todo');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Cache error')).toBeInTheDocument();
    });

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('calls onCancel when cancel button is clicked', () => {
    const mockOnCancel = jest.fn();
    renderTodoForm({ onCancel: mockOnCancel });

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('calls onCancel when close button is clicked', () => {
    const mockOnCancel = jest.fn();
    renderTodoForm({ onCancel: mockOnCancel });

    const closeButton = screen.getByRole('button', { name: '' }); // Close button
    fireEvent.click(closeButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('shows loading state during save', async () => {
    const mockOnSave = jest.fn();
    // Make cacheTodo hang to test loading state
    mockElectronAPI.cacheTodo.mockImplementation(() => new Promise(() => {}));
    
    renderTodoForm({ onSave: mockOnSave });

    // Fill form
    const textArea = screen.getByLabelText(/Todo Text/);
    fireEvent.change(textArea, { target: { value: 'Test todo' } });

    const noteSelect = screen.getByLabelText(/Note/);
    fireEvent.change(noteSelect, { target: { value: 'note1' } });

    // Submit form
    const saveButton = screen.getByText('Save Todo');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(saveButton).toBeDisabled();
    });
  });

  it('displays note and person names correctly', () => {
    renderTodoForm();

    // Check note options
    expect(screen.getByText('Project Planning')).toBeInTheDocument();
    expect(screen.getByText('Meeting Notes')).toBeInTheDocument();

    // Check person options
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('shows todo metadata for existing todos', () => {
    renderTodoForm({ todo: mockTodo });

    expect(screen.getByText('Todo ID: t1')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('1/15/2024')).toBeInTheDocument(); // Created date
  });

  it('allows clearing optional fields', async () => {
    const mockOnSave = jest.fn();
    renderTodoForm({ todo: mockTodo, onSave: mockOnSave });

    // Clear assignee
    const personSelect = screen.getByDisplayValue('person1');
    fireEvent.change(personSelect, { target: { value: '' } });

    // Clear due date
    const dueDateInput = screen.getByDisplayValue('2024-01-20');
    fireEvent.change(dueDateInput, { target: { value: '' } });

    // Submit form
    const saveButton = screen.getByText('Save Todo');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockElectronAPI.cacheTodo).toHaveBeenCalledWith(
        expect.objectContaining({
          assigned_person_id: undefined,
          due_date: undefined,
        })
      );
    });
  });
});
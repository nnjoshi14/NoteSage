import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import TodosPage from '../TodosPage';
import todosReducer from '../../../stores/slices/todosSlice';
import peopleReducer from '../../../stores/slices/peopleSlice';
import notesReducer from '../../../stores/slices/notesSlice';
import { Todo } from '../../../stores/slices/todosSlice';
import { Person } from '../../../stores/slices/peopleSlice';
import { Note } from '../../../stores/slices/notesSlice';

// Mock electron API
const mockElectronAPI = {
  getCachedTodos: jest.fn(),
  getCachedPeople: jest.fn(),
  getCachedNotes: jest.fn(),
  cacheTodo: jest.fn(),
  triggerSync: jest.fn(),
};

(global as any).window = {
  electronAPI: mockElectronAPI,
};

const mockTodos: Todo[] = [
  {
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
  },
  {
    id: 'todo2',
    note_id: 'note1',
    todo_id: 't2',
    text: 'Review code changes',
    is_completed: true,
    created_at: '2024-01-14T09:00:00Z',
    updated_at: '2024-01-14T09:00:00Z',
    sync_status: 'pending',
  },
];

const mockPeople: Person[] = [
  {
    id: 'person1',
    name: 'John Doe',
    email: 'john@example.com',
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
];

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
        people: [],
        currentPerson: null,
        isLoading: false,
        filters: {},
      },
      notes: {
        notes: [],
        currentNote: null,
        isLoading: false,
        filters: {},
      },
    },
  });
};

const renderTodosPage = () => {
  return render(
    <Provider store={createTestStore()}>
      <TodosPage />
    </Provider>
  );
};

describe('TodosPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.getCachedTodos.mockResolvedValue(mockTodos);
    mockElectronAPI.getCachedPeople.mockResolvedValue(mockPeople);
    mockElectronAPI.getCachedNotes.mockResolvedValue(mockNotes);
    mockElectronAPI.cacheTodo.mockResolvedValue({ success: true });
    mockElectronAPI.triggerSync.mockResolvedValue({
      success: true,
      synced: 1,
      failed: 0,
      conflicts: 0,
    });
  });

  it('renders todos page with header', async () => {
    renderTodosPage();

    expect(screen.getByText('Loading todos...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Todos')).toBeInTheDocument();
      expect(screen.getByText('Add Todo')).toBeInTheDocument();
    });
  });

  it('loads initial data on mount', async () => {
    renderTodosPage();

    await waitFor(() => {
      expect(mockElectronAPI.getCachedTodos).toHaveBeenCalled();
      expect(mockElectronAPI.getCachedPeople).toHaveBeenCalled();
      expect(mockElectronAPI.getCachedNotes).toHaveBeenCalled();
    });
  });

  it('shows loading state initially', () => {
    renderTodosPage();

    expect(screen.getByText('Loading todos...')).toBeInTheDocument();
  });

  it('displays view toggle buttons', async () => {
    renderTodosPage();

    await waitFor(() => {
      expect(screen.getByText('List')).toBeInTheDocument();
      expect(screen.getByText('Calendar')).toBeInTheDocument();
    });
  });

  it('switches between list and calendar views', async () => {
    renderTodosPage();

    await waitFor(() => {
      expect(screen.getByText('List')).toBeInTheDocument();
    });

    // Should start in list view
    const listButton = screen.getByText('List');
    expect(listButton).toHaveClass('active');

    // Switch to calendar view
    const calendarButton = screen.getByText('Calendar');
    fireEvent.click(calendarButton);

    expect(calendarButton).toHaveClass('active');
    expect(listButton).not.toHaveClass('active');
  });

  it('shows todo form when Add Todo is clicked', async () => {
    renderTodosPage();

    await waitFor(() => {
      expect(screen.getByText('Add Todo')).toBeInTheDocument();
    });

    const addButton = screen.getByText('Add Todo');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Create New Todo')).toBeInTheDocument();
    });
  });

  it('shows sync trigger component', async () => {
    renderTodosPage();

    await waitFor(() => {
      expect(screen.getByText('Sync Todos')).toBeInTheDocument();
    });
  });

  it('handles sync completion', async () => {
    renderTodosPage();

    await waitFor(() => {
      expect(screen.getByText('Sync Todos')).toBeInTheDocument();
    });

    const syncButton = screen.getByText('Sync Todos');
    fireEvent.click(syncButton);

    await waitFor(() => {
      // Should reload data after sync
      expect(mockElectronAPI.getCachedTodos).toHaveBeenCalledTimes(2); // Once on mount, once after sync
    });
  });

  it('shows todo form when editing todo from list view', async () => {
    renderTodosPage();

    await waitFor(() => {
      expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
    });

    // Click on a todo item
    const todoItem = screen.getByText('Complete project documentation').closest('.todo-item');
    fireEvent.click(todoItem!);

    await waitFor(() => {
      expect(screen.getByText('Edit Todo')).toBeInTheDocument();
    });
  });

  it('shows todo form when editing todo from calendar view', async () => {
    renderTodosPage();

    await waitFor(() => {
      expect(screen.getByText('Calendar')).toBeInTheDocument();
    });

    // Switch to calendar view
    const calendarButton = screen.getByText('Calendar');
    fireEvent.click(calendarButton);

    // Mock current date to January 2024 for consistent testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15'));

    await waitFor(() => {
      // Find the day with the todo and click on the todo
      const day20 = screen.getByText('20').closest('.calendar-day');
      const todoElement = day20?.querySelector('.calendar-todo');
      if (todoElement) {
        fireEvent.click(todoElement);
      }
    });

    await waitFor(() => {
      expect(screen.getByText('Edit Todo')).toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  it('closes todo form when cancel is clicked', async () => {
    renderTodosPage();

    await waitFor(() => {
      expect(screen.getByText('Add Todo')).toBeInTheDocument();
    });

    // Open form
    const addButton = screen.getByText('Add Todo');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Create New Todo')).toBeInTheDocument();
    });

    // Cancel form
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Create New Todo')).not.toBeInTheDocument();
      expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
    });
  });

  it('closes todo form and reloads data when todo is saved', async () => {
    renderTodosPage();

    await waitFor(() => {
      expect(screen.getByText('Add Todo')).toBeInTheDocument();
    });

    // Open form
    const addButton = screen.getByText('Add Todo');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Create New Todo')).toBeInTheDocument();
    });

    // Fill and save form
    const textArea = screen.getByLabelText(/Todo Text/);
    fireEvent.change(textArea, { target: { value: 'New test todo' } });

    const noteSelect = screen.getByLabelText(/Note/);
    fireEvent.change(noteSelect, { target: { value: 'note1' } });

    const saveButton = screen.getByText('Save Todo');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.queryByText('Create New Todo')).not.toBeInTheDocument();
      // Should reload data after save
      expect(mockElectronAPI.getCachedTodos).toHaveBeenCalledTimes(2);
    });
  });

  it('handles date click in calendar view', async () => {
    renderTodosPage();

    await waitFor(() => {
      expect(screen.getByText('Calendar')).toBeInTheDocument();
    });

    // Switch to calendar view
    const calendarButton = screen.getByText('Calendar');
    fireEvent.click(calendarButton);

    // Mock console.log to verify date click handling
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await waitFor(() => {
      const day15 = screen.getByText('15').closest('.calendar-day');
      fireEvent.click(day15!);
    });

    expect(consoleSpy).toHaveBeenCalledWith('Date clicked:', expect.any(Date));
    consoleSpy.mockRestore();
  });

  it('displays todos in list view by default', async () => {
    renderTodosPage();

    await waitFor(() => {
      expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
      expect(screen.getByText('Review code changes')).toBeInTheDocument();
    });
  });

  it('shows calendar view when calendar tab is selected', async () => {
    renderTodosPage();

    await waitFor(() => {
      expect(screen.getByText('Calendar')).toBeInTheDocument();
    });

    const calendarButton = screen.getByText('Calendar');
    fireEvent.click(calendarButton);

    // Mock current date for consistent testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15'));

    await waitFor(() => {
      expect(screen.getByText('January 2024')).toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  it('maintains view state when switching between views', async () => {
    renderTodosPage();

    await waitFor(() => {
      expect(screen.getByText('List')).toHaveClass('active');
    });

    // Switch to calendar
    const calendarButton = screen.getByText('Calendar');
    fireEvent.click(calendarButton);

    expect(calendarButton).toHaveClass('active');

    // Switch back to list
    const listButton = screen.getByText('List');
    fireEvent.click(listButton);

    expect(listButton).toHaveClass('active');
    expect(calendarButton).not.toHaveClass('active');
  });

  it('shows sync status in header', async () => {
    renderTodosPage();

    await waitFor(() => {
      expect(screen.getByText('Pending:')).toBeInTheDocument();
      expect(screen.getByText('Conflicts:')).toBeInTheDocument();
      expect(screen.getByText('Total:')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    mockElectronAPI.getCachedTodos.mockRejectedValue(new Error('API Error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    renderTodosPage();

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load initial data:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });
});
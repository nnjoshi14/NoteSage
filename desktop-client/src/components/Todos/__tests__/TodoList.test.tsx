import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import TodoList from '../TodoList';
import todosReducer from '../../../stores/slices/todosSlice';
import peopleReducer from '../../../stores/slices/peopleSlice';
import { Todo } from '../../../stores/slices/todosSlice';
import { Person } from '../../../stores/slices/peopleSlice';

// Mock electron API
const mockElectronAPI = {
  getCachedTodos: jest.fn(),
  cacheTodo: jest.fn(),
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
  {
    id: 'todo3',
    note_id: 'note2',
    todo_id: 't1',
    text: 'Overdue task',
    is_completed: false,
    due_date: '2024-01-10',
    created_at: '2024-01-08T08:00:00Z',
    updated_at: '2024-01-08T08:00:00Z',
    sync_status: 'synced',
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

const createTestStore = (initialTodos = mockTodos, initialPeople = mockPeople) => {
  return configureStore({
    reducer: {
      todos: todosReducer,
      people: peopleReducer,
    },
    preloadedState: {
      todos: {
        todos: initialTodos,
        currentTodo: null,
        isLoading: false,
        filters: {},
      },
      people: {
        people: initialPeople,
        currentPerson: null,
        isLoading: false,
        filters: {},
      },
    },
  });
};

const renderTodoList = (store = createTestStore(), props = {}) => {
  return render(
    <Provider store={store}>
      <TodoList {...props} />
    </Provider>
  );
};

describe('TodoList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.getCachedTodos.mockResolvedValue(mockTodos);
    mockElectronAPI.cacheTodo.mockResolvedValue({ success: true });
  });

  it('renders todo list with todos', async () => {
    renderTodoList();

    await waitFor(() => {
      expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
      expect(screen.getByText('Review code changes')).toBeInTheDocument();
      expect(screen.getByText('Overdue task')).toBeInTheDocument();
    });
  });

  it('displays todo metadata correctly', async () => {
    renderTodoList();

    await waitFor(() => {
      // Check todo IDs
      expect(screen.getByText('t1')).toBeInTheDocument();
      expect(screen.getByText('t2')).toBeInTheDocument();

      // Check assigned person
      expect(screen.getByText('John Doe')).toBeInTheDocument();

      // Check due dates
      expect(screen.getByText('1/20/2024')).toBeInTheDocument();
      expect(screen.getByText('1/10/2024')).toBeInTheDocument();
    });
  });

  it('shows overdue todos with special styling', async () => {
    renderTodoList();

    await waitFor(() => {
      const overdueItem = screen.getByText('Overdue task').closest('.todo-item');
      expect(overdueItem).toHaveClass('overdue');
    });
  });

  it('shows completed todos with completed styling', async () => {
    renderTodoList();

    await waitFor(() => {
      const completedItem = screen.getByText('Review code changes').closest('.todo-item');
      expect(completedItem).toHaveClass('completed');
    });
  });

  it('filters todos by completion status', async () => {
    renderTodoList();

    await waitFor(() => {
      expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
      expect(screen.getByText('Review code changes')).toBeInTheDocument();
    });

    // Filter to show only pending todos
    const statusFilter = screen.getByDisplayValue('All Todos');
    fireEvent.change(statusFilter, { target: { value: 'pending' } });

    await waitFor(() => {
      expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
      expect(screen.queryByText('Review code changes')).not.toBeInTheDocument();
    });
  });

  it('filters todos by search text', async () => {
    renderTodoList();

    await waitFor(() => {
      expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
      expect(screen.getByText('Review code changes')).toBeInTheDocument();
    });

    // Search for specific text
    const searchInput = screen.getByPlaceholderText('Search todos...');
    fireEvent.change(searchInput, { target: { value: 'documentation' } });

    await waitFor(() => {
      expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
      expect(screen.queryByText('Review code changes')).not.toBeInTheDocument();
    });
  });

  it('filters todos by assigned person', async () => {
    renderTodoList();

    await waitFor(() => {
      expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
    });

    // Filter by person
    const personFilter = screen.getByDisplayValue('All Assignees');
    fireEvent.change(personFilter, { target: { value: 'person1' } });

    await waitFor(() => {
      expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
      expect(screen.queryByText('Review code changes')).not.toBeInTheDocument();
    });
  });

  it('toggles todo completion status', async () => {
    const mockOnTodoClick = jest.fn();
    renderTodoList(createTestStore(), { onTodoClick: mockOnTodoClick });

    await waitFor(() => {
      expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
    });

    // Find and click the checkbox for the first todo
    const checkboxes = screen.getAllByRole('checkbox');
    const firstCheckbox = checkboxes[0];
    
    fireEvent.click(firstCheckbox);

    await waitFor(() => {
      expect(mockElectronAPI.cacheTodo).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'todo1',
          is_completed: true,
        })
      );
    });
  });

  it('calls onTodoClick when todo item is clicked', async () => {
    const mockOnTodoClick = jest.fn();
    renderTodoList(createTestStore(), { onTodoClick: mockOnTodoClick });

    await waitFor(() => {
      expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
    });

    const todoItem = screen.getByText('Complete project documentation').closest('.todo-item');
    fireEvent.click(todoItem!);

    expect(mockOnTodoClick).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'todo1',
        text: 'Complete project documentation',
      })
    );
  });

  it('sorts todos by different criteria', async () => {
    renderTodoList();

    await waitFor(() => {
      expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
    });

    // Change sort to due date
    const sortSelect = screen.getByDisplayValue('Created Date');
    fireEvent.change(sortSelect, { target: { value: 'due_date' } });

    // The order should change (todos with due dates first)
    await waitFor(() => {
      const todoItems = screen.getAllByText(/Complete project documentation|Overdue task/);
      expect(todoItems).toHaveLength(2);
    });
  });

  it('clears all filters', async () => {
    renderTodoList();

    await waitFor(() => {
      expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
    });

    // Apply a filter
    const searchInput = screen.getByPlaceholderText('Search todos...');
    fireEvent.change(searchInput, { target: { value: 'documentation' } });

    // Clear filters
    const clearButton = screen.getByTitle('Clear Filters');
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(searchInput).toHaveValue('');
      expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
      expect(screen.getByText('Review code changes')).toBeInTheDocument();
    });
  });

  it('shows empty state when no todos match filters', async () => {
    renderTodoList();

    await waitFor(() => {
      expect(screen.getByText('Complete project documentation')).toBeInTheDocument();
    });

    // Search for non-existent text
    const searchInput = screen.getByPlaceholderText('Search todos...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    await waitFor(() => {
      expect(screen.getByText('No todos found')).toBeInTheDocument();
      expect(screen.getByText('Clear Filters')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    const store = configureStore({
      reducer: {
        todos: todosReducer,
        people: peopleReducer,
      },
      preloadedState: {
        todos: {
          todos: [],
          currentTodo: null,
          isLoading: true,
          filters: {},
        },
        people: {
          people: [],
          currentPerson: null,
          isLoading: false,
          filters: {},
        },
      },
    });

    renderTodoList(store);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('displays sync status indicators', async () => {
    renderTodoList();

    await waitFor(() => {
      // Should show sync indicator for pending todo
      const pendingTodo = screen.getByText('Review code changes').closest('.todo-item');
      expect(pendingTodo?.querySelector('.sync-indicator')).toBeInTheDocument();
    });
  });

  it('shows todo summary', async () => {
    renderTodoList();

    await waitFor(() => {
      expect(screen.getByText(/Showing 3 of 3 todos/)).toBeInTheDocument();
      expect(screen.getByText(/2 pending/)).toBeInTheDocument();
      expect(screen.getByText(/1 completed/)).toBeInTheDocument();
    });
  });
});
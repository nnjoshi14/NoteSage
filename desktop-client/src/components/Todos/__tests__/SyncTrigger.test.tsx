import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SyncTrigger from '../SyncTrigger';
import todosReducer from '../../../stores/slices/todosSlice';
import { Todo } from '../../../stores/slices/todosSlice';

// Mock electron API
const mockElectronAPI = {
  triggerSync: jest.fn(),
};

// Set up window.electronAPI mock
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

const mockTodos: Todo[] = [
  {
    id: 'todo1',
    note_id: 'note1',
    todo_id: 't1',
    text: 'Synced todo',
    is_completed: false,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    sync_status: 'synced',
  },
  {
    id: 'todo2',
    note_id: 'note1',
    todo_id: 't2',
    text: 'Pending todo',
    is_completed: false,
    created_at: '2024-01-14T09:00:00Z',
    updated_at: '2024-01-14T09:00:00Z',
    sync_status: 'pending',
  },
  {
    id: 'todo3',
    note_id: 'note2',
    todo_id: 't1',
    text: 'Another pending todo',
    is_completed: true,
    created_at: '2024-01-13T08:00:00Z',
    updated_at: '2024-01-13T08:00:00Z',
    sync_status: 'pending',
  },
  {
    id: 'todo4',
    note_id: 'note2',
    todo_id: 't2',
    text: 'Conflict todo',
    is_completed: false,
    created_at: '2024-01-12T07:00:00Z',
    updated_at: '2024-01-12T07:00:00Z',
    sync_status: 'conflict',
  },
];

const createTestStore = (todos = mockTodos) => {
  return configureStore({
    reducer: {
      todos: todosReducer,
    },
    preloadedState: {
      todos: {
        todos,
        currentTodo: null,
        isLoading: false,
        filters: {},
      },
    },
  });
};

const renderSyncTrigger = (props = {}, store = createTestStore()) => {
  return render(
    <Provider store={store}>
      <SyncTrigger {...props} />
    </Provider>
  );
};

describe('SyncTrigger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays sync statistics correctly', () => {
    renderSyncTrigger();

    expect(screen.getByText('Pending:')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // 2 pending todos

    expect(screen.getByText('Conflicts:')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // 1 conflict todo

    expect(screen.getByText('Total:')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument(); // 4 total todos
  });

  it('shows warning button when there are pending or conflict todos', () => {
    renderSyncTrigger();

    const syncButton = screen.getByText('Sync Todos');
    expect(syncButton).toHaveClass('btn-warning');
  });

  it('shows normal button when no pending or conflict todos', () => {
    const syncedTodos = mockTodos.map(todo => ({ ...todo, sync_status: 'synced' as const }));
    const store = createTestStore(syncedTodos);
    renderSyncTrigger({}, store);

    const syncButton = screen.getByText('Sync Todos');
    expect(syncButton).toHaveClass('btn-outline-secondary');
  });

  it('triggers sync when button is clicked', async () => {
    mockElectronAPI.triggerSync.mockResolvedValue({
      success: true,
      synced: 2,
      failed: 0,
      conflicts: 0,
    });

    renderSyncTrigger();

    const syncButton = screen.getByText('Sync Todos');
    fireEvent.click(syncButton);

    expect(mockElectronAPI.triggerSync).toHaveBeenCalled();
  });

  it('shows loading state during sync', async () => {
    mockElectronAPI.triggerSync.mockImplementation(() => new Promise(() => {})); // Never resolves

    renderSyncTrigger();

    const syncButton = screen.getByText('Sync Todos');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText('Syncing...')).toBeInTheDocument();
      expect(syncButton).toBeDisabled();
    });
  });

  it('shows success message after successful sync', async () => {
    mockElectronAPI.triggerSync.mockResolvedValue({
      success: true,
      synced: 2,
      failed: 0,
      conflicts: 0,
    });

    renderSyncTrigger();

    const syncButton = screen.getByText('Sync Todos');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText('Sync completed: 2 synced, 0 failed')).toBeInTheDocument();
    });
  });

  it('shows success message with conflicts', async () => {
    mockElectronAPI.triggerSync.mockResolvedValue({
      success: true,
      synced: 1,
      failed: 0,
      conflicts: 1,
    });

    renderSyncTrigger();

    const syncButton = screen.getByText('Sync Todos');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText('Sync completed: 1 synced, 0 failed')).toBeInTheDocument();
      expect(screen.getByText(', 1 conflicts')).toBeInTheDocument();
    });
  });

  it('shows error message when sync fails', async () => {
    mockElectronAPI.triggerSync.mockResolvedValue({
      success: false,
      error: 'Network error',
    });

    renderSyncTrigger();

    const syncButton = screen.getByText('Sync Todos');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('handles sync rejection', async () => {
    mockElectronAPI.triggerSync.mockRejectedValue(new Error('Connection failed'));

    renderSyncTrigger();

    const syncButton = screen.getByText('Sync Todos');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });
  });

  it('calls onSyncComplete callback after successful sync', async () => {
    const mockOnSyncComplete = jest.fn();
    const syncResult = {
      success: true,
      synced: 2,
      failed: 0,
      conflicts: 0,
    };

    mockElectronAPI.triggerSync.mockResolvedValue(syncResult);

    renderSyncTrigger({ onSyncComplete: mockOnSyncComplete });

    const syncButton = screen.getByText('Sync Todos');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(mockOnSyncComplete).toHaveBeenCalledWith(syncResult);
    });
  });

  it('does not call onSyncComplete callback when sync fails', async () => {
    const mockOnSyncComplete = jest.fn();
    mockElectronAPI.triggerSync.mockResolvedValue({
      success: false,
      error: 'Sync failed',
    });

    renderSyncTrigger({ onSyncComplete: mockOnSyncComplete });

    const syncButton = screen.getByText('Sync Todos');
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText('Sync failed')).toBeInTheDocument();
    });

    expect(mockOnSyncComplete).not.toHaveBeenCalled();
  });

  it('shows pending todos details', () => {
    renderSyncTrigger();

    expect(screen.getByText('Pending Sync (2)')).toBeInTheDocument();
    expect(screen.getByText('Pending todo')).toBeInTheDocument();
    expect(screen.getByText('Another pending todo')).toBeInTheDocument();
    expect(screen.getAllByText('t2')).toHaveLength(2); // One in pending, one in conflicts
    expect(screen.getByText('t1')).toBeInTheDocument();
  });

  it('shows conflict todos details', () => {
    renderSyncTrigger();

    expect(screen.getByText('Conflicts (1)')).toBeInTheDocument();
    expect(screen.getByText('Conflict todo')).toBeInTheDocument();
  });

  it('truncates long todo text in details', () => {
    const longTodos = [
      {
        id: 'long-todo',
        note_id: 'note1',
        todo_id: 't10',
        text: 'This is a very long todo text that should be truncated in the sync details',
        is_completed: false,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        sync_status: 'pending' as const,
      },
    ];

    const store = createTestStore([...mockTodos, ...longTodos]);
    renderSyncTrigger({}, store);

    expect(screen.getByText('This is a very long todo text ...')).toBeInTheDocument();
  });

  it('shows more indicator when there are many pending todos', () => {
    const manyPendingTodos = Array.from({ length: 5 }, (_, i) => ({
      id: `pending-todo-${i}`,
      note_id: 'note1',
      todo_id: `t${i + 10}`,
      text: `Pending todo ${i + 1}`,
      is_completed: false,
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
      sync_status: 'pending' as const,
    }));

    const store = createTestStore([...mockTodos, ...manyPendingTodos]);
    renderSyncTrigger({}, store);

    expect(screen.getByText('+4 more pending')).toBeInTheDocument();
  });

  it('shows more indicator when there are many conflict todos', () => {
    const manyConflictTodos = Array.from({ length: 5 }, (_, i) => ({
      id: `conflict-todo-${i}`,
      note_id: 'note1',
      todo_id: `t${i + 20}`,
      text: `Conflict todo ${i + 1}`,
      is_completed: false,
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
      sync_status: 'conflict' as const,
    }));

    const store = createTestStore([...mockTodos, ...manyConflictTodos]);
    renderSyncTrigger({}, store);

    expect(screen.getByText('+3 more conflicts')).toBeInTheDocument();
  });

  it('does not show details section when no pending or conflict todos', () => {
    const syncedTodos = mockTodos.map(todo => ({ ...todo, sync_status: 'synced' as const }));
    const store = createTestStore(syncedTodos);
    renderSyncTrigger({}, store);

    expect(screen.queryByText('Pending Sync')).not.toBeInTheDocument();
    expect(screen.queryByText('Conflicts')).not.toBeInTheDocument();
  });

  it('highlights pending count when there are pending todos', () => {
    renderSyncTrigger();

    const pendingValue = screen.getByText('2');
    expect(pendingValue).toHaveClass('has-pending');
  });

  it('highlights conflicts count when there are conflicts', () => {
    renderSyncTrigger();

    const conflictsValue = screen.getByText('1');
    expect(conflictsValue).toHaveClass('has-conflicts');
  });

  it('shows conflict todos with special styling', () => {
    renderSyncTrigger();

    const conflictItem = screen.getByText('Conflict todo').closest('.sync-detail-item');
    expect(conflictItem).toHaveClass('conflict');
  });
});
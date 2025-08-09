import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import CollaborationIndicators from '../CollaborationIndicators';
import collaborationReducer from '../../../stores/slices/collaborationSlice';
import { CollaborationUser } from '../../../types/collaboration';

// Mock the electron API
const mockElectronAPI = {
  getWebSocketUrl: jest.fn(),
  getConnectedUsers: jest.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

const mockUsers: CollaborationUser[] = [
  {
    id: 'user1',
    name: 'John Doe',
    email: 'john@example.com',
    avatarUrl: 'https://example.com/avatar1.jpg',
    isOnline: true,
    lastSeen: '2024-01-15T10:00:00Z',
  },
  {
    id: 'user2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    isOnline: true,
    lastSeen: '2024-01-15T09:30:00Z',
  },
  {
    id: 'user3',
    name: 'Bob Wilson',
    email: 'bob@example.com',
    isOnline: false,
    lastSeen: '2024-01-14T15:00:00Z',
  },
];

const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      collaboration: collaborationReducer,
    },
    preloadedState: {
      collaboration: {
        versions: [],
        currentVersion: null,
        isLoadingVersions: false,
        versionError: undefined,
        connectedUsers: [],
        userPresences: [],
        isCollaborating: false,
        conflicts: [],
        activeConflict: null,
        ...initialState,
      },
    },
  });
};

const renderWithStore = (component: React.ReactElement, store = createTestStore()) => {
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

describe('CollaborationIndicators', () => {
  const defaultProps = {
    noteId: 'note1',
    isEnabled: false,
    onToggle: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.getWebSocketUrl.mockResolvedValue('ws://localhost:8080');
    mockElectronAPI.getConnectedUsers.mockResolvedValue({ users: mockUsers });
  });

  it('renders collaboration toggle button', () => {
    renderWithStore(<CollaborationIndicators {...defaultProps} />);

    const toggleButton = screen.getByRole('button');
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveAttribute('title', 'Enable collaboration');
  });

  it('shows active state when collaboration is enabled', () => {
    const store = createTestStore({ isCollaborating: true });
    renderWithStore(
      <CollaborationIndicators {...defaultProps} isEnabled={true} />, 
      store
    );

    const toggleButton = screen.getByRole('button');
    expect(toggleButton).toHaveClass('active');
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('calls onToggle when toggle button is clicked', () => {
    renderWithStore(<CollaborationIndicators {...defaultProps} />);

    const toggleButton = screen.getByRole('button');
    fireEvent.click(toggleButton);

    expect(defaultProps.onToggle).toHaveBeenCalledWith(true);
  });

  it('shows connected users when collaboration is active', () => {
    const store = createTestStore({ 
      isCollaborating: true,
      connectedUsers: mockUsers 
    });
    renderWithStore(
      <CollaborationIndicators {...defaultProps} isEnabled={true} />, 
      store
    );

    expect(screen.getByText('2 online')).toBeInTheDocument();
  });

  it('shows user avatars for online users', () => {
    const store = createTestStore({ 
      isCollaborating: true,
      connectedUsers: mockUsers 
    });
    renderWithStore(
      <CollaborationIndicators {...defaultProps} isEnabled={true} />, 
      store
    );

    // Should show avatars for online users
    const avatars = screen.getAllByRole('img');
    expect(avatars).toHaveLength(1); // Only John has avatar URL

    // Should show placeholder for Jane
    expect(screen.getByText('J')).toBeInTheDocument(); // Jane's initial
  });

  it('shows user dropdown when users indicator is clicked', async () => {
    const store = createTestStore({ 
      isCollaborating: true,
      connectedUsers: mockUsers 
    });
    renderWithStore(
      <CollaborationIndicators {...defaultProps} isEnabled={true} />, 
      store
    );

    const usersIndicator = screen.getByText('2 online').closest('div');
    fireEvent.click(usersIndicator!);

    await waitFor(() => {
      expect(screen.getByText('Collaborators')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
    });
  });

  it('shows online/offline status for users', async () => {
    const store = createTestStore({ 
      isCollaborating: true,
      connectedUsers: mockUsers 
    });
    renderWithStore(
      <CollaborationIndicators {...defaultProps} isEnabled={true} />, 
      store
    );

    const usersIndicator = screen.getByText('2 online').closest('div');
    fireEvent.click(usersIndicator!);

    await waitFor(() => {
      expect(screen.getAllByText('Online')).toHaveLength(2);
      expect(screen.getByText(/1d ago/)).toBeInTheDocument(); // Bob's last seen
    });
  });

  it('closes user dropdown when close button is clicked', async () => {
    const store = createTestStore({ 
      isCollaborating: true,
      connectedUsers: mockUsers 
    });
    renderWithStore(
      <CollaborationIndicators {...defaultProps} isEnabled={true} />, 
      store
    );

    // Open dropdown
    const usersIndicator = screen.getByText('2 online').closest('div');
    fireEvent.click(usersIndicator!);

    await waitFor(() => {
      expect(screen.getByText('Collaborators')).toBeInTheDocument();
    });

    // Close dropdown
    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText('Collaborators')).not.toBeInTheDocument();
    });
  });

  it('shows "more users" indicator when there are more than 3 online users', () => {
    const manyUsers = Array.from({ length: 5 }, (_, i) => ({
      id: `user${i}`,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      isOnline: true,
      lastSeen: '2024-01-15T10:00:00Z',
    }));

    const store = createTestStore({ 
      isCollaborating: true,
      connectedUsers: manyUsers 
    });
    renderWithStore(
      <CollaborationIndicators {...defaultProps} isEnabled={true} />, 
      store
    );

    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getByText('5 online')).toBeInTheDocument();
  });

  it('handles empty user list', () => {
    const store = createTestStore({ 
      isCollaborating: true,
      connectedUsers: [] 
    });
    renderWithStore(
      <CollaborationIndicators {...defaultProps} isEnabled={true} />, 
      store
    );

    // Should not show user count when no users
    expect(screen.queryByText(/online/)).not.toBeInTheDocument();
  });

  it('shows typing indicator for active users', async () => {
    const store = createTestStore({ 
      isCollaborating: true,
      connectedUsers: mockUsers,
      userPresences: [{
        userId: 'user1',
        userName: 'John Doe',
        noteId: 'note1',
        cursor: { position: 100 },
        lastActivity: '2024-01-15T10:00:00Z',
      }]
    });
    renderWithStore(
      <CollaborationIndicators {...defaultProps} isEnabled={true} />, 
      store
    );

    const usersIndicator = screen.getByText('2 online').closest('div');
    fireEvent.click(usersIndicator!);

    await waitFor(() => {
      expect(screen.getByText('Editing')).toBeInTheDocument();
    });
  });

  it('formats last seen time correctly', async () => {
    const store = createTestStore({ 
      isCollaborating: true,
      connectedUsers: mockUsers 
    });
    renderWithStore(
      <CollaborationIndicators {...defaultProps} isEnabled={true} />, 
      store
    );

    const usersIndicator = screen.getByText('2 online').closest('div');
    fireEvent.click(usersIndicator!);

    await waitFor(() => {
      // Should show relative time for offline users
      expect(screen.getByText(/1d ago/)).toBeInTheDocument();
    });
  });
});
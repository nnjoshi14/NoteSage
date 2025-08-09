import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import VersionHistory from '../VersionHistory';
import collaborationReducer from '../../../stores/slices/collaborationSlice';
import { NoteVersion } from '../../../types/collaboration';

// Mock the electron API
const mockElectronAPI = {
  getVersionHistory: jest.fn(),
  getVersion: jest.fn(),
  restoreVersion: jest.fn(),
  createVersion: jest.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

const mockVersions: NoteVersion[] = [
  {
    id: 'v1',
    noteId: 'note1',
    version: 3,
    title: 'Test Note',
    content: 'Latest content',
    authorId: 'user1',
    authorName: 'John Doe',
    createdAt: '2024-01-15T10:00:00Z',
    changeDescription: 'Added new section',
  },
  {
    id: 'v2',
    noteId: 'note1',
    version: 2,
    title: 'Test Note',
    content: 'Previous content',
    authorId: 'user1',
    authorName: 'John Doe',
    createdAt: '2024-01-15T09:00:00Z',
    changeDescription: 'Initial draft',
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

describe('VersionHistory', () => {
  const defaultProps = {
    noteId: 'note1',
    currentContent: 'Current content',
    onVersionRestore: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.getVersionHistory.mockResolvedValue({ versions: mockVersions });
    mockElectronAPI.getVersion.mockResolvedValue({ version: mockVersions[0] });
    mockElectronAPI.restoreVersion.mockResolvedValue({ success: true });
  });

  it('renders loading state initially', () => {
    const store = createTestStore({ isLoadingVersions: true });
    renderWithStore(<VersionHistory {...defaultProps} />, store);

    expect(screen.getByText('Loading version history...')).toBeInTheDocument();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('renders error state when loading fails', () => {
    const store = createTestStore({ 
      versionError: 'Failed to load versions',
      isLoadingVersions: false 
    });
    renderWithStore(<VersionHistory {...defaultProps} />, store);

    expect(screen.getByText('Error loading version history: Failed to load versions')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('renders version list when loaded', async () => {
    const store = createTestStore({ 
      versions: mockVersions,
      isLoadingVersions: false 
    });
    renderWithStore(<VersionHistory {...defaultProps} />, store);

    expect(screen.getByText('Versions (2)')).toBeInTheDocument();
    expect(screen.getByText('v3')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(screen.getByText('by John Doe')).toBeInTheDocument();
  });

  it('shows version preview when version is selected', async () => {
    const store = createTestStore({ 
      versions: mockVersions,
      currentVersion: mockVersions[0],
      isLoadingVersions: false 
    });
    renderWithStore(<VersionHistory {...defaultProps} />, store);

    expect(screen.getByText('Version 3 Preview')).toBeInTheDocument();
    expect(screen.getByText('Latest content')).toBeInTheDocument();
  });

  it('shows diff when diff button is clicked', async () => {
    const store = createTestStore({ 
      versions: mockVersions,
      currentVersion: mockVersions[0],
      isLoadingVersions: false 
    });
    renderWithStore(<VersionHistory {...defaultProps} />, store);

    const diffButton = screen.getAllByText('Diff')[0];
    fireEvent.click(diffButton);

    await waitFor(() => {
      expect(screen.getByText('Changes in v3')).toBeInTheDocument();
    });
  });

  it('calls onVersionRestore when restore button is clicked', async () => {
    const store = createTestStore({ 
      versions: mockVersions,
      isLoadingVersions: false 
    });
    renderWithStore(<VersionHistory {...defaultProps} />, store);

    const restoreButton = screen.getAllByText('Restore')[0];
    fireEvent.click(restoreButton);

    // Confirm the restoration
    const confirmButton = screen.getByRole('button', { name: /ok/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockElectronAPI.restoreVersion).toHaveBeenCalledWith('note1', 3);
      expect(defaultProps.onVersionRestore).toHaveBeenCalledWith(mockVersions[0]);
    });
  });

  it('calls onClose when close button is clicked', () => {
    const store = createTestStore({ 
      versions: mockVersions,
      isLoadingVersions: false 
    });
    renderWithStore(<VersionHistory {...defaultProps} />, store);

    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('toggles diff view when Show Diff button is clicked', async () => {
    const store = createTestStore({ 
      versions: mockVersions,
      currentVersion: mockVersions[0],
      isLoadingVersions: false 
    });
    renderWithStore(<VersionHistory {...defaultProps} />, store);

    const showDiffButton = screen.getByText('Show Diff');
    fireEvent.click(showDiffButton);

    await waitFor(() => {
      expect(screen.getByText('Hide Diff')).toBeInTheDocument();
    });

    const hideDiffButton = screen.getByText('Hide Diff');
    fireEvent.click(hideDiffButton);

    await waitFor(() => {
      expect(screen.getByText('Show Diff')).toBeInTheDocument();
    });
  });

  it('handles empty version list', () => {
    const store = createTestStore({ 
      versions: [],
      isLoadingVersions: false 
    });
    renderWithStore(<VersionHistory {...defaultProps} />, store);

    expect(screen.getByText('Versions (0)')).toBeInTheDocument();
    expect(screen.getByText('No version history available')).toBeInTheDocument();
  });

  it('formats dates correctly', () => {
    const store = createTestStore({ 
      versions: mockVersions,
      isLoadingVersions: false 
    });
    renderWithStore(<VersionHistory {...defaultProps} />, store);

    // Should show relative time like "2 hours ago"
    expect(screen.getByText(/ago/)).toBeInTheDocument();
  });

  it('shows change descriptions when available', () => {
    const store = createTestStore({ 
      versions: mockVersions,
      isLoadingVersions: false 
    });
    renderWithStore(<VersionHistory {...defaultProps} />, store);

    expect(screen.getByText('Added new section')).toBeInTheDocument();
    expect(screen.getByText('Initial draft')).toBeInTheDocument();
  });
});
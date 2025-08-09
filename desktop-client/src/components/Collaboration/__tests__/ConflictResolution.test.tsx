import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ConflictResolution from '../ConflictResolution';
import collaborationReducer from '../../../stores/slices/collaborationSlice';
import { ConflictResolution as ConflictType } from '../../../types/collaboration';

// Mock the electron API
const mockElectronAPI = {
  resolveConflict: jest.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

const mockConflict: ConflictType = {
  conflictId: 'conflict1',
  noteId: 'note1',
  localVersion: {
    id: 'local1',
    noteId: 'note1',
    version: 3,
    title: 'Test Note',
    content: 'Local content with changes',
    authorId: 'user1',
    authorName: 'John Doe',
    createdAt: '2024-01-15T10:00:00Z',
  },
  remoteVersion: {
    id: 'remote1',
    noteId: 'note1',
    version: 3,
    title: 'Test Note',
    content: 'Remote content with different changes',
    authorId: 'user2',
    authorName: 'Jane Smith',
    createdAt: '2024-01-15T10:05:00Z',
  },
};

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

describe('ConflictResolution', () => {
  const defaultProps = {
    onResolved: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.resolveConflict.mockResolvedValue({ success: true });
  });

  it('shows no conflicts message when no active conflict', () => {
    renderWithStore(<ConflictResolution {...defaultProps} />);

    expect(screen.getByText('No Active Conflicts')).toBeInTheDocument();
    expect(screen.getByText('All conflicts have been resolved.')).toBeInTheDocument();
  });

  it('renders conflict resolution interface when there is an active conflict', () => {
    const store = createTestStore({ 
      activeConflict: mockConflict,
      conflicts: [mockConflict]
    });
    renderWithStore(<ConflictResolution {...defaultProps} />, store);

    expect(screen.getByText('Resolve Conflict')).toBeInTheDocument();
    expect(screen.getByText('Your Version (Local)')).toBeInTheDocument();
    expect(screen.getByText('Server Version (Remote)')).toBeInTheDocument();
  });

  it('shows version information correctly', () => {
    const store = createTestStore({ 
      activeConflict: mockConflict,
      conflicts: [mockConflict]
    });
    renderWithStore(<ConflictResolution {...defaultProps} />, store);

    expect(screen.getByText('Author: John Doe')).toBeInTheDocument();
    expect(screen.getByText('Author: Jane Smith')).toBeInTheDocument();
  });

  it('shows diff by default', () => {
    const store = createTestStore({ 
      activeConflict: mockConflict,
      conflicts: [mockConflict]
    });
    renderWithStore(<ConflictResolution {...defaultProps} />, store);

    expect(screen.getByText('Changes')).toBeInTheDocument();
    expect(screen.getByText('Hide Diff')).toBeInTheDocument();
  });

  it('toggles diff view when Hide/Show Diff button is clicked', async () => {
    const store = createTestStore({ 
      activeConflict: mockConflict,
      conflicts: [mockConflict]
    });
    renderWithStore(<ConflictResolution {...defaultProps} />, store);

    const hideDiffButton = screen.getByText('Hide Diff');
    fireEvent.click(hideDiffButton);

    await waitFor(() => {
      expect(screen.getByText('Show Diff')).toBeInTheDocument();
      expect(screen.queryByText('Changes')).not.toBeInTheDocument();
    });

    const showDiffButton = screen.getByText('Show Diff');
    fireEvent.click(showDiffButton);

    await waitFor(() => {
      expect(screen.getByText('Hide Diff')).toBeInTheDocument();
      expect(screen.getByText('Changes')).toBeInTheDocument();
    });
  });

  it('shows resolution options', () => {
    const store = createTestStore({ 
      activeConflict: mockConflict,
      conflicts: [mockConflict]
    });
    renderWithStore(<ConflictResolution {...defaultProps} />, store);

    expect(screen.getByText('Keep Your Version')).toBeInTheDocument();
    expect(screen.getByText('Use Server Version')).toBeInTheDocument();
    expect(screen.getByText('Merge Manually')).toBeInTheDocument();
  });

  it('selects local version by default', () => {
    const store = createTestStore({ 
      activeConflict: mockConflict,
      conflicts: [mockConflict]
    });
    renderWithStore(<ConflictResolution {...defaultProps} />, store);

    const localRadio = screen.getByDisplayValue('local');
    expect(localRadio).toBeChecked();
  });

  it('shows merge editor when manual merge is selected', async () => {
    const store = createTestStore({ 
      activeConflict: mockConflict,
      conflicts: [mockConflict]
    });
    renderWithStore(<ConflictResolution {...defaultProps} />, store);

    const mergeRadio = screen.getByDisplayValue('merged');
    fireEvent.click(mergeRadio);

    await waitFor(() => {
      expect(screen.getByText('Merged Content')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  it('resolves conflict with local version', async () => {
    const store = createTestStore({ 
      activeConflict: mockConflict,
      conflicts: [mockConflict]
    });
    renderWithStore(<ConflictResolution {...defaultProps} />, store);

    const resolveButton = screen.getByText('Resolve Conflict');
    fireEvent.click(resolveButton);

    await waitFor(() => {
      expect(mockElectronAPI.resolveConflict).toHaveBeenCalledWith({
        conflictId: 'conflict1',
        resolution: 'local',
        content: undefined,
      });
      expect(defaultProps.onResolved).toHaveBeenCalledWith('Local content with changes');
    });
  });

  it('resolves conflict with remote version', async () => {
    const store = createTestStore({ 
      activeConflict: mockConflict,
      conflicts: [mockConflict]
    });
    renderWithStore(<ConflictResolution {...defaultProps} />, store);

    const remoteRadio = screen.getByDisplayValue('remote');
    fireEvent.click(remoteRadio);

    const resolveButton = screen.getByText('Resolve Conflict');
    fireEvent.click(resolveButton);

    await waitFor(() => {
      expect(mockElectronAPI.resolveConflict).toHaveBeenCalledWith({
        conflictId: 'conflict1',
        resolution: 'remote',
        content: undefined,
      });
      expect(defaultProps.onResolved).toHaveBeenCalledWith('Remote content with different changes');
    });
  });

  it('resolves conflict with merged content', async () => {
    const store = createTestStore({ 
      activeConflict: mockConflict,
      conflicts: [mockConflict]
    });
    renderWithStore(<ConflictResolution {...defaultProps} />, store);

    const mergeRadio = screen.getByDisplayValue('merged');
    fireEvent.click(mergeRadio);

    await waitFor(() => {
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Manually merged content' } });
    });

    const resolveButton = screen.getByText('Resolve Conflict');
    fireEvent.click(resolveButton);

    await waitFor(() => {
      expect(mockElectronAPI.resolveConflict).toHaveBeenCalledWith({
        conflictId: 'conflict1',
        resolution: 'merged',
        content: 'Manually merged content',
      });
      expect(defaultProps.onResolved).toHaveBeenCalledWith('Manually merged content');
    });
  });

  it('disables resolve button when merged content is empty', async () => {
    const store = createTestStore({ 
      activeConflict: mockConflict,
      conflicts: [mockConflict]
    });
    renderWithStore(<ConflictResolution {...defaultProps} />, store);

    const mergeRadio = screen.getByDisplayValue('merged');
    fireEvent.click(mergeRadio);

    await waitFor(() => {
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '' } });
    });

    const resolveButton = screen.getByText('Resolve Conflict');
    expect(resolveButton).toBeDisabled();
  });

  it('calls onCancel when cancel button is clicked', () => {
    const store = createTestStore({ 
      activeConflict: mockConflict,
      conflicts: [mockConflict]
    });
    renderWithStore(<ConflictResolution {...defaultProps} />, store);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('shows conflict navigation when multiple conflicts exist', () => {
    const secondConflict = { ...mockConflict, conflictId: 'conflict2' };
    const store = createTestStore({ 
      activeConflict: mockConflict,
      conflicts: [mockConflict, secondConflict]
    });
    renderWithStore(<ConflictResolution {...defaultProps} />, store);

    expect(screen.getByDisplayValue('conflict1')).toBeInTheDocument();
    expect(screen.getByText('Conflict 1 of 2')).toBeInTheDocument();
  });

  it('shows diff statistics', () => {
    const store = createTestStore({ 
      activeConflict: mockConflict,
      conflicts: [mockConflict]
    });
    renderWithStore(<ConflictResolution {...defaultProps} />, store);

    // Should show added/removed line counts
    expect(screen.getByText(/\+\d+/)).toBeInTheDocument();
    expect(screen.getByText(/-\d+/)).toBeInTheDocument();
  });

  it('handles resolution error gracefully', async () => {
    mockElectronAPI.resolveConflict.mockRejectedValue(new Error('Resolution failed'));
    
    const store = createTestStore({ 
      activeConflict: mockConflict,
      conflicts: [mockConflict]
    });
    renderWithStore(<ConflictResolution {...defaultProps} />, store);

    const resolveButton = screen.getByText('Resolve Conflict');
    fireEvent.click(resolveButton);

    await waitFor(() => {
      expect(mockElectronAPI.resolveConflict).toHaveBeenCalled();
      // Should not call onResolved on error
      expect(defaultProps.onResolved).not.toHaveBeenCalled();
    });
  });

  it('shows resolving state during resolution', async () => {
    // Make the API call hang to test loading state
    mockElectronAPI.resolveConflict.mockImplementation(() => new Promise(() => {}));
    
    const store = createTestStore({ 
      activeConflict: mockConflict,
      conflicts: [mockConflict]
    });
    renderWithStore(<ConflictResolution {...defaultProps} />, store);

    const resolveButton = screen.getByText('Resolve Conflict');
    fireEvent.click(resolveButton);

    await waitFor(() => {
      expect(screen.getByText('Resolving...')).toBeInTheDocument();
      expect(resolveButton).toBeDisabled();
    });
  });
});
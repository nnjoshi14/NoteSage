import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import NotesList from '../NotesList';
import notesSlice, { Note } from '../../../stores/slices/notesSlice';

// Mock the hooks
jest.mock('../../../stores/hooks', () => ({
  useAppDispatch: () => jest.fn(),
  useAppSelector: (selector: any) => selector({
    notes: {
      notes: mockNotes,
      filters: {},
      isLoading: false,
      error: undefined,
      currentNote: null,
    }
  }),
}));

const mockNotes: Note[] = [
  {
    id: '1',
    title: 'Test Note 1',
    content: 'This is the content of test note 1',
    category: 'Note',
    tags: ['test', 'sample'],
    folder_path: '/',
    is_archived: false,
    is_pinned: false,
    is_favorite: true,
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-01T10:00:00Z',
    version: 1,
  },
  {
    id: '2',
    title: 'Meeting Notes',
    content: 'Meeting with team about project planning',
    category: 'Meeting',
    tags: ['meeting', 'planning'],
    folder_path: '/',
    is_archived: false,
    is_pinned: true,
    is_favorite: false,
    created_at: '2024-01-02T14:00:00Z',
    updated_at: '2024-01-02T14:00:00Z',
    version: 1,
  },
  {
    id: '3',
    title: 'Archived Note',
    content: 'This note has been archived',
    category: 'Note',
    tags: ['archived'],
    folder_path: '/',
    is_archived: true,
    is_pinned: false,
    is_favorite: false,
    created_at: '2024-01-03T09:00:00Z',
    updated_at: '2024-01-03T09:00:00Z',
    version: 1,
  },
];

const mockProps = {
  onNoteSelect: jest.fn(),
  onNoteCreate: jest.fn(),
  onNoteDelete: jest.fn(),
  onNoteArchive: jest.fn(),
  onNoteFavorite: jest.fn(),
};

const createMockStore = () => {
  return configureStore({
    reducer: {
      notes: notesSlice,
    },
    preloadedState: {
      notes: {
        notes: mockNotes,
        filters: {},
        isLoading: false,
        error: undefined,
        currentNote: null,
      },
    },
  });
};

const renderWithProvider = (component: React.ReactElement) => {
  const store = createMockStore();
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

describe('NotesList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders notes list with correct count', () => {
    renderWithProvider(<NotesList {...mockProps} />);
    
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument(); // Only non-archived notes
    expect(screen.getByText('Test Note 1')).toBeInTheDocument();
    expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
    expect(screen.queryByText('Archived Note')).not.toBeInTheDocument();
  });

  it('shows archived notes when archive filter is enabled', () => {
    renderWithProvider(<NotesList {...mockProps} />);
    
    const archivedCheckbox = screen.getByLabelText('Archived');
    fireEvent.click(archivedCheckbox);
    
    expect(screen.getByText('Archived Note')).toBeInTheDocument();
  });

  it('filters notes by search query', () => {
    renderWithProvider(<NotesList {...mockProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search notes...');
    fireEvent.change(searchInput, { target: { value: 'meeting' } });
    
    expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
    expect(screen.queryByText('Test Note 1')).not.toBeInTheDocument();
  });

  it('filters notes by category', () => {
    renderWithProvider(<NotesList {...mockProps} />);
    
    const categorySelect = screen.getByDisplayValue('All Categories');
    fireEvent.change(categorySelect, { target: { value: 'Meeting' } });
    
    expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
    expect(screen.queryByText('Test Note 1')).not.toBeInTheDocument();
  });

  it('shows only favorites when favorites filter is enabled', () => {
    renderWithProvider(<NotesList {...mockProps} />);
    
    const favoritesCheckbox = screen.getByLabelText('Favorites Only');
    fireEvent.click(favoritesCheckbox);
    
    expect(screen.getByText('Test Note 1')).toBeInTheDocument();
    expect(screen.queryByText('Meeting Notes')).not.toBeInTheDocument();
  });

  it('calls onNoteSelect when note is clicked', () => {
    renderWithProvider(<NotesList {...mockProps} />);
    
    const noteItem = screen.getByText('Test Note 1').closest('.note-item');
    fireEvent.click(noteItem!);
    
    expect(mockProps.onNoteSelect).toHaveBeenCalledWith(mockNotes[0]);
  });

  it('calls onNoteCreate when new note button is clicked', () => {
    renderWithProvider(<NotesList {...mockProps} />);
    
    const newNoteButton = screen.getByText('New Note');
    fireEvent.click(newNoteButton);
    
    expect(mockProps.onNoteCreate).toHaveBeenCalled();
  });

  it('calls onNoteFavorite when favorite button is clicked', () => {
    renderWithProvider(<NotesList {...mockProps} />);
    
    const favoriteButtons = screen.getAllByTitle(/Add to favorites|Remove from favorites/);
    fireEvent.click(favoriteButtons[0]);
    
    expect(mockProps.onNoteFavorite).toHaveBeenCalledWith('1');
  });

  it('calls onNoteArchive when archive button is clicked', () => {
    renderWithProvider(<NotesList {...mockProps} />);
    
    const archiveButtons = screen.getAllByTitle(/Archive|Unarchive/);
    fireEvent.click(archiveButtons[0]);
    
    expect(mockProps.onNoteArchive).toHaveBeenCalledWith('1');
  });

  it('calls onNoteDelete when delete button is clicked and confirmed', () => {
    // Mock window.confirm
    window.confirm = jest.fn(() => true);
    
    renderWithProvider(<NotesList {...mockProps} />);
    
    const deleteButtons = screen.getAllByTitle('Delete note');
    fireEvent.click(deleteButtons[0]);
    
    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this note?');
    expect(mockProps.onNoteDelete).toHaveBeenCalledWith('1');
  });

  it('does not call onNoteDelete when delete is cancelled', () => {
    // Mock window.confirm
    window.confirm = jest.fn(() => false);
    
    renderWithProvider(<NotesList {...mockProps} />);
    
    const deleteButtons = screen.getAllByTitle('Delete note');
    fireEvent.click(deleteButtons[0]);
    
    expect(window.confirm).toHaveBeenCalled();
    expect(mockProps.onNoteDelete).not.toHaveBeenCalled();
  });

  it('changes view mode when view mode buttons are clicked', () => {
    renderWithProvider(<NotesList {...mockProps} />);
    
    const gridViewButton = screen.getByTitle('Grid View');
    fireEvent.click(gridViewButton);
    
    const notesContent = document.querySelector('.notes-list-content');
    expect(notesContent).toHaveClass('grid');
    
    const compactViewButton = screen.getByTitle('Compact View');
    fireEvent.click(compactViewButton);
    
    expect(notesContent).toHaveClass('compact');
  });

  it('sorts notes correctly', () => {
    renderWithProvider(<NotesList {...mockProps} />);
    
    const sortSelect = screen.getByDisplayValue('Last Updated');
    fireEvent.change(sortSelect, { target: { value: 'title-asc' } });
    
    const noteItems = screen.getAllByText(/Test Note 1|Meeting Notes/);
    expect(noteItems[0]).toHaveTextContent('Meeting Notes');
    expect(noteItems[1]).toHaveTextContent('Test Note 1');
  });

  it('displays note metadata correctly', () => {
    renderWithProvider(<NotesList {...mockProps} />);
    
    // Check for category badges
    expect(screen.getByText('Note')).toBeInTheDocument();
    expect(screen.getByText('Meeting')).toBeInTheDocument();
    
    // Check for tags
    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('sample')).toBeInTheDocument();
    expect(screen.getByText('meeting')).toBeInTheDocument();
    expect(screen.getByText('planning')).toBeInTheDocument();
    
    // Check for pin and favorite icons
    expect(screen.getByText('📌')).toBeInTheDocument(); // Pinned note
    expect(screen.getByText('⭐')).toBeInTheDocument(); // Favorite note
  });

  it('shows empty state when no notes match filters', () => {
    renderWithProvider(<NotesList {...mockProps} />);
    
    const searchInput = screen.getByPlaceholderText('Search notes...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    
    expect(screen.getByText('No notes match your current filters.')).toBeInTheDocument();
    expect(screen.getByText('Clear Filters')).toBeInTheDocument();
  });

  it('clears filters when clear filters button is clicked', () => {
    renderWithProvider(<NotesList {...mockProps} />);
    
    // Apply some filters
    const searchInput = screen.getByPlaceholderText('Search notes...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    
    const clearFiltersButton = screen.getByText('Clear Filters');
    fireEvent.click(clearFiltersButton);
    
    expect(searchInput).toHaveValue('');
    expect(screen.getByText('Test Note 1')).toBeInTheDocument();
    expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    const store = configureStore({
      reducer: {
        notes: notesSlice,
      },
      preloadedState: {
        notes: {
          notes: [],
          filters: {},
          isLoading: true,
          error: undefined,
          currentNote: null,
        },
      },
    });

    render(
      <Provider store={store}>
        <NotesList {...mockProps} />
      </Provider>
    );
    
    expect(screen.getByText('Loading notes...')).toBeInTheDocument();
  });
});
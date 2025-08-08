import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AdvancedSearch from '../AdvancedSearch';
import notesSlice, { Note } from '../../../stores/slices/notesSlice';

const mockNotes: Note[] = [
  {
    id: '1',
    title: 'JavaScript Tutorial',
    content: 'Learn JavaScript fundamentals including variables, functions, and objects.',
    category: 'Note',
    tags: ['javascript', 'programming', 'tutorial'],
    folder_path: '/programming',
    is_archived: false,
    is_pinned: false,
    is_favorite: true,
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-15T14:30:00Z',
    version: 1,
  },
  {
    id: '2',
    title: 'Team Meeting Notes',
    content: 'Discussed project timeline and resource allocation for Q2.',
    category: 'Meeting',
    tags: ['meeting', 'planning', 'team'],
    folder_path: '/meetings',
    is_archived: false,
    is_pinned: true,
    is_favorite: false,
    created_at: '2024-01-10T09:00:00Z',
    updated_at: '2024-01-10T11:00:00Z',
    version: 1,
  },
  {
    id: '3',
    title: 'Research Paper Draft',
    content: 'Initial draft of research paper on machine learning algorithms.',
    category: 'Research',
    tags: ['research', 'ml', 'draft'],
    folder_path: '/research',
    is_archived: true,
    is_pinned: false,
    is_favorite: false,
    created_at: '2023-12-01T08:00:00Z',
    updated_at: '2023-12-15T16:45:00Z',
    version: 2,
  },
  {
    id: '4',
    title: 'Personal Journal',
    content: 'Reflections on personal growth and learning objectives.',
    category: 'Personal',
    tags: ['journal', 'personal', 'growth'],
    folder_path: '/personal',
    is_archived: false,
    is_pinned: false,
    is_favorite: true,
    created_at: '2024-01-05T20:00:00Z',
    updated_at: '2024-01-20T21:15:00Z',
    version: 1,
  },
];

const mockProps = {
  onSearchResults: jest.fn(),
  onClose: jest.fn(),
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

describe('AdvancedSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders advanced search modal', () => {
    renderWithProvider(<AdvancedSearch {...mockProps} />);
    
    expect(screen.getByText('Advanced Search')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter search terms...')).toBeInTheDocument();
    expect(screen.getByText('Categories')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('Date Range')).toBeInTheDocument();
  });

  it('displays all notes initially', () => {
    renderWithProvider(<AdvancedSearch {...mockProps} />);
    
    expect(screen.getByText('Search Results (4)')).toBeInTheDocument();
    expect(screen.getByText('JavaScript Tutorial')).toBeInTheDocument();
    expect(screen.getByText('Team Meeting Notes')).toBeInTheDocument();
    expect(screen.getByText('Research Paper Draft')).toBeInTheDocument();
    expect(screen.getByText('Personal Journal')).toBeInTheDocument();
  });

  it('filters notes by search query', () => {
    renderWithProvider(<AdvancedSearch {...mockProps} />);
    
    const searchInput = screen.getByPlaceholderText('Enter search terms...');
    fireEvent.change(searchInput, { target: { value: 'javascript' } });
    
    expect(screen.getByText('Search Results (1)')).toBeInTheDocument();
    expect(screen.getByText('JavaScript Tutorial')).toBeInTheDocument();
    expect(screen.queryByText('Team Meeting Notes')).not.toBeInTheDocument();
  });

  it('filters notes by content type', () => {
    renderWithProvider(<AdvancedSearch {...mockProps} />);
    
    const searchInput = screen.getByPlaceholderText('Enter search terms...');
    fireEvent.change(searchInput, { target: { value: 'tutorial' } });
    
    const contentTypeSelect = screen.getByDisplayValue('All Content');
    fireEvent.change(contentTypeSelect, { target: { value: 'title' } });
    
    expect(screen.getByText('Search Results (1)')).toBeInTheDocument();
    expect(screen.getByText('JavaScript Tutorial')).toBeInTheDocument();
  });

  it('filters notes by category', () => {
    renderWithProvider(<AdvancedSearch {...mockProps} />);
    
    const meetingChip = screen.getByText('Meeting');
    fireEvent.click(meetingChip);
    
    expect(screen.getByText('Search Results (1)')).toBeInTheDocument();
    expect(screen.getByText('Team Meeting Notes')).toBeInTheDocument();
    expect(screen.queryByText('JavaScript Tutorial')).not.toBeInTheDocument();
  });

  it('filters notes by tags', () => {
    renderWithProvider(<AdvancedSearch {...mockProps} />);
    
    const programmingTag = screen.getByText('programming');
    fireEvent.click(programmingTag);
    
    expect(screen.getByText('Search Results (1)')).toBeInTheDocument();
    expect(screen.getByText('JavaScript Tutorial')).toBeInTheDocument();
  });

  it('filters notes by date range', () => {
    renderWithProvider(<AdvancedSearch {...mockProps} />);
    
    const startDateInput = screen.getAllByType('date')[0];
    const endDateInput = screen.getAllByType('date')[1];
    
    fireEvent.change(startDateInput, { target: { value: '2024-01-01' } });
    fireEvent.change(endDateInput, { target: { value: '2024-01-31' } });
    
    // Should show notes updated in January 2024
    expect(screen.getByText('Search Results (3)')).toBeInTheDocument();
    expect(screen.queryByText('Research Paper Draft')).not.toBeInTheDocument(); // Updated in December 2023
  });

  it('includes archived notes when option is checked', () => {
    renderWithProvider(<AdvancedSearch {...mockProps} />);
    
    // Initially archived notes are excluded
    expect(screen.getByText('Search Results (3)')).toBeInTheDocument();
    expect(screen.queryByText('Research Paper Draft')).not.toBeInTheDocument();
    
    const includeArchivedCheckbox = screen.getByLabelText('Include archived notes');
    fireEvent.click(includeArchivedCheckbox);
    
    expect(screen.getByText('Search Results (4)')).toBeInTheDocument();
    expect(screen.getByText('Research Paper Draft')).toBeInTheDocument();
  });

  it('shows only favorites when option is checked', () => {
    renderWithProvider(<AdvancedSearch {...mockProps} />);
    
    const favoritesOnlyCheckbox = screen.getByLabelText('Favorites only');
    fireEvent.click(favoritesOnlyCheckbox);
    
    expect(screen.getByText('Search Results (2)')).toBeInTheDocument();
    expect(screen.getByText('JavaScript Tutorial')).toBeInTheDocument();
    expect(screen.getByText('Personal Journal')).toBeInTheDocument();
    expect(screen.queryByText('Team Meeting Notes')).not.toBeInTheDocument();
  });

  it('sorts results by different criteria', () => {
    renderWithProvider(<AdvancedSearch {...mockProps} />);
    
    const sortSelect = screen.getByDisplayValue('Relevance');
    fireEvent.change(sortSelect, { target: { value: 'title' } });
    
    const resultItems = screen.getAllByText(/JavaScript Tutorial|Team Meeting Notes|Personal Journal/);
    expect(resultItems[0]).toHaveTextContent('JavaScript Tutorial');
    expect(resultItems[1]).toHaveTextContent('Personal Journal');
    expect(resultItems[2]).toHaveTextContent('Team Meeting Notes');
  });

  it('changes sort order', () => {
    renderWithProvider(<AdvancedSearch {...mockProps} />);
    
    const sortSelect = screen.getByDisplayValue('Relevance');
    fireEvent.change(sortSelect, { target: { value: 'title' } });
    
    const orderSelect = screen.getByDisplayValue('Descending');
    fireEvent.change(orderSelect, { target: { value: 'asc' } });
    
    const resultItems = screen.getAllByText(/JavaScript Tutorial|Team Meeting Notes|Personal Journal/);
    expect(resultItems[0]).toHaveTextContent('JavaScript Tutorial');
  });

  it('calculates relevance score correctly', () => {
    renderWithProvider(<AdvancedSearch {...mockProps} />);
    
    const searchInput = screen.getByPlaceholderText('Enter search terms...');
    fireEvent.change(searchInput, { target: { value: 'javascript' } });
    
    // Should prioritize title matches over content matches
    expect(screen.getByText('JavaScript Tutorial')).toBeInTheDocument();
  });

  it('clears all filters when clear filters button is clicked', () => {
    renderWithProvider(<AdvancedSearch {...mockProps} />);
    
    // Apply some filters
    const searchInput = screen.getByPlaceholderText('Enter search terms...');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    
    const meetingChip = screen.getByText('Meeting');
    fireEvent.click(meetingChip);
    
    const clearFiltersButton = screen.getByText('Clear Filters');
    fireEvent.click(clearFiltersButton);
    
    expect(searchInput).toHaveValue('');
    expect(meetingChip).not.toHaveClass('active');
    expect(screen.getByText('Search Results (3)')).toBeInTheDocument(); // Back to non-archived count
  });

  it('calls onSearchResults when search results change', () => {
    renderWithProvider(<AdvancedSearch {...mockProps} />);
    
    const searchInput = screen.getByPlaceholderText('Enter search terms...');
    fireEvent.change(searchInput, { target: { value: 'javascript' } });
    
    expect(mockProps.onSearchResults).toHaveBeenCalled();
    const lastCall = mockProps.onSearchResults.mock.calls[mockProps.onSearchResults.mock.calls.length - 1];
    expect(lastCall[0]).toHaveLength(1);
    expect(lastCall[0][0].title).toBe('JavaScript Tutorial');
  });

  it('calls onClose when close button is clicked', () => {
    renderWithProvider(<AdvancedSearch {...mockProps} />);
    
    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);
    
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when close button in footer is clicked', () => {
    renderWithProvider(<AdvancedSearch {...mockProps} />);
    
    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);
    
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('shows empty state when no results match', () => {
    renderWithProvider(<AdvancedSearch {...mockProps} />);
    
    const searchInput = screen.getByPlaceholderText('Enter search terms...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    
    expect(screen.getByText('Search Results (0)')).toBeInTheDocument();
    expect(screen.getByText('No notes match your search criteria.')).toBeInTheDocument();
  });

  it('shows initial empty state message', () => {
    const emptyStore = configureStore({
      reducer: {
        notes: notesSlice,
      },
      preloadedState: {
        notes: {
          notes: [],
          filters: {},
          isLoading: false,
          error: undefined,
          currentNote: null,
        },
      },
    });

    render(
      <Provider store={emptyStore}>
        <AdvancedSearch {...mockProps} />
      </Provider>
    );
    
    expect(screen.getByText('Enter search terms or apply filters to find notes.')).toBeInTheDocument();
  });

  it('displays note metadata in results', () => {
    renderWithProvider(<AdvancedSearch {...mockProps} />);
    
    // Check for category badges
    expect(screen.getByText('Note')).toBeInTheDocument();
    expect(screen.getByText('Meeting')).toBeInTheDocument();
    
    // Check for tags in results
    const resultTags = screen.getAllByText('javascript');
    expect(resultTags.length).toBeGreaterThan(0);
  });

  it('limits displayed tags in results', () => {
    // Create a note with many tags
    const noteWithManyTags = {
      ...mockNotes[0],
      tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'tag7'],
    };

    const storeWithManyTags = configureStore({
      reducer: {
        notes: notesSlice,
      },
      preloadedState: {
        notes: {
          notes: [noteWithManyTags],
          filters: {},
          isLoading: false,
          error: undefined,
          currentNote: null,
        },
      },
    });

    render(
      <Provider store={storeWithManyTags}>
        <AdvancedSearch {...mockProps} />
      </Provider>
    );
    
    expect(screen.getByText('+2')).toBeInTheDocument(); // Should show +2 for remaining tags
  });

  it('handles multiple category selections', () => {
    renderWithProvider(<AdvancedSearch {...mockProps} />);
    
    const noteChip = screen.getByText('Note');
    const meetingChip = screen.getByText('Meeting');
    
    fireEvent.click(noteChip);
    fireEvent.click(meetingChip);
    
    expect(screen.getByText('Search Results (2)')).toBeInTheDocument();
    expect(screen.getByText('JavaScript Tutorial')).toBeInTheDocument();
    expect(screen.getByText('Team Meeting Notes')).toBeInTheDocument();
  });

  it('handles multiple tag selections', () => {
    renderWithProvider(<AdvancedSearch {...mockProps} />);
    
    const programmingTag = screen.getByText('programming');
    const meetingTag = screen.getByText('meeting');
    
    fireEvent.click(programmingTag);
    fireEvent.click(meetingTag);
    
    expect(screen.getByText('Search Results (2)')).toBeInTheDocument();
    expect(screen.getByText('JavaScript Tutorial')).toBeInTheDocument();
    expect(screen.getByText('Team Meeting Notes')).toBeInTheDocument();
  });

  it('shows limited number of tags in filter chips', () => {
    renderWithProvider(<AdvancedSearch {...mockProps} />);
    
    // Should show up to 20 tags, then "+X more"
    const allTags = ['javascript', 'programming', 'tutorial', 'meeting', 'planning', 'team', 'research', 'ml', 'draft', 'journal', 'personal', 'growth'];
    
    // All our test tags should be visible since we have less than 20
    allTags.forEach(tag => {
      expect(screen.getByText(tag)).toBeInTheDocument();
    });
  });
});
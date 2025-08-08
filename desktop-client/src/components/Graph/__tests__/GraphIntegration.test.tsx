import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import '@testing-library/jest-dom';
import GraphPage from '../GraphPage';
import notesReducer, { Note } from '../../../stores/slices/notesSlice';
import peopleReducer, { Person } from '../../../stores/slices/peopleSlice';

// Mock D3 with more detailed simulation for integration testing
const mockSimulation = {
  force: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  alphaTarget: jest.fn().mockReturnThis(),
  restart: jest.fn().mockReturnThis(),
  nodes: jest.fn().mockReturnThis(),
};

const mockSelection = {
  selectAll: jest.fn().mockReturnThis(),
  remove: jest.fn().mockReturnThis(),
  attr: jest.fn().mockReturnThis(),
  call: jest.fn().mockReturnThis(),
  append: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis(),
  data: jest.fn().mockReturnThis(),
  enter: jest.fn().mockReturnThis(),
  text: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
};

jest.mock('d3', () => ({
  select: jest.fn(() => mockSelection),
  forceSimulation: jest.fn(() => mockSimulation),
  forceLink: jest.fn(() => ({
    id: jest.fn().mockReturnThis(),
    distance: jest.fn().mockReturnThis(),
    strength: jest.fn().mockReturnThis(),
  })),
  forceManyBody: jest.fn(() => ({
    strength: jest.fn().mockReturnThis(),
  })),
  forceCenter: jest.fn(),
  forceCollide: jest.fn(() => ({
    radius: jest.fn().mockReturnThis(),
  })),
  forceX: jest.fn(() => ({
    strength: jest.fn().mockReturnThis(),
  })),
  forceY: jest.fn(() => ({
    strength: jest.fn().mockReturnThis(),
    y: jest.fn().mockReturnThis(),
  })),
  zoom: jest.fn(() => ({
    scaleExtent: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
  })),
  drag: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
  })),
}));

const mockNotes: Note[] = [
  {
    id: '1',
    title: 'Team Meeting',
    content: 'Had a productive meeting with @John Smith and @Sarah Johnson. Discussed #[[Project Roadmap]] and next steps.',
    category: 'Meeting',
    tags: ['work', 'team'],
    folder_path: '/',
    is_archived: false,
    is_pinned: false,
    is_favorite: false,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    version: 1,
  },
  {
    id: '2',
    title: 'Project Roadmap',
    content: 'Q1 goals and milestones. Need to coordinate with @John Smith on technical requirements.',
    category: 'Note',
    tags: ['project', 'planning'],
    folder_path: '/projects',
    is_archived: false,
    is_pinned: true,
    is_favorite: true,
    created_at: '2024-01-14T09:00:00Z',
    updated_at: '2024-01-14T09:00:00Z',
    version: 1,
  },
  {
    id: '3',
    title: 'Research Notes',
    content: 'Findings from user research. Shared with @Sarah Johnson for design input.',
    category: 'Note',
    tags: ['research', 'ux'],
    folder_path: '/research',
    is_archived: false,
    is_pinned: false,
    is_favorite: false,
    created_at: '2024-01-13T14:00:00Z',
    updated_at: '2024-01-13T14:00:00Z',
    version: 1,
  },
];

const mockPeople: Person[] = [
  {
    id: '1',
    name: 'John Smith',
    email: 'john.smith@company.com',
    company: 'Tech Corp',
    title: 'Senior Developer',
    phone: '+1-555-0123',
    linkedin_url: 'https://linkedin.com/in/johnsmith',
    created_at: '2024-01-10T10:00:00Z',
    updated_at: '2024-01-10T10:00:00Z',
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@company.com',
    company: 'Design Studio',
    title: 'UX Designer',
    phone: '+1-555-0124',
    created_at: '2024-01-11T10:00:00Z',
    updated_at: '2024-01-11T10:00:00Z',
  },
];

const createMockStore = (notes = mockNotes, people = mockPeople) => {
  return configureStore({
    reducer: {
      notes: notesReducer,
      people: peopleReducer,
    },
    preloadedState: {
      notes: {
        notes,
        currentNote: null,
        isLoading: false,
        filters: {},
      },
      people: {
        people,
        currentPerson: null,
        isLoading: false,
        filters: {},
      },
    },
  });
};

const renderWithProviders = (component: React.ReactElement, store = createMockStore()) => {
  return render(
    <Provider store={store}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </Provider>
  );
};

describe('Graph Integration Tests', () => {
  beforeEach(() => {
    // Mock getBoundingClientRect for container sizing
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 1000,
      height: 800,
      top: 0,
      left: 0,
      bottom: 800,
      right: 1000,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders complete graph page with data', async () => {
    renderWithProviders(<GraphPage />);
    
    // Check page structure
    expect(screen.getByText('Knowledge Graph')).toBeInTheDocument();
    expect(screen.getByText('Explore connections between your notes and people')).toBeInTheDocument();
    
    // Check graph controls
    expect(screen.getByPlaceholderText('Search nodes...')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')[0]).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')[1]).toBeInTheDocument();
    
    // Should not show empty state with data
    expect(screen.queryByText('No Connections Yet')).not.toBeInTheDocument();
  });

  it('handles search functionality across the graph', async () => {
    renderWithProviders(<GraphPage />);
    
    const searchInput = screen.getByPlaceholderText('Search nodes...');
    
    // Search for a person
    fireEvent.change(searchInput, { target: { value: 'John' } });
    await waitFor(() => {
      expect(searchInput).toHaveValue('John');
    });
    
    // Search for a note
    fireEvent.change(searchInput, { target: { value: 'Meeting' } });
    await waitFor(() => {
      expect(searchInput).toHaveValue('Meeting');
    });
    
    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    await waitFor(() => {
      expect(searchInput).toHaveValue('');
    });
  });

  it('filters graph by node type', async () => {
    renderWithProviders(<GraphPage />);
    
    const filterSelect = screen.getAllByRole('combobox')[0];
    
    // Filter to show only notes
    fireEvent.change(filterSelect, { target: { value: 'notes' } });
    await waitFor(() => {
      expect(filterSelect).toHaveValue('notes');
    });
    
    // Filter to show only people
    fireEvent.change(filterSelect, { target: { value: 'people' } });
    await waitFor(() => {
      expect(filterSelect).toHaveValue('people');
    });
    
    // Reset to show all
    fireEvent.change(filterSelect, { target: { value: 'all' } });
    await waitFor(() => {
      expect(filterSelect).toHaveValue('all');
    });
  });

  it('changes graph layout', async () => {
    renderWithProviders(<GraphPage />);
    
    const layoutSelect = screen.getAllByRole('combobox')[1];
    
    // Change to circular layout
    fireEvent.change(layoutSelect, { target: { value: 'circular' } });
    await waitFor(() => {
      expect(layoutSelect).toHaveValue('circular');
    });
    
    // Change to hierarchical layout
    fireEvent.change(layoutSelect, { target: { value: 'hierarchical' } });
    await waitFor(() => {
      expect(layoutSelect).toHaveValue('hierarchical');
    });
    
    // Back to force layout
    fireEvent.change(layoutSelect, { target: { value: 'force' } });
    await waitFor(() => {
      expect(layoutSelect).toHaveValue('force');
    });
  });

  it('shows empty state when no data is available', () => {
    const emptyStore = createMockStore([], []);
    renderWithProviders(<GraphPage />, emptyStore);
    
    expect(screen.getByText('No Connections Yet')).toBeInTheDocument();
    expect(screen.getByText(/Create connections by mentioning people/)).toBeInTheDocument();
    expect(screen.getByText('Tips to build your knowledge graph:')).toBeInTheDocument();
    
    // Check that tips are displayed
    expect(screen.getByText('Add people to your contacts')).toBeInTheDocument();
    expect(screen.getByText('Mention people in notes using @name')).toBeInTheDocument();
    expect(screen.getByText('Reference other notes using #[[note title]]')).toBeInTheDocument();
  });

  it('handles data updates correctly', async () => {
    const store = createMockStore();
    const { rerender } = renderWithProviders(<GraphPage />, store);
    
    // Initially should show graph with data
    expect(screen.queryByText('No Connections Yet')).not.toBeInTheDocument();
    
    // Update store with empty data
    const emptyStore = createMockStore([], []);
    rerender(
      <Provider store={emptyStore}>
        <BrowserRouter>
          <GraphPage />
        </BrowserRouter>
      </Provider>
    );
    
    // Should now show empty state
    await waitFor(() => {
      expect(screen.getByText('No Connections Yet')).toBeInTheDocument();
    });
  });

  it('maintains responsive behavior', () => {
    // Mock smaller screen size
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 400,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));
    
    renderWithProviders(<GraphPage />);
    
    // Component should still render correctly on smaller screens
    expect(screen.getByText('Knowledge Graph')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search nodes...')).toBeInTheDocument();
  });

  it('handles window resize events', () => {
    const mockAddEventListener = jest.spyOn(window, 'addEventListener');
    const mockRemoveEventListener = jest.spyOn(window, 'removeEventListener');
    
    const { unmount } = renderWithProviders(<GraphPage />);
    
    // Should register resize listener
    expect(mockAddEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    
    // Simulate resize
    const resizeHandler = mockAddEventListener.mock.calls.find(
      call => call[0] === 'resize'
    )?.[1] as EventListener;
    
    if (resizeHandler) {
      resizeHandler(new Event('resize'));
    }
    
    // Should clean up on unmount
    unmount();
    expect(mockRemoveEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    
    mockAddEventListener.mockRestore();
    mockRemoveEventListener.mockRestore();
  });

  it('processes complex note connections correctly', () => {
    const complexNotes: Note[] = [
      {
        id: '1',
        title: 'Complex Note',
        content: `
          Meeting with @John Smith, @Sarah Johnson, and @Mike Wilson.
          Referenced documents: #[[Project Plan]], #[[Budget Analysis]], #[[Timeline]].
          Follow up with @John about #[[Technical Specs]].
        `,
        category: 'Meeting',
        tags: ['complex', 'multi-reference'],
        folder_path: '/',
        is_archived: false,
        is_pinned: false,
        is_favorite: false,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        version: 1,
      },
    ];
    
    const complexPeople: Person[] = [
      ...mockPeople,
      {
        id: '3',
        name: 'Mike Wilson',
        email: 'mike.wilson@company.com',
        company: 'Tech Corp',
        title: 'Project Manager',
        created_at: '2024-01-12T10:00:00Z',
        updated_at: '2024-01-12T10:00:00Z',
      },
    ];
    
    const complexStore = createMockStore(complexNotes, complexPeople);
    renderWithProviders(<GraphPage />, complexStore);
    
    // Should handle multiple connections without errors
    expect(screen.queryByText('No Connections Yet')).not.toBeInTheDocument();
    expect(screen.getByText('Knowledge Graph')).toBeInTheDocument();
  });
});
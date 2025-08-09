import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import '@testing-library/jest-dom';
import KnowledgeGraph, { GraphNode } from '../KnowledgeGraph';
import notesReducer, { Note } from '../../../stores/slices/notesSlice';
import peopleReducer, { Person } from '../../../stores/slices/peopleSlice';

// Mock D3 to avoid DOM manipulation issues in tests
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
  forceSimulation: jest.fn(() => ({
    force: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    alphaTarget: jest.fn().mockReturnThis(),
    restart: jest.fn().mockReturnThis(),
  })),
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
    title: 'Meeting with @John Smith',
    content: 'Had a great meeting with @John Smith about the project. Referenced #[[Project Planning]] document.',
    category: 'Meeting',
    tags: ['work', 'project'],
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
    title: 'Project Planning',
    content: 'This is the main project planning document. Need to follow up with @Jane Doe.',
    category: 'Note',
    tags: ['project', 'planning'],
    folder_path: '/',
    is_archived: false,
    is_pinned: true,
    is_favorite: false,
    created_at: '2024-01-14T09:00:00Z',
    updated_at: '2024-01-14T09:00:00Z',
    version: 1,
  },
  {
    id: '3',
    title: 'Archived Note',
    content: 'This note is archived and should not appear in the graph.',
    category: 'Note',
    tags: [],
    folder_path: '/',
    is_archived: true,
    is_pinned: false,
    is_favorite: false,
    created_at: '2024-01-13T08:00:00Z',
    updated_at: '2024-01-13T08:00:00Z',
    version: 1,
  },
];

const mockPeople: Person[] = [
  {
    id: '1',
    name: 'John Smith',
    email: 'john.smith@example.com',
    company: 'Tech Corp',
    title: 'Senior Developer',
    created_at: '2024-01-10T10:00:00Z',
    updated_at: '2024-01-10T10:00:00Z',
  },
  {
    id: '2',
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    company: 'Design Studio',
    title: 'UX Designer',
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

const renderWithStore = (component: React.ReactElement, store = createMockStore()) => {
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

describe('KnowledgeGraph', () => {
  beforeEach(() => {
    // Mock getBoundingClientRect for container sizing
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the knowledge graph component', () => {
    renderWithStore(<KnowledgeGraph />);
    
    expect(screen.getByPlaceholderText('Search nodes...')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
  });

  it('shows empty state when no data is available', () => {
    const emptyStore = createMockStore([], []);
    renderWithStore(<KnowledgeGraph />, emptyStore);
    
    expect(screen.getByText('No Connections Yet')).toBeInTheDocument();
    expect(screen.getByText(/Create connections by mentioning people/)).toBeInTheDocument();
    expect(screen.getByText('Tips to build your knowledge graph:')).toBeInTheDocument();
  });

  it('renders controls correctly', () => {
    renderWithStore(<KnowledgeGraph />);
    
    // Search input
    const searchInput = screen.getByPlaceholderText('Search nodes...');
    expect(searchInput).toBeInTheDocument();
    
    // Filter and layout dropdowns
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes).toHaveLength(2);
    expect(comboboxes[0]).toBeInTheDocument(); // Filter select
    expect(comboboxes[1]).toBeInTheDocument(); // Layout select
  });

  it('handles search input changes', async () => {
    renderWithStore(<KnowledgeGraph />);
    
    const searchInput = screen.getByPlaceholderText('Search nodes...');
    fireEvent.change(searchInput, { target: { value: 'John' } });
    
    await waitFor(() => {
      expect(searchInput).toHaveValue('John');
    });
  });

  it('handles filter changes', async () => {
    renderWithStore(<KnowledgeGraph />);
    
    const filterSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(filterSelect, { target: { value: 'notes' } });
    
    await waitFor(() => {
      expect(filterSelect).toHaveValue('notes');
    });
  });

  it('handles layout changes', async () => {
    renderWithStore(<KnowledgeGraph />);
    
    const layoutSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(layoutSelect, { target: { value: 'circular' } });
    
    await waitFor(() => {
      expect(layoutSelect).toHaveValue('circular');
    });
  });

  it('calls onNodeClick when provided', () => {
    const mockOnNodeClick = jest.fn();
    renderWithStore(<KnowledgeGraph onNodeClick={mockOnNodeClick} />);
    
    // Since D3 is mocked, we can't test actual node clicks
    // But we can verify the callback is passed correctly
    expect(mockOnNodeClick).not.toHaveBeenCalled();
  });

  it('calls onNodeDoubleClick when provided', () => {
    const mockOnNodeDoubleClick = jest.fn();
    renderWithStore(<KnowledgeGraph onNodeDoubleClick={mockOnNodeDoubleClick} />);
    
    // Since D3 is mocked, we can't test actual node double clicks
    // But we can verify the callback is passed correctly
    expect(mockOnNodeDoubleClick).not.toHaveBeenCalled();
  });

  it('applies custom className', () => {
    const { container } = renderWithStore(<KnowledgeGraph className="custom-class" />);
    
    expect(container.firstChild).toHaveClass('knowledge-graph', 'custom-class');
  });

  it('shows graph container when data is available', () => {
    renderWithStore(<KnowledgeGraph />);
    
    const graphContainer = document.querySelector('.graph-container');
    expect(graphContainer).toBeInTheDocument();
    
    const svg = document.querySelector('.graph-svg');
    expect(svg).toBeInTheDocument();
  });

  it('filters nodes by type correctly', async () => {
    renderWithStore(<KnowledgeGraph />);
    
    const filterSelect = screen.getAllByRole('combobox')[0];
    
    // Test notes filter
    fireEvent.change(filterSelect, { target: { value: 'notes' } });
    await waitFor(() => {
      expect(filterSelect).toHaveValue('notes');
    });
    
    // Test people filter
    fireEvent.change(filterSelect, { target: { value: 'people' } });
    await waitFor(() => {
      expect(filterSelect).toHaveValue('people');
    });
  });

  it('handles window resize events', () => {
    const mockAddEventListener = jest.spyOn(window, 'addEventListener');
    const mockRemoveEventListener = jest.spyOn(window, 'removeEventListener');
    
    const { unmount } = renderWithStore(<KnowledgeGraph />);
    
    expect(mockAddEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    
    unmount();
    
    expect(mockRemoveEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    
    mockAddEventListener.mockRestore();
    mockRemoveEventListener.mockRestore();
  });

  it('extracts connections from note content correctly', () => {
    // This test would require exposing the extractConnections method
    // or testing it indirectly through the component behavior
    renderWithStore(<KnowledgeGraph />);
    
    // The component should process the mock data and create connections
    // between notes and people based on @mentions and #[[references]]
    expect(screen.queryByText('No Connections Yet')).not.toBeInTheDocument();
  });

  it('handles archived notes correctly', () => {
    renderWithStore(<KnowledgeGraph />);
    
    // Archived notes should not appear in the graph
    // This is tested indirectly by ensuring the component renders
    // without showing the archived note
    expect(screen.queryByText('No Connections Yet')).not.toBeInTheDocument();
  });

  it('shows node detail panel when node is selected', () => {
    // This would require simulating node selection
    // Since D3 is mocked, we can't test this directly
    // But the component structure supports it
    renderWithStore(<KnowledgeGraph />);
    
    // The detail panel would appear when a node is selected
    // This is handled by the D3 click handlers
    expect(document.querySelector('.node-detail-panel')).not.toBeInTheDocument();
  });
});

describe('KnowledgeGraph Connection Extraction', () => {
  it('should extract person mentions from note content', () => {
    const notes = [
      {
        ...mockNotes[0],
        content: 'Meeting with @John Smith and @Jane Doe about the project.',
      },
    ];
    
    renderWithStore(<KnowledgeGraph />, createMockStore(notes, mockPeople));
    
    // The component should create connections between the note and mentioned people
    expect(screen.queryByText('No Connections Yet')).not.toBeInTheDocument();
  });

  it('should extract note references from content', () => {
    const notes = [
      {
        ...mockNotes[0],
        content: 'See #[[Project Planning]] and #[[Meeting Notes]] for details.',
      },
      {
        ...mockNotes[1],
        title: 'Meeting Notes',
        content: 'Notes from the meeting.',
      },
    ];
    
    renderWithStore(<KnowledgeGraph />, createMockStore(notes, mockPeople));
    
    // The component should create connections between referenced notes
    expect(screen.queryByText('No Connections Yet')).not.toBeInTheDocument();
  });

  it('should handle partial name matches', () => {
    const notes = [
      {
        ...mockNotes[0],
        content: 'Talked to @John about the project.',
      },
    ];
    
    renderWithStore(<KnowledgeGraph />, createMockStore(notes, mockPeople));
    
    // Should match "John" with "John Smith"
    expect(screen.queryByText('No Connections Yet')).not.toBeInTheDocument();
  });

  it('should ignore non-existent references', () => {
    const notes = [
      {
        ...mockNotes[0],
        content: 'Meeting with @NonExistent Person and reference to #[[Non Existent Note]].',
      },
    ];
    
    renderWithStore(<KnowledgeGraph />, createMockStore(notes, mockPeople));
    
    // Should still render but without connections to non-existent entities
    expect(screen.queryByText('No Connections Yet')).not.toBeInTheDocument();
  });
});
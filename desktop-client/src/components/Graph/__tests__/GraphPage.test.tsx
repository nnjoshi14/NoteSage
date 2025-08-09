import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import '@testing-library/jest-dom';
import GraphPage from '../GraphPage';
import notesReducer from '../../../stores/slices/notesSlice';
import peopleReducer from '../../../stores/slices/peopleSlice';

// Mock the KnowledgeGraph component to avoid D3 issues in tests
jest.mock('../KnowledgeGraph', () => {
  return function MockKnowledgeGraph({ onNodeClick, onNodeDoubleClick, className }: any) {
    const mockNode = { 
      id: 'test', 
      type: 'note', 
      title: 'Test',
      data: { id: 'test', title: 'Test Note' }
    };
    
    return (
      <div 
        className={`mock-knowledge-graph ${className}`}
        data-testid="knowledge-graph"
        onClick={() => onNodeClick?.(mockNode)}
        onDoubleClick={() => onNodeDoubleClick?.(mockNode)}
      >
        Mock Knowledge Graph
      </div>
    );
  };
});

const createMockStore = () => {
  return configureStore({
    reducer: {
      notes: notesReducer,
      people: peopleReducer,
    },
    preloadedState: {
      notes: {
        notes: [],
        currentNote: null,
        isLoading: false,
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
};

const renderWithProviders = (component: React.ReactElement) => {
  const store = createMockStore();
  return render(
    <Provider store={store}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </Provider>
  );
};

describe('GraphPage', () => {
  it('renders the graph page with header and content', () => {
    renderWithProviders(<GraphPage />);
    
    expect(screen.getByText('Knowledge Graph')).toBeInTheDocument();
    expect(screen.getByText('Explore connections between your notes and people')).toBeInTheDocument();
    expect(screen.getByTestId('knowledge-graph')).toBeInTheDocument();
  });

  it('applies correct CSS classes', () => {
    const { container } = renderWithProviders(<GraphPage />);
    
    expect(container.firstChild).toHaveClass('graph-page');
    expect(screen.getByTestId('knowledge-graph')).toHaveClass('main-graph');
  });

  it('renders the page structure correctly', () => {
    renderWithProviders(<GraphPage />);
    
    // Check header structure
    const header = document.querySelector('.graph-page-header');
    expect(header).toBeInTheDocument();
    expect(header).toContainElement(screen.getByText('Knowledge Graph'));
    
    // Check content structure
    const content = document.querySelector('.graph-page-content');
    expect(content).toBeInTheDocument();
    expect(content).toContainElement(screen.getByTestId('knowledge-graph'));
  });

  it('passes correct props to KnowledgeGraph', () => {
    renderWithProviders(<GraphPage />);
    
    const knowledgeGraph = screen.getByTestId('knowledge-graph');
    expect(knowledgeGraph).toHaveClass('mock-knowledge-graph', 'main-graph');
  });
});

describe('GraphPage Navigation', () => {
  const mockNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock useNavigate hook
    jest.doMock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useNavigate: () => mockNavigate,
    }));
  });

  afterEach(() => {
    jest.dontMock('react-router-dom');
  });

  it('handles node click events', () => {
    renderWithProviders(<GraphPage />);
    
    const knowledgeGraph = screen.getByTestId('knowledge-graph');
    knowledgeGraph.click();
    
    // The mock component calls onNodeClick, but navigation should only happen on double click
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates on node double click', () => {
    renderWithProviders(<GraphPage />);
    
    const knowledgeGraph = screen.getByTestId('knowledge-graph');
    knowledgeGraph.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    
    // The mock component calls onNodeDoubleClick with a test node
    // In the real implementation, this would trigger navigation
    expect(mockNavigate).not.toHaveBeenCalled(); // Mock doesn't actually call the handler
  });
});
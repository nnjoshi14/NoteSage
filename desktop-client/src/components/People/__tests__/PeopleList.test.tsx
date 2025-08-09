import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import PeopleList from '../PeopleList';
import peopleReducer, { Person } from '../../../stores/slices/peopleSlice';

// Mock data
const mockPeople: Person[] = [
  {
    id: '1',
    name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '+1 (555) 123-4567',
    company: 'Tech Corp',
    title: 'Software Engineer',
    linkedin_url: 'https://linkedin.com/in/johnsmith',
    avatar_url: '',
    notes: 'Met at tech conference',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-20T14:30:00Z',
    sync_status: 'synced',
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@design.co',
    phone: '+1 (555) 987-6543',
    company: 'Design Co',
    title: 'UX Designer',
    linkedin_url: 'https://linkedin.com/in/sarahjohnson',
    avatar_url: '',
    notes: 'Great designer',
    created_at: '2024-01-10T09:15:00Z',
    updated_at: '2024-01-18T16:45:00Z',
    sync_status: 'synced',
  },
  {
    id: '3',
    name: 'Mike Wilson',
    email: 'mike.wilson@startup.io',
    company: 'Startup Inc',
    title: 'Product Manager',
    created_at: '2024-01-05T08:30:00Z',
    updated_at: '2024-01-12T11:20:00Z',
    sync_status: 'pending',
  },
];

const createMockStore = (people: Person[] = mockPeople) => {
  return configureStore({
    reducer: {
      people: peopleReducer,
    },
    preloadedState: {
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

describe('PeopleList', () => {
  const mockProps = {
    onPersonSelect: jest.fn(),
    onPersonCreate: jest.fn(),
    onPersonEdit: jest.fn(),
    onPersonDelete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders people list with correct data', () => {
    renderWithStore(<PeopleList {...mockProps} />);

    expect(screen.getByText('People')).toBeInTheDocument();
    expect(screen.getByText('(3)')).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
    expect(screen.getByText('Mike Wilson')).toBeInTheDocument();
  });

  it('displays person details correctly', () => {
    renderWithStore(<PeopleList {...mockProps} />);

    expect(screen.getByText('Tech Corp')).toBeInTheDocument();
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
    expect(screen.getByText('john.smith@example.com')).toBeInTheDocument();
    expect(screen.getByText('📞 +1 (555) 123-4567')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    const store = configureStore({
      reducer: { people: peopleReducer },
      preloadedState: {
        people: {
          people: [],
          currentPerson: null,
          isLoading: true,
          filters: {},
        },
      },
    });

    renderWithStore(<PeopleList {...mockProps} />, store);

    expect(screen.getByText('Loading people...')).toBeInTheDocument();
  });

  it('shows empty state when no people', () => {
    const store = createMockStore([]);
    renderWithStore(<PeopleList {...mockProps} />, store);

    expect(screen.getByText('No people found. Add your first contact to get started!')).toBeInTheDocument();
    expect(screen.getByText('Add Person')).toBeInTheDocument();
  });

  it('calls onPersonCreate when Add Person button is clicked', () => {
    renderWithStore(<PeopleList {...mockProps} />);

    fireEvent.click(screen.getByText('Add Person'));
    expect(mockProps.onPersonCreate).toHaveBeenCalledTimes(1);
  });

  it('calls onPersonSelect when person item is clicked', () => {
    renderWithStore(<PeopleList {...mockProps} />);

    fireEvent.click(screen.getByText('John Smith'));
    expect(mockProps.onPersonSelect).toHaveBeenCalledWith(mockPeople[0]);
  });

  it('calls onPersonEdit when edit button is clicked', () => {
    renderWithStore(<PeopleList {...mockProps} />);

    const editButtons = screen.getAllByTitle('Edit person');
    fireEvent.click(editButtons[0]);
    expect(mockProps.onPersonEdit).toHaveBeenCalledWith(mockPeople[0]);
  });

  it('calls onPersonDelete when delete button is clicked and confirmed', () => {
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => true);

    renderWithStore(<PeopleList {...mockProps} />);

    const deleteButtons = screen.getAllByTitle('Delete person');
    fireEvent.click(deleteButtons[0]);
    expect(mockProps.onPersonDelete).toHaveBeenCalledWith('1');

    window.confirm = originalConfirm;
  });

  it('does not call onPersonDelete when delete is cancelled', () => {
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => false);

    renderWithStore(<PeopleList {...mockProps} />);

    const deleteButtons = screen.getAllByTitle('Delete person');
    fireEvent.click(deleteButtons[0]);
    expect(mockProps.onPersonDelete).not.toHaveBeenCalled();

    window.confirm = originalConfirm;
  });

  it('filters people by search query', async () => {
    renderWithStore(<PeopleList {...mockProps} />);

    const searchInput = screen.getByPlaceholderText('Search people...');
    fireEvent.change(searchInput, { target: { value: 'John' } });

    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.queryByText('Sarah Johnson')).not.toBeInTheDocument();
      expect(screen.queryByText('Mike Wilson')).not.toBeInTheDocument();
    });
  });

  it('filters people by company', async () => {
    renderWithStore(<PeopleList {...mockProps} />);

    const companySelect = screen.getByDisplayValue('All Companies');
    fireEvent.change(companySelect, { target: { value: 'Tech Corp' } });

    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.queryByText('Sarah Johnson')).not.toBeInTheDocument();
      expect(screen.queryByText('Mike Wilson')).not.toBeInTheDocument();
    });
  });

  it('sorts people by name', async () => {
    renderWithStore(<PeopleList {...mockProps} />);

    const sortSelect = screen.getByDisplayValue('Name A-Z');
    fireEvent.change(sortSelect, { target: { value: 'name-desc' } });

    await waitFor(() => {
      const personItems = screen.getAllByRole('heading', { level: 3 });
      expect(personItems[0]).toHaveTextContent('Sarah Johnson');
      expect(personItems[1]).toHaveTextContent('Mike Wilson');
      expect(personItems[2]).toHaveTextContent('John Smith');
    });
  });

  it('changes view mode', () => {
    renderWithStore(<PeopleList {...mockProps} />);

    const gridViewButton = screen.getByTitle('Grid View');
    fireEvent.click(gridViewButton);

    const peopleListContent = document.querySelector('.people-list-content');
    expect(peopleListContent).toHaveClass('grid');
  });

  it('displays sync status correctly', () => {
    renderWithStore(<PeopleList {...mockProps} />);

    const syncedStatus = screen.getAllByText('✓');
    const pendingStatus = screen.getAllByText('⏳');
    
    expect(syncedStatus).toHaveLength(2); // John and Sarah are synced
    expect(pendingStatus).toHaveLength(1); // Mike is pending
  });

  it('shows clear filters button when filters are active', async () => {
    renderWithStore(<PeopleList {...mockProps} />);

    const searchInput = screen.getByPlaceholderText('Search people...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByText('Clear Filters')).toBeInTheDocument();
    });
  });

  it('clears filters when clear button is clicked', async () => {
    renderWithStore(<PeopleList {...mockProps} />);

    const searchInput = screen.getByPlaceholderText('Search people...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    await waitFor(() => {
      const clearButton = screen.getByText('Clear Filters');
      fireEvent.click(clearButton);
    });

    expect(searchInput).toHaveValue('');
  });

  it('displays avatar initials when no avatar URL', () => {
    renderWithStore(<PeopleList {...mockProps} />);

    expect(screen.getByText('JS')).toBeInTheDocument(); // John Smith
    expect(screen.getByText('SJ')).toBeInTheDocument(); // Sarah Johnson
    expect(screen.getByText('MW')).toBeInTheDocument(); // Mike Wilson
  });

  it('displays LinkedIn link correctly', () => {
    renderWithStore(<PeopleList {...mockProps} />);

    const linkedinLinks = screen.getAllByText('LinkedIn');
    expect(linkedinLinks).toHaveLength(2); // John and Sarah have LinkedIn
    
    linkedinLinks.forEach(link => {
      expect(link.closest('a')).toHaveAttribute('target', '_blank');
      expect(link.closest('a')).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
});
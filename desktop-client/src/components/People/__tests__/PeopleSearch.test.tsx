import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import PeopleSearch from '../PeopleSearch';
import peopleReducer, { Person } from '../../../stores/slices/peopleSlice';

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
    company: 'Design Co',
    title: 'UX Designer',
    created_at: '2024-01-10T09:15:00Z',
    updated_at: '2024-01-18T16:45:00Z',
    sync_status: 'synced',
  },
  {
    id: '3',
    name: 'Mike Wilson',
    phone: '+1 (555) 987-6543',
    company: 'Startup Inc',
    title: 'Product Manager',
    linkedin_url: 'https://linkedin.com/in/mikewilson',
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

describe('PeopleSearch', () => {
  const mockProps = {
    onSearchResults: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders search form correctly', () => {
    renderWithStore(<PeopleSearch {...mockProps} />);

    expect(screen.getByText('Advanced People Search')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search by name, email, company, title, or notes...')).toBeInTheDocument();
    expect(screen.getByText('Companies')).toBeInTheDocument();
    expect(screen.getByText('Contact Information')).toBeInTheDocument();
    expect(screen.getByText('Date Added')).toBeInTheDocument();
    expect(screen.getByText('Sort Results')).toBeInTheDocument();
  });

  it('displays available companies as filter chips', () => {
    renderWithStore(<PeopleSearch {...mockProps} />);

    expect(screen.getByText('Tech Corp')).toBeInTheDocument();
    expect(screen.getByText('Design Co')).toBeInTheDocument();
    expect(screen.getByText('Startup Inc')).toBeInTheDocument();
  });

  it('searches by text query', async () => {
    renderWithStore(<PeopleSearch {...mockProps} />);

    const searchInput = screen.getByPlaceholderText('Search by name, email, company, title, or notes...');
    fireEvent.change(searchInput, { target: { value: 'John' } });

    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.queryByText('Sarah Johnson')).not.toBeInTheDocument();
      expect(screen.queryByText('Mike Wilson')).not.toBeInTheDocument();
    });

    expect(mockProps.onSearchResults).toHaveBeenCalledWith([mockPeople[0]]);
  });

  it('filters by company', async () => {
    renderWithStore(<PeopleSearch {...mockProps} />);

    const techCorpChip = screen.getByText('Tech Corp');
    fireEvent.click(techCorpChip);

    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.queryByText('Sarah Johnson')).not.toBeInTheDocument();
      expect(screen.queryByText('Mike Wilson')).not.toBeInTheDocument();
    });

    expect(mockProps.onSearchResults).toHaveBeenCalledWith([mockPeople[0]]);
  });

  it('filters by contact information', async () => {
    renderWithStore(<PeopleSearch {...mockProps} />);

    const hasEmailSelect = screen.getAllByDisplayValue('Any')[0]; // First "Any" is for email
    fireEvent.change(hasEmailSelect, { target: { value: 'true' } });

    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      expect(screen.queryByText('Mike Wilson')).not.toBeInTheDocument(); // Mike has no email
    });

    expect(mockProps.onSearchResults).toHaveBeenCalledWith([mockPeople[0], mockPeople[1]]);
  });

  it('filters by phone availability', async () => {
    renderWithStore(<PeopleSearch {...mockProps} />);

    const hasPhoneSelect = screen.getAllByDisplayValue('Any')[1]; // Second "Any" is for phone
    fireEvent.change(hasPhoneSelect, { target: { value: 'true' } });

    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.queryByText('Sarah Johnson')).not.toBeInTheDocument(); // Sarah has no phone
      expect(screen.getByText('Mike Wilson')).toBeInTheDocument();
    });

    expect(mockProps.onSearchResults).toHaveBeenCalledWith([mockPeople[0], mockPeople[2]]);
  });

  it('filters by LinkedIn availability', async () => {
    renderWithStore(<PeopleSearch {...mockProps} />);

    const hasLinkedInSelect = screen.getAllByDisplayValue('Any')[2]; // Third "Any" is for LinkedIn
    fireEvent.change(hasLinkedInSelect, { target: { value: 'true' } });

    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.queryByText('Sarah Johnson')).not.toBeInTheDocument(); // Sarah has no LinkedIn
      expect(screen.getByText('Mike Wilson')).toBeInTheDocument();
    });

    expect(mockProps.onSearchResults).toHaveBeenCalledWith([mockPeople[0], mockPeople[2]]);
  });

  it('filters by date range', async () => {
    renderWithStore(<PeopleSearch {...mockProps} />);

    const startDateInput = screen.getAllByType('date')[0];
    const endDateInput = screen.getAllByType('date')[1];

    fireEvent.change(startDateInput, { target: { value: '2024-01-12' } });
    fireEvent.change(endDateInput, { target: { value: '2024-01-16' } });

    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeInTheDocument(); // Created on 2024-01-15
      expect(screen.queryByText('Sarah Johnson')).not.toBeInTheDocument(); // Created on 2024-01-10
      expect(screen.queryByText('Mike Wilson')).not.toBeInTheDocument(); // Created on 2024-01-05
    });

    expect(mockProps.onSearchResults).toHaveBeenCalledWith([mockPeople[0]]);
  });

  it('sorts results correctly', async () => {
    renderWithStore(<PeopleSearch {...mockProps} />);

    const sortBySelect = screen.getByDisplayValue('Name');
    fireEvent.change(sortBySelect, { target: { value: 'company' } });

    const sortOrderSelect = screen.getByDisplayValue('Ascending');
    fireEvent.change(sortOrderSelect, { target: { value: 'desc' } });

    await waitFor(() => {
      const resultItems = screen.getAllByRole('heading', { level: 5 });
      expect(resultItems[0]).toHaveTextContent('Mike Wilson'); // Startup Inc
      expect(resultItems[1]).toHaveTextContent('John Smith'); // Tech Corp
      expect(resultItems[2]).toHaveTextContent('Sarah Johnson'); // Design Co
    });
  });

  it('combines multiple filters', async () => {
    renderWithStore(<PeopleSearch {...mockProps} />);

    const searchInput = screen.getByPlaceholderText('Search by name, email, company, title, or notes...');
    fireEvent.change(searchInput, { target: { value: 'Tech' } });

    const hasEmailSelect = screen.getAllByDisplayValue('Any')[0];
    fireEvent.change(hasEmailSelect, { target: { value: 'true' } });

    await waitFor(() => {
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.queryByText('Sarah Johnson')).not.toBeInTheDocument();
      expect(screen.queryByText('Mike Wilson')).not.toBeInTheDocument();
    });

    expect(mockProps.onSearchResults).toHaveBeenCalledWith([mockPeople[0]]);
  });

  it('shows clear filters button when filters are active', async () => {
    renderWithStore(<PeopleSearch {...mockProps} />);

    const searchInput = screen.getByPlaceholderText('Search by name, email, company, title, or notes...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByText('Clear Filters')).toBeInTheDocument();
    });
  });

  it('clears all filters when clear button is clicked', async () => {
    renderWithStore(<PeopleSearch {...mockProps} />);

    const searchInput = screen.getByPlaceholderText('Search by name, email, company, title, or notes...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    const techCorpChip = screen.getByText('Tech Corp');
    fireEvent.click(techCorpChip);

    await waitFor(() => {
      const clearButton = screen.getByText('Clear Filters');
      fireEvent.click(clearButton);
    });

    expect(searchInput).toHaveValue('');
    expect(techCorpChip).not.toHaveClass('active');
  });

  it('displays search results with correct information', async () => {
    renderWithStore(<PeopleSearch {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Search Results (3)')).toBeInTheDocument();
    });

    // Check person details are displayed
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
    expect(screen.getByText('Tech Corp')).toBeInTheDocument();
    expect(screen.getByText('📧 john.smith@example.com')).toBeInTheDocument();
    expect(screen.getByText('📞 +1 (555) 123-4567')).toBeInTheDocument();
    expect(screen.getByText('💼 LinkedIn')).toBeInTheDocument();
  });

  it('displays avatar initials when no avatar URL', () => {
    renderWithStore(<PeopleSearch {...mockProps} />);

    expect(screen.getByText('JS')).toBeInTheDocument(); // John Smith
    expect(screen.getByText('SJ')).toBeInTheDocument(); // Sarah Johnson
    expect(screen.getByText('MW')).toBeInTheDocument(); // Mike Wilson
  });

  it('truncates long notes', async () => {
    const longNotesPerson = {
      ...mockPeople[0],
      notes: 'This is a very long note that should be truncated when displayed in the search results because it exceeds the maximum length limit.',
    };

    const store = createMockStore([longNotesPerson]);
    renderWithStore(<PeopleSearch {...mockProps} />, store);

    await waitFor(() => {
      expect(screen.getByText(/This is a very long note that should be truncated when displayed in the search results.../)).toBeInTheDocument();
    });
  });

  it('shows empty state when no results', async () => {
    renderWithStore(<PeopleSearch {...mockProps} />);

    const searchInput = screen.getByPlaceholderText('Search by name, email, company, title, or notes...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    await waitFor(() => {
      expect(screen.getByText('No people match your search criteria.')).toBeInTheDocument();
    });
  });

  it('shows initial empty state', () => {
    const store = createMockStore([]);
    renderWithStore(<PeopleSearch {...mockProps} />, store);

    expect(screen.getByText('Enter search terms or apply filters to find people.')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    renderWithStore(<PeopleSearch {...mockProps} />);

    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    expect(mockProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Close button is clicked', () => {
    renderWithStore(<PeopleSearch {...mockProps} />);

    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);

    expect(mockProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('handles company chip toggle correctly', async () => {
    renderWithStore(<PeopleSearch {...mockProps} />);

    const techCorpChip = screen.getByText('Tech Corp');
    
    // Click to activate
    fireEvent.click(techCorpChip);
    expect(techCorpChip).toHaveClass('active');

    // Click again to deactivate
    fireEvent.click(techCorpChip);
    expect(techCorpChip).not.toHaveClass('active');

    await waitFor(() => {
      expect(mockProps.onSearchResults).toHaveBeenCalledWith(mockPeople);
    });
  });

  it('shows no companies message when no companies exist', () => {
    const store = createMockStore([
      { ...mockPeople[0], company: undefined },
      { ...mockPeople[1], company: undefined },
    ]);
    
    renderWithStore(<PeopleSearch {...mockProps} />, store);

    expect(screen.getByText('No companies found')).toBeInTheDocument();
  });
});
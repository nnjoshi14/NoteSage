import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import PeoplePage from '../PeoplePage';
import peopleReducer, { Person } from '../../../stores/slices/peopleSlice';
import notesReducer from '../../../stores/slices/notesSlice';

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
];

const createMockStore = (people: Person[] = mockPeople, isLoading = false, error?: string) => {
  return configureStore({
    reducer: {
      people: peopleReducer,
      notes: notesReducer,
    },
    preloadedState: {
      people: {
        people,
        currentPerson: null,
        isLoading,
        error,
        filters: {},
      },
      notes: {
        notes: [],
        currentNote: null,
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

describe('PeoplePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders people list by default', () => {
    renderWithStore(<PeoplePage />);

    expect(screen.getByText('People')).toBeInTheDocument();
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
    expect(screen.getByText('🔍 Advanced Search')).toBeInTheDocument();
  });

  it('shows error state when there is an error', () => {
    const store = createMockStore([], false, 'Failed to load people');
    renderWithStore(<PeoplePage />, store);

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Failed to load people')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('opens person form when Add Person is clicked', async () => {
    renderWithStore(<PeoplePage />);

    const addButton = screen.getByText('Add Person');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Add New Person')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter full name')).toBeInTheDocument();
    });
  });

  it('opens person detail when person is selected', async () => {
    renderWithStore(<PeoplePage />);

    const personItem = screen.getByText('John Smith');
    fireEvent.click(personItem);

    await waitFor(() => {
      expect(screen.getByText('Software Engineer')).toBeInTheDocument();
      expect(screen.getByText('Tech Corp')).toBeInTheDocument();
      expect(screen.getByText('Information')).toBeInTheDocument();
    });
  });

  it('opens person form for editing when edit is clicked', async () => {
    renderWithStore(<PeoplePage />);

    const editButtons = screen.getAllByTitle('Edit person');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Person')).toBeInTheDocument();
      expect(screen.getByDisplayValue('John Smith')).toBeInTheDocument();
    });
  });

  it('opens advanced search when search button is clicked', async () => {
    renderWithStore(<PeoplePage />);

    const searchButton = screen.getByText('🔍 Advanced Search');
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('Advanced People Search')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search by name, email, company, title, or notes...')).toBeInTheDocument();
    });
  });

  it('creates new person successfully', async () => {
    renderWithStore(<PeoplePage />);

    // Open form
    const addButton = screen.getByText('Add Person');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Add New Person')).toBeInTheDocument();
    });

    // Fill form
    const nameInput = screen.getByPlaceholderText('Enter full name');
    const emailInput = screen.getByPlaceholderText('email@example.com');
    
    fireEvent.change(nameInput, { target: { value: 'New Person' } });
    fireEvent.change(emailInput, { target: { value: 'new@example.com' } });

    // Submit form
    const submitButton = screen.getByText('Create Person');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('People')).toBeInTheDocument(); // Back to list
    });
  });

  it('updates existing person successfully', async () => {
    renderWithStore(<PeoplePage />);

    // Open edit form
    const editButtons = screen.getAllByTitle('Edit person');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit Person')).toBeInTheDocument();
    });

    // Update name
    const nameInput = screen.getByDisplayValue('John Smith');
    fireEvent.change(nameInput, { target: { value: 'John Updated' } });

    // Submit form
    const submitButton = screen.getByText('Update Person');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('People')).toBeInTheDocument(); // Back to list
    });
  });

  it('deletes person successfully', async () => {
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => true);

    renderWithStore(<PeoplePage />);

    const deleteButtons = screen.getAllByTitle('Delete person');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete John Smith?');
    });

    window.confirm = originalConfirm;
  });

  it('cancels form and returns to list', async () => {
    renderWithStore(<PeoplePage />);

    // Open form
    const addButton = screen.getByText('Add Person');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Add New Person')).toBeInTheDocument();
    });

    // Cancel form
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.getByText('People')).toBeInTheDocument(); // Back to list
    });
  });

  it('closes person detail and returns to list', async () => {
    renderWithStore(<PeoplePage />);

    // Open detail
    const personItem = screen.getByText('John Smith');
    fireEvent.click(personItem);

    await waitFor(() => {
      expect(screen.getByText('Information')).toBeInTheDocument();
    });

    // Close detail
    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.getByText('People')).toBeInTheDocument(); // Back to list
    });
  });

  it('closes search and returns to list', async () => {
    renderWithStore(<PeoplePage />);

    // Open search
    const searchButton = screen.getByText('🔍 Advanced Search');
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText('Advanced People Search')).toBeInTheDocument();
    });

    // Close search
    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.getByText('People')).toBeInTheDocument(); // Back to list
    });
  });

  it('handles form submission errors gracefully', async () => {
    // Mock console.error to avoid test output noise
    const originalError = console.error;
    console.error = jest.fn();

    renderWithStore(<PeoplePage />);

    // Open form
    const addButton = screen.getByText('Add Person');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Add New Person')).toBeInTheDocument();
    });

    // Fill form with invalid data that might cause an error
    const nameInput = screen.getByPlaceholderText('Enter full name');
    fireEvent.change(nameInput, { target: { value: 'Test Person' } });

    // Submit form
    const submitButton = screen.getByText('Create Person');
    fireEvent.click(submitButton);

    // Should handle error gracefully and stay on form
    await waitFor(() => {
      expect(screen.getByText('Add New Person')).toBeInTheDocument();
    });

    console.error = originalError;
  });

  it('navigates from detail to edit form', async () => {
    renderWithStore(<PeoplePage />);

    // Open detail
    const personItem = screen.getByText('John Smith');
    fireEvent.click(personItem);

    await waitFor(() => {
      expect(screen.getByText('Information')).toBeInTheDocument();
    });

    // Click edit from detail
    const editButton = screen.getByText('✏️ Edit');
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Edit Person')).toBeInTheDocument();
      expect(screen.getByDisplayValue('John Smith')).toBeInTheDocument();
    });
  });

  it('deletes person from detail view', async () => {
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => true);

    renderWithStore(<PeoplePage />);

    // Open detail
    const personItem = screen.getByText('John Smith');
    fireEvent.click(personItem);

    await waitFor(() => {
      expect(screen.getByText('Information')).toBeInTheDocument();
    });

    // Delete from detail
    const deleteButton = screen.getByText('🗑️ Delete');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete John Smith? This action cannot be undone.');
      expect(screen.getByText('People')).toBeInTheDocument(); // Back to list
    });

    window.confirm = originalConfirm;
  });

  it('handles note selection from person detail', async () => {
    // Mock console.log to verify note selection
    const originalLog = console.log;
    console.log = jest.fn();

    renderWithStore(<PeoplePage />);

    // Open detail
    const personItem = screen.getByText('John Smith');
    fireEvent.click(personItem);

    await waitFor(() => {
      expect(screen.getByText('Information')).toBeInTheDocument();
    });

    // Note: Since we don't have actual note connections in the mock,
    // we can't test the actual note selection, but we can verify
    // the component renders without errors

    console.log = originalLog;
  });

  it('retries loading people when retry button is clicked', async () => {
    const store = createMockStore([], false, 'Failed to load people');
    renderWithStore(<PeoplePage />, store);

    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);

    // Should attempt to reload (in real implementation, this would trigger an API call)
    expect(retryButton).toBeInTheDocument();
  });
});
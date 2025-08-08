import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PersonForm from '../PersonForm';
import { Person } from '../../../stores/slices/peopleSlice';

const mockPerson: Person = {
  id: '1',
  name: 'John Smith',
  email: 'john.smith@example.com',
  phone: '+1 (555) 123-4567',
  company: 'Tech Corp',
  title: 'Software Engineer',
  linkedin_url: 'https://linkedin.com/in/johnsmith',
  avatar_url: 'https://example.com/avatar.jpg',
  notes: 'Met at tech conference',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-20T14:30:00Z',
  sync_status: 'synced',
};

describe('PersonForm', () => {
  const mockProps = {
    onSave: jest.fn(),
    onCancel: jest.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders create form correctly', () => {
    render(<PersonForm {...mockProps} />);

    expect(screen.getByText('Add New Person')).toBeInTheDocument();
    expect(screen.getByText('Create Person')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter full name')).toBeInTheDocument();
  });

  it('renders edit form correctly', () => {
    render(<PersonForm {...mockProps} person={mockPerson} />);

    expect(screen.getByText('Edit Person')).toBeInTheDocument();
    expect(screen.getByText('Update Person')).toBeInTheDocument();
    expect(screen.getByDisplayValue('John Smith')).toBeInTheDocument();
  });

  it('populates form fields when editing', () => {
    render(<PersonForm {...mockProps} person={mockPerson} />);

    expect(screen.getByDisplayValue('John Smith')).toBeInTheDocument();
    expect(screen.getByDisplayValue('john.smith@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+1 (555) 123-4567')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Tech Corp')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Software Engineer')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://linkedin.com/in/johnsmith')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://example.com/avatar.jpg')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Met at tech conference')).toBeInTheDocument();
  });

  it('shows validation error for empty name', async () => {
    render(<PersonForm {...mockProps} />);

    const submitButton = screen.getByText('Create Person');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });

    expect(mockProps.onSave).not.toHaveBeenCalled();
  });

  it('shows validation error for invalid email', async () => {
    render(<PersonForm {...mockProps} />);

    const nameInput = screen.getByPlaceholderText('Enter full name');
    const emailInput = screen.getByPlaceholderText('email@example.com');
    
    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

    const submitButton = screen.getByText('Create Person');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });

    expect(mockProps.onSave).not.toHaveBeenCalled();
  });

  it('shows validation error for invalid phone', async () => {
    render(<PersonForm {...mockProps} />);

    const nameInput = screen.getByPlaceholderText('Enter full name');
    const phoneInput = screen.getByPlaceholderText('+1 (555) 123-4567');
    
    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(phoneInput, { target: { value: 'invalid-phone' } });

    const submitButton = screen.getByText('Create Person');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid phone number')).toBeInTheDocument();
    });

    expect(mockProps.onSave).not.toHaveBeenCalled();
  });

  it('shows validation error for invalid LinkedIn URL', async () => {
    render(<PersonForm {...mockProps} />);

    const nameInput = screen.getByPlaceholderText('Enter full name');
    const linkedinInput = screen.getByPlaceholderText('https://linkedin.com/in/username');
    
    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(linkedinInput, { target: { value: 'invalid-url' } });

    const submitButton = screen.getByText('Create Person');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid LinkedIn URL')).toBeInTheDocument();
    });

    expect(mockProps.onSave).not.toHaveBeenCalled();
  });

  it('shows validation error for invalid avatar URL', async () => {
    render(<PersonForm {...mockProps} />);

    const nameInput = screen.getByPlaceholderText('Enter full name');
    const avatarInput = screen.getByPlaceholderText('https://example.com/avatar.jpg');
    
    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(avatarInput, { target: { value: 'invalid-url' } });

    const submitButton = screen.getByText('Create Person');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid URL')).toBeInTheDocument();
    });

    expect(mockProps.onSave).not.toHaveBeenCalled();
  });

  it('submits form with valid data', async () => {
    render(<PersonForm {...mockProps} />);

    const nameInput = screen.getByPlaceholderText('Enter full name');
    const emailInput = screen.getByPlaceholderText('email@example.com');
    const phoneInput = screen.getByPlaceholderText('+1 (555) 123-4567');
    const companyInput = screen.getByPlaceholderText('Company name');
    const titleInput = screen.getByPlaceholderText('Job title');
    
    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(phoneInput, { target: { value: '+1 555 123 4567' } });
    fireEvent.change(companyInput, { target: { value: 'Test Company' } });
    fireEvent.change(titleInput, { target: { value: 'Test Title' } });

    const submitButton = screen.getByText('Create Person');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockProps.onSave).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        phone: '+1 555 123 4567',
        company: 'Test Company',
        title: 'Test Title',
      });
    });
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<PersonForm {...mockProps} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when close button is clicked', () => {
    render(<PersonForm {...mockProps} />);

    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    expect(mockProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows confirmation dialog when cancelling with unsaved changes', () => {
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => false);

    render(<PersonForm {...mockProps} />);

    const nameInput = screen.getByPlaceholderText('Enter full name');
    fireEvent.change(nameInput, { target: { value: 'Test' } });

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(window.confirm).toHaveBeenCalledWith('You have unsaved changes. Are you sure you want to cancel?');
    expect(mockProps.onCancel).not.toHaveBeenCalled();

    window.confirm = originalConfirm;
  });

  it('displays loading state correctly', () => {
    render(<PersonForm {...mockProps} isLoading={true} />);

    expect(screen.getByText('Creating...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
  });

  it('displays avatar initials correctly', () => {
    render(<PersonForm {...mockProps} />);

    const nameInput = screen.getByPlaceholderText('Enter full name');
    fireEvent.change(nameInput, { target: { value: 'John Smith' } });

    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('clears validation errors when user starts typing', async () => {
    render(<PersonForm {...mockProps} />);

    const submitButton = screen.getByText('Create Person');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText('Enter full name');
    fireEvent.change(nameInput, { target: { value: 'Test' } });

    await waitFor(() => {
      expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
    });
  });

  it('trims whitespace from form fields', async () => {
    render(<PersonForm {...mockProps} />);

    const nameInput = screen.getByPlaceholderText('Enter full name');
    const emailInput = screen.getByPlaceholderText('email@example.com');
    
    fireEvent.change(nameInput, { target: { value: '  Test User  ' } });
    fireEvent.change(emailInput, { target: { value: '  test@example.com  ' } });

    const submitButton = screen.getByText('Create Person');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockProps.onSave).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
      });
    });
  });

  it('excludes empty fields from saved data', async () => {
    render(<PersonForm {...mockProps} />);

    const nameInput = screen.getByPlaceholderText('Enter full name');
    const emailInput = screen.getByPlaceholderText('email@example.com');
    const phoneInput = screen.getByPlaceholderText('+1 (555) 123-4567');
    
    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(phoneInput, { target: { value: '' } }); // Empty field

    const submitButton = screen.getByText('Create Person');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockProps.onSave).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        // phone should not be included
      });
    });
  });
});
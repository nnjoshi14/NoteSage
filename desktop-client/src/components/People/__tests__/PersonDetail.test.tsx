import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PersonDetail from '../PersonDetail';
import { Person } from '../../../stores/slices/peopleSlice';
import { Note } from '../../../stores/slices/notesSlice';

const mockPerson: Person = {
  id: '1',
  name: 'John Smith',
  email: 'john.smith@example.com',
  phone: '+1 (555) 123-4567',
  company: 'Tech Corp',
  title: 'Software Engineer',
  linkedin_url: 'https://linkedin.com/in/johnsmith',
  avatar_url: 'https://example.com/avatar.jpg',
  notes: 'Met at tech conference. Very knowledgeable about React.',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-20T14:30:00Z',
  sync_status: 'synced',
};

const mockNote: Note = {
  id: 'note1',
  title: 'Meeting with John',
  content: 'Discussed React best practices with John Smith',
  category: 'Meeting',
  tags: ['react', 'development'],
  folder_path: '/',
  is_archived: false,
  is_pinned: false,
  is_favorite: false,
  created_at: '2024-01-16T09:00:00Z',
  updated_at: '2024-01-16T10:30:00Z',
  sync_status: 'synced',
};

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

describe('PersonDetail', () => {
  const mockProps = {
    person: mockPerson,
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onClose: jest.fn(),
    onNoteSelect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders person information correctly', () => {
    render(<PersonDetail {...mockProps} />);

    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
    expect(screen.getByText('Tech Corp')).toBeInTheDocument();
    expect(screen.getByText('john.smith@example.com')).toBeInTheDocument();
    expect(screen.getByText('+1 (555) 123-4567')).toBeInTheDocument();
    expect(screen.getByText('View Profile')).toBeInTheDocument();
    expect(screen.getByText('Met at tech conference. Very knowledgeable about React.')).toBeInTheDocument();
  });

  it('displays avatar or initials correctly', () => {
    render(<PersonDetail {...mockProps} />);

    const avatar = screen.getByAltText('John Smith');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('displays initials when no avatar URL', () => {
    const personWithoutAvatar = { ...mockPerson, avatar_url: '' };
    render(<PersonDetail {...mockProps} person={personWithoutAvatar} />);

    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', () => {
    render(<PersonDetail {...mockProps} />);

    const editButton = screen.getByText('✏️ Edit');
    fireEvent.click(editButton);

    expect(mockProps.onEdit).toHaveBeenCalledWith(mockPerson);
  });

  it('calls onDelete when delete button is clicked and confirmed', () => {
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => true);

    render(<PersonDetail {...mockProps} />);

    const deleteButton = screen.getByText('🗑️ Delete');
    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete John Smith? This action cannot be undone.');
    expect(mockProps.onDelete).toHaveBeenCalledWith('1');

    window.confirm = originalConfirm;
  });

  it('does not call onDelete when delete is cancelled', () => {
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = jest.fn(() => false);

    render(<PersonDetail {...mockProps} />);

    const deleteButton = screen.getByText('🗑️ Delete');
    fireEvent.click(deleteButton);

    expect(mockProps.onDelete).not.toHaveBeenCalled();

    window.confirm = originalConfirm;
  });

  it('calls onClose when close button is clicked', () => {
    render(<PersonDetail {...mockProps} />);

    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    expect(mockProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('switches between tabs correctly', () => {
    render(<PersonDetail {...mockProps} />);

    // Initially on Information tab
    expect(screen.getByText('Contact Information')).toBeInTheDocument();

    // Switch to Connections tab
    const connectionsTab = screen.getByText(/Connections \(0\)/);
    fireEvent.click(connectionsTab);

    expect(screen.getByText('No connections found.')).toBeInTheDocument();

    // Switch to Activity tab
    const activityTab = screen.getByText('Activity');
    fireEvent.click(activityTab);

    expect(screen.getByText('Activity tracking coming soon!')).toBeInTheDocument();
  });

  it('copies contact information to clipboard', async () => {
    render(<PersonDetail {...mockProps} />);

    const copyButtons = screen.getAllByText('📋');
    fireEvent.click(copyButtons[0]); // Copy email

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('john.smith@example.com');
  });

  it('displays sync status correctly', () => {
    render(<PersonDetail {...mockProps} />);

    expect(screen.getByText('✓ Synced')).toBeInTheDocument();
  });

  it('displays pending sync status', () => {
    const pendingPerson = { ...mockPerson, sync_status: 'pending' as const };
    render(<PersonDetail {...mockProps} person={pendingPerson} />);

    expect(screen.getByText('⏳ Pending')).toBeInTheDocument();
  });

  it('displays conflict sync status', () => {
    const conflictPerson = { ...mockPerson, sync_status: 'conflict' as const };
    render(<PersonDetail {...mockProps} person={conflictPerson} />);

    expect(screen.getByText('⚠️ Conflict')).toBeInTheDocument();
  });

  it('formats dates correctly', () => {
    render(<PersonDetail {...mockProps} />);

    expect(screen.getByText('January 15, 2024')).toBeInTheDocument(); // Created date
    expect(screen.getByText('January 20, 2024')).toBeInTheDocument(); // Updated date
  });

  it('opens LinkedIn profile in new tab', () => {
    render(<PersonDetail {...mockProps} />);

    const linkedinLink = screen.getByText('View Profile');
    expect(linkedinLink.closest('a')).toHaveAttribute('href', 'https://linkedin.com/in/johnsmith');
    expect(linkedinLink.closest('a')).toHaveAttribute('target', '_blank');
    expect(linkedinLink.closest('a')).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('opens email client when email is clicked', () => {
    render(<PersonDetail {...mockProps} />);

    const emailLink = screen.getByText('john.smith@example.com');
    expect(emailLink.closest('a')).toHaveAttribute('href', 'mailto:john.smith@example.com');
  });

  it('opens phone dialer when phone is clicked', () => {
    render(<PersonDetail {...mockProps} />);

    const phoneLink = screen.getByText('+1 (555) 123-4567');
    expect(phoneLink.closest('a')).toHaveAttribute('href', 'tel:+1 (555) 123-4567');
  });

  it('hides optional fields when not provided', () => {
    const minimalPerson: Person = {
      id: '2',
      name: 'Jane Doe',
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-20T14:30:00Z',
    };

    render(<PersonDetail {...mockProps} person={minimalPerson} />);

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.queryByText('Contact Information')).not.toBeInTheDocument();
    expect(screen.queryByText('Professional Information')).not.toBeInTheDocument();
    expect(screen.queryByText('Notes')).not.toBeInTheDocument();
  });

  it('shows professional information section when company or title is provided', () => {
    const personWithCompany = { ...mockPerson, title: undefined };
    render(<PersonDetail {...mockProps} person={personWithCompany} />);

    expect(screen.getByText('Professional Information')).toBeInTheDocument();
    expect(screen.getByText('Tech Corp')).toBeInTheDocument();
  });

  it('shows notes section when notes are provided', () => {
    render(<PersonDetail {...mockProps} />);

    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Met at tech conference. Very knowledgeable about React.')).toBeInTheDocument();
  });

  it('displays loading state for connections', () => {
    render(<PersonDetail {...mockProps} />);

    const connectionsTab = screen.getByText(/Connections \(0\)/);
    fireEvent.click(connectionsTab);

    // Initially shows loading
    expect(screen.getByText('Loading connections...')).toBeInTheDocument();
  });

  it('handles avatar image load error', () => {
    render(<PersonDetail {...mockProps} />);

    const avatar = screen.getByAltText('John Smith');
    fireEvent.error(avatar);

    // Should show initials when image fails to load
    expect(screen.getByText('JS')).toBeInTheDocument();
  });
});
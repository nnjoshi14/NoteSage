import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NoteTemplates from '../NoteTemplates';

// Mock electron API
const mockElectronAPI = {
  getCachedNotes: jest.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

const mockCustomTemplates = [
  {
    id: 'custom-1',
    title: 'Custom Template',
    content: 'This is a custom template with {{variable1}} and {{variable2}}',
    category: 'Template',
    tags: ['template'],
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-01T10:00:00Z',
  },
];

const mockProps = {
  onTemplateSelect: jest.fn(),
  onClose: jest.fn(),
};

describe('NoteTemplates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockElectronAPI.getCachedNotes.mockResolvedValue(mockCustomTemplates);
  });

  it('renders templates modal with built-in templates', async () => {
    render(<NoteTemplates {...mockProps} />);
    
    expect(screen.getByText('Note Templates')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      expect(screen.getByText('Project Planning')).toBeInTheDocument();
      expect(screen.getByText('Research Notes')).toBeInTheDocument();
      expect(screen.getByText('Daily Journal')).toBeInTheDocument();
    });
  });

  it('loads and displays custom templates', async () => {
    render(<NoteTemplates {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Custom Template')).toBeInTheDocument();
    });
    
    expect(mockElectronAPI.getCachedNotes).toHaveBeenCalled();
  });

  it('filters templates by search query', async () => {
    render(<NoteTemplates {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText('Search templates...');
    fireEvent.change(searchInput, { target: { value: 'meeting' } });
    
    expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
    expect(screen.queryByText('Project Planning')).not.toBeInTheDocument();
  });

  it('filters templates by category', async () => {
    render(<NoteTemplates {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
    });
    
    const categorySelect = screen.getByDisplayValue('All Categories');
    fireEvent.change(categorySelect, { target: { value: 'Meeting' } });
    
    expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
    expect(screen.queryByText('Project Planning')).not.toBeInTheDocument();
  });

  it('shows template preview when template is selected', async () => {
    render(<NoteTemplates {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
    });
    
    const meetingTemplate = screen.getByText('Meeting Notes');
    fireEvent.click(meetingTemplate);
    
    expect(screen.getByText('Template Preview:')).toBeInTheDocument();
    expect(screen.getByText('Fill in template variables:')).toBeInTheDocument();
    expect(screen.getByText('← Back to Templates')).toBeInTheDocument();
  });

  it('shows variable input fields for selected template', async () => {
    render(<NoteTemplates {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
    });
    
    const meetingTemplate = screen.getByText('Meeting Notes');
    fireEvent.click(meetingTemplate);
    
    // Meeting template should have variables like meeting_title, date, etc.
    expect(screen.getByText('Meeting Title')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Attendees')).toBeInTheDocument();
  });

  it('pre-fills date and time variables with current values', async () => {
    render(<NoteTemplates {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
    });
    
    const meetingTemplate = screen.getByText('Meeting Notes');
    fireEvent.click(meetingTemplate);
    
    const dateInput = screen.getByDisplayValue(new Date().toLocaleDateString());
    const timeInput = screen.getByDisplayValue(new Date().toLocaleTimeString());
    
    expect(dateInput).toBeInTheDocument();
    expect(timeInput).toBeInTheDocument();
  });

  it('allows editing variable values', async () => {
    render(<NoteTemplates {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
    });
    
    const meetingTemplate = screen.getByText('Meeting Notes');
    fireEvent.click(meetingTemplate);
    
    const titleInput = screen.getByPlaceholderText('Enter meeting title');
    fireEvent.change(titleInput, { target: { value: 'Weekly Standup' } });
    
    expect(titleInput).toHaveValue('Weekly Standup');
  });

  it('calls onTemplateSelect when Use Template button is clicked', async () => {
    render(<NoteTemplates {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
    });
    
    const meetingTemplate = screen.getByText('Meeting Notes');
    fireEvent.click(meetingTemplate);
    
    const useTemplateButton = screen.getByText('Use Template');
    fireEvent.click(useTemplateButton);
    
    expect(mockProps.onTemplateSelect).toHaveBeenCalled();
    
    const [template, variables] = mockProps.onTemplateSelect.mock.calls[0];
    expect(template.name).toBe('Meeting Notes');
    expect(variables).toBeDefined();
  });

  it('goes back to template list when back button is clicked', async () => {
    render(<NoteTemplates {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
    });
    
    const meetingTemplate = screen.getByText('Meeting Notes');
    fireEvent.click(meetingTemplate);
    
    const backButton = screen.getByText('← Back to Templates');
    fireEvent.click(backButton);
    
    expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
    expect(screen.queryByText('Template Preview:')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    render(<NoteTemplates {...mockProps} />);
    
    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);
    
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when cancel button is clicked', async () => {
    render(<NoteTemplates {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('shows built-in and custom badges correctly', async () => {
    render(<NoteTemplates {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      expect(screen.getByText('Custom Template')).toBeInTheDocument();
    });
    
    const builtInBadges = screen.getAllByText('Built-in');
    const customBadges = screen.getAllByText('Custom');
    
    expect(builtInBadges.length).toBeGreaterThan(0);
    expect(customBadges.length).toBeGreaterThan(0);
  });

  it('shows variable count for templates with variables', async () => {
    render(<NoteTemplates {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
    });
    
    // Meeting Notes template has many variables
    expect(screen.getByText(/\d+ variables/)).toBeInTheDocument();
  });

  it('shows empty state when no templates match search', async () => {
    render(<NoteTemplates {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText('Search templates...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    
    expect(screen.getByText('No templates found matching your criteria.')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    // Mock a slow loading response
    mockElectronAPI.getCachedNotes.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve([]), 1000))
    );
    
    render(<NoteTemplates {...mockProps} />);
    
    expect(screen.getByText('Loading templates...')).toBeInTheDocument();
  });

  it('handles template loading error gracefully', async () => {
    mockElectronAPI.getCachedNotes.mockRejectedValue(new Error('Failed to load'));
    
    render(<NoteTemplates {...mockProps} />);
    
    await waitFor(() => {
      // Should still show built-in templates even if custom templates fail to load
      expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
    });
  });

  it('extracts variables from template content correctly', async () => {
    render(<NoteTemplates {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Custom Template')).toBeInTheDocument();
    });
    
    const customTemplate = screen.getByText('Custom Template');
    fireEvent.click(customTemplate);
    
    // Custom template has {{variable1}} and {{variable2}}
    expect(screen.getByText('Variable1')).toBeInTheDocument();
    expect(screen.getByText('Variable2')).toBeInTheDocument();
  });

  it('shows template content preview', async () => {
    render(<NoteTemplates {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
    });
    
    const meetingTemplate = screen.getByText('Meeting Notes');
    fireEvent.click(meetingTemplate);
    
    const templateCode = screen.getByText(/# \{\{meeting_title\}\}/);
    expect(templateCode).toBeInTheDocument();
  });
});
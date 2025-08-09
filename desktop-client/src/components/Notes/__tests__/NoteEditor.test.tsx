import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import NoteEditor from '../NoteEditor';
import notesSlice, { Note } from '../../../stores/slices/notesSlice';

// Mock the RichTextEditor component
jest.mock('../../Editor/RichTextEditor', () => {
  return function MockRichTextEditor({ content, onChange, placeholder }: any) {
    return (
      <textarea
        data-testid="rich-text-editor"
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    );
  };
});

// Mock the hooks
const mockDispatch = jest.fn();
jest.mock('../../../stores/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: any) => selector({
    notes: {
      notes: [],
      filters: {},
      isLoading: false,
      error: undefined,
      currentNote: null,
    }
  }),
}));

// Mock electron API
const mockElectronAPI = {
  showSaveDialog: jest.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

const mockNote: Note = {
  id: '1',
  title: 'Test Note',
  content: 'This is test content',
  category: 'Note',
  tags: ['test', 'sample'],
  folder_path: '/',
  is_archived: false,
  is_pinned: false,
  is_favorite: false,
  created_at: '2024-01-01T10:00:00Z',
  updated_at: '2024-01-01T10:00:00Z',
  version: 1,
};

const mockProps = {
  note: mockNote,
  onSave: jest.fn(),
  onClose: jest.fn(),
};

const createMockStore = () => {
  return configureStore({
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
};

const renderWithProvider = (component: React.ReactElement) => {
  const store = createMockStore();
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

describe('NoteEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders note editor with note data', () => {
    renderWithProvider(<NoteEditor {...mockProps} />);
    
    expect(screen.getByDisplayValue('Test Note')).toBeInTheDocument();
    expect(screen.getByDisplayValue('This is test content')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Note')).toBeInTheDocument();
  });

  it('renders empty state when no note is provided', () => {
    renderWithProvider(<NoteEditor {...mockProps} note={null} />);
    
    expect(screen.getByText('Select a note to edit')).toBeInTheDocument();
    expect(screen.getByText('Choose a note from the list or create a new one to get started.')).toBeInTheDocument();
  });

  it('updates title when title input changes', () => {
    renderWithProvider(<NoteEditor {...mockProps} />);
    
    const titleInput = screen.getByDisplayValue('Test Note');
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
    
    expect(titleInput).toHaveValue('Updated Title');
  });

  it('updates content when rich text editor changes', () => {
    renderWithProvider(<NoteEditor {...mockProps} />);
    
    const contentEditor = screen.getByTestId('rich-text-editor');
    fireEvent.change(contentEditor, { target: { value: 'Updated content' } });
    
    expect(contentEditor).toHaveValue('Updated content');
  });

  it('updates category when category select changes', () => {
    renderWithProvider(<NoteEditor {...mockProps} />);
    
    const categorySelect = screen.getByDisplayValue('Note');
    fireEvent.change(categorySelect, { target: { value: 'Meeting' } });
    
    expect(categorySelect).toHaveValue('Meeting');
  });

  it('adds tags when tag input is used', () => {
    renderWithProvider(<NoteEditor {...mockProps} />);
    
    const tagInput = screen.getByPlaceholderText('Add tags...');
    fireEvent.change(tagInput, { target: { value: 'newtag' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });
    
    expect(screen.getByText('newtag')).toBeInTheDocument();
  });

  it('removes tags when tag remove button is clicked', () => {
    renderWithProvider(<NoteEditor {...mockProps} />);
    
    const removeButton = screen.getAllByText('×')[0];
    fireEvent.click(removeButton);
    
    expect(screen.queryByText('test')).not.toBeInTheDocument();
  });

  it('shows modified indicator when content changes', () => {
    renderWithProvider(<NoteEditor {...mockProps} />);
    
    const titleInput = screen.getByDisplayValue('Test Note');
    fireEvent.change(titleInput, { target: { value: 'Modified Title' } });
    
    expect(screen.getByText('•')).toBeInTheDocument();
  });

  it('auto-saves after 2 seconds when modified', async () => {
    mockDispatch.mockResolvedValue({ unwrap: () => Promise.resolve(mockNote) });
    
    renderWithProvider(<NoteEditor {...mockProps} />);
    
    const titleInput = screen.getByDisplayValue('Test Note');
    fireEvent.change(titleInput, { target: { value: 'Modified Title' } });
    
    // Fast-forward time by 2 seconds
    jest.advanceTimersByTime(2000);
    
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalled();
    });
  });

  it('calls onSave when save button is clicked', async () => {
    mockDispatch.mockResolvedValue({ unwrap: () => Promise.resolve(mockNote) });
    
    renderWithProvider(<NoteEditor {...mockProps} />);
    
    const titleInput = screen.getByDisplayValue('Test Note');
    fireEvent.change(titleInput, { target: { value: 'Modified Title' } });
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalled();
    });
  });

  it('calls onClose when close button is clicked', () => {
    renderWithProvider(<NoteEditor {...mockProps} />);
    
    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);
    
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('shows export dropdown when export button is hovered', () => {
    renderWithProvider(<NoteEditor {...mockProps} />);
    
    const exportButton = screen.getByText('Export');
    fireEvent.mouseEnter(exportButton);
    
    expect(screen.getByText('Export as PDF')).toBeInTheDocument();
    expect(screen.getByText('Export as Markdown')).toBeInTheDocument();
    expect(screen.getByText('Export as HTML')).toBeInTheDocument();
  });

  it('opens save dialog when export option is clicked', async () => {
    mockElectronAPI.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/path/to/file.md',
    });
    
    renderWithProvider(<NoteEditor {...mockProps} />);
    
    const exportButton = screen.getByText('Export');
    fireEvent.mouseEnter(exportButton);
    
    const markdownExport = screen.getByText('Export as Markdown');
    fireEvent.click(markdownExport);
    
    await waitFor(() => {
      expect(mockElectronAPI.showSaveDialog).toHaveBeenCalledWith({
        title: 'Export Note as MARKDOWN',
        defaultPath: 'Test Note.md',
        filters: [{ name: 'MARKDOWN', extensions: ['md'] }],
      });
    });
  });

  it('displays note metadata in footer', () => {
    renderWithProvider(<NoteEditor {...mockProps} />);
    
    expect(screen.getByText(/Created:/)).toBeInTheDocument();
    expect(screen.getByText(/Modified:/)).toBeInTheDocument();
    expect(screen.getByText(/Version:/)).toBeInTheDocument();
  });

  it('handles new note creation', () => {
    const newNoteProps = {
      ...mockProps,
      note: {
        ...mockNote,
        id: `note-${Date.now()}`,
        title: '',
        content: '',
      },
    };
    
    renderWithProvider(<NoteEditor {...newNoteProps} />);
    
    const titleInput = screen.getByPlaceholderText('Untitled');
    expect(titleInput).toHaveValue('');
    
    const contentEditor = screen.getByTestId('rich-text-editor');
    expect(contentEditor).toHaveValue('');
  });

  it('shows saving indicator during save operation', async () => {
    // Mock a slow save operation
    mockDispatch.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ unwrap: () => Promise.resolve(mockNote) }), 1000))
    );
    
    renderWithProvider(<NoteEditor {...mockProps} />);
    
    const titleInput = screen.getByDisplayValue('Test Note');
    fireEvent.change(titleInput, { target: { value: 'Modified Title' } });
    
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);
    
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('handles folder path changes', () => {
    renderWithProvider(<NoteEditor {...mockProps} />);
    
    const folderInput = screen.getByDisplayValue('/');
    fireEvent.change(folderInput, { target: { value: '/projects/work' } });
    
    expect(folderInput).toHaveValue('/projects/work');
  });

  it('prevents adding duplicate tags', () => {
    renderWithProvider(<NoteEditor {...mockProps} />);
    
    const tagInput = screen.getByPlaceholderText('Add tags...');
    fireEvent.change(tagInput, { target: { value: 'test' } }); // 'test' already exists
    fireEvent.keyDown(tagInput, { key: 'Enter' });
    
    // Should still only have one 'test' tag
    const testTags = screen.getAllByText('test');
    expect(testTags).toHaveLength(1);
  });

  it('adds tag on comma key press', () => {
    renderWithProvider(<NoteEditor {...mockProps} />);
    
    const tagInput = screen.getByPlaceholderText('Add tags...');
    fireEvent.change(tagInput, { target: { value: 'newtag' } });
    fireEvent.keyDown(tagInput, { key: ',' });
    
    expect(screen.getByText('newtag')).toBeInTheDocument();
  });

  it('removes last tag on backspace when input is empty', () => {
    renderWithProvider(<NoteEditor {...mockProps} />);
    
    const tagInput = screen.getByPlaceholderText('Add tags...');
    fireEvent.keyDown(tagInput, { key: 'Backspace' });
    
    // Should remove the last tag ('sample')
    expect(screen.queryByText('sample')).not.toBeInTheDocument();
    expect(screen.getByText('test')).toBeInTheDocument(); // First tag should remain
  });
});